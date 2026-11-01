// 롤프로 시뮬레이터 — 정적 웹앱 (서버 없음). API 키는 브라우저 localStorage에만 저장한다.
'use strict';

const DATA = '../rules/';            // 저장소 루트에서 GitHub Pages로 서빙할 때의 경로
const YEARS = Array.from({ length: 14 }, (_, i) => 2013 + i);
const LEAGUES = ['LCK', 'LPL', 'LEC', 'LCS'];
const PRESETS = {
  orcarouter: { baseUrl: 'https://api.orcarouter.ai/v1', model: '' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: '' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-opus-5-5' },
  custom: { baseUrl: '', model: '' },
};

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } },
};

let settings = store.get('lp_settings', { provider: 'orcarouter', ...PRESETS.orcarouter, apiKey: '', keepTurns: 10, maxTokens: 4096 });
let game = store.get('lp_game', null);   // { year, system, messages: [{role, content}], latestSave }
let busy = false;

// ---------- 시스템 프롬프트 조립 ----------
async function fetchText(path) {
  const r = await fetch(DATA + path);
  if (!r.ok) throw new Error(`파일을 읽지 못했습니다: ${path} (${r.status})`);
  return r.text();
}
function section(md, year) {           // competition.md에서 그해 절만
  const re = new RegExp(`^## ${year}\\b[\\s\\S]*?(?=^## \\d{4}\\b|(?![\\s\\S]))`, 'm');
  const m = md.match(re);
  return m ? m[0] : '';
}
function head(md) { return md.split(/^## \d{4}\b/m)[0]; }
function csvIds(text) {
  return new Set(text.trim().split(/\r?\n/).slice(1).map((l) => l.split(',')[0]));
}
async function buildSystem(year) {
  const files = [];
  const add = (name, body) => files.push(`=== 파일: ${name} ===\n${body.trim()}\n`);
  add('lolpro.md (지침)', await fetchText('lolpro.md'));
  add('db/README.md', await fetchText('db/README.md'));
  add('db/league_history.md', await fetchText('db/league_history.md'));
  const comp = await fetchText('db/competition.md');
  add(`db/competition.md (공통 + ${year})`, head(comp) + '\n' + section(comp, year));
  add('db/salary.md', await fetchText('db/salary.md'));
  add('db/traits.md', await fetchText('db/traits.md'));
  add('db/champions/README.md', await fetchText('db/champions/README.md'));
  add('db/champions/champions.csv', await fetchText('db/champions/champions.csv'));
  try { add(`db/champions/meta/${year}.csv`, await fetchText(`db/champions/meta/${year}.csv`)); } catch { /* 메타 없음 */ }
  const ids = new Set();
  for (const lg of LEAGUES) {
    try {
      const t = await fetchText(`db/${year}/${lg}.csv`);
      csvIds(t).forEach((i) => ids.add(i));
      add(`db/${year}/${lg}.csv`, t);
    } catch { /* 그해 파일 없음 */ }
  }
  // potential: 그해 1부 선수 + CL 전원(미래 신인·2군) — 전체를 넣으면 너무 커서 거른다
  const potRows = new Map(); let header = '';
  for (const f of ['LCK', 'LPL', 'LEC', 'LCS', 'CL']) {
    const lines = (await fetchText(`db/potential/${f}.csv`)).trim().split(/\r?\n/);
    header = lines[0];
    for (const l of lines.slice(1)) {
      const id = l.split(',')[0];
      if ((ids.has(id) || f === 'CL') && !potRows.has(id)) potRows.set(id, l);
    }
  }
  add('db/potential (시작 연도 1부 선수 + CL)', [header, ...potRows.values()].join('\n'));
  return `너는 아래 '지침'을 따르는 AI 디렉터다. 시작 연도는 ${year}년이다. 아래 파일들이 앱이 함께 넣어 준 참조 자료다(lolpro.md 0.1). 이 밖의 선수 정보는 검색하지 않는다.\n\n` + files.join('\n');
}

// ---------- 주사위 ----------
function rnd(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return (a[0] % n) + 1; }
function diceLine() {
  const d100 = Array.from({ length: 12 }, () => rnd(100)).join(' ');
  const d6 = Array.from({ length: 12 }, () => rnd(6)).join(' ');
  return `\n\n[앱 난수 — 이번 응답의 판정에 순서대로 사용(lolpro 0.3). d100: ${d100} / d6: ${d6}]`;
}

// ---------- 대화 맥락 ----------
function contextMessages() {
  const keep = Math.max(2, Number(settings.keepTurns) || 10) * 2;
  const recent = game.messages.slice(-keep);
  if (recent.length && recent[0].role === 'assistant') recent.shift();   // user로 시작
  const out = [];
  if (game.latestSave && game.messages.length > keep) {
    out.push({ role: 'user', content: '[기억: 가장 최근 세이브 — 이 시점 이후는 아래 대화로 이어진다]\n```yaml\n' + game.latestSave + '\n```' });
    out.push({ role: 'assistant', content: '세이브 내용을 확인했습니다. 이어서 진행합니다.' });
  }
  return out.concat(recent);
}
function captureSave(text) {
  const m = text.match(/```ya?ml\s*\n(save_version[\s\S]*?)```/);
  if (m) { game.latestSave = m[1].trim(); return true; }
  return false;
}

// ---------- API 호출 (스트리밍) ----------
async function* sse(resp) {
  const reader = resp.body.getReader(); const dec = new TextDecoder(); let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      const data = chunk.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('');
      if (data && data !== '[DONE]') { try { yield JSON.parse(data); } catch { /* 무시 */ } }
    }
  }
}
async function callModel(onText) {
  const msgs = contextMessages();
  let resp;
  if (settings.provider === 'anthropic') {
    resp = await fetch(settings.baseUrl.replace(/\/$/, '') + '/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'anthropic-beta': 'server-side-fallback-2026-07-01',
      },
      body: JSON.stringify({
        model: settings.model, max_tokens: Number(settings.maxTokens) || 4096, stream: true,
        system: [{ type: 'text', text: game.system, cache_control: { type: 'ephemeral' } }],
        messages: msgs, fallbacks: 'default',
      }),
    });
  } else {
    const headers = { 'content-type': 'application/json', authorization: 'Bearer ' + settings.apiKey };
    if (settings.provider === 'openrouter') { headers['HTTP-Referer'] = location.origin; headers['X-Title'] = 'LoL Pro Simulator'; }
    resp = await fetch(settings.baseUrl.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST', headers,
      body: JSON.stringify({
        model: settings.model, stream: true, max_tokens: Number(settings.maxTokens) || 4096,
        messages: [{ role: 'system', content: game.system }, ...msgs],
      }),
    });
  }
  if (!resp.ok) throw new Error(`API 오류 ${resp.status}: ${(await resp.text()).slice(0, 400)}`);
  let text = '';
  for await (const ev of sse(resp)) {
    let piece = '';
    if (settings.provider === 'anthropic') {
      if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') piece = ev.delta.text;
      if (ev.type === 'message_delta' && ev.delta && ev.delta.stop_reason === 'refusal') piece = '\n\n(모델이 이 요청을 거절했습니다.)';
      if (ev.type === 'error') throw new Error(ev.error && ev.error.message || 'API 오류');
    } else {
      const c = ev.choices && ev.choices[0];
      piece = (c && c.delta && c.delta.content) || '';
      if (ev.error) throw new Error(ev.error.message || 'API 오류');
    }
    if (piece) { text += piece; onText(text); }
  }
  return text;
}

// ---------- 화면 ----------
function esc(s) { return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function render(md) {
  let h = esc(md);
  h = h.replace(/```(\w*)\n([\s\S]*?)```/g, (_, l, c) => `<pre><code>${c}</code></pre>`);
  h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
  return h;
}
function addMsg(role, content) {
  const d = document.createElement('div');
  d.className = 'msg ' + role; d.innerHTML = role === 'user' ? esc(content) : render(content);
  $('log').appendChild(d); d.scrollIntoView({ block: 'end' });
  return d;
}
function redraw() {
  $('log').innerHTML = '';
  if (!game) { addMsg('system', '설정에서 API 키를 넣고, "새 게임"으로 시작 연도를 고르세요.'); return; }
  addMsg('system', `시작 연도 ${game.year}년 게임`);
  for (const m of game.messages) addMsg(m.role, m.role === 'user' ? m.content.replace(/\n\n\[앱 난수[^\]]*\]$/, '') : m.content);
}
function status(t) { $('status').textContent = t || ''; }
function persist() { store.set('lp_game', game); }

async function send(text) {
  if (busy) return;
  if (!settings.apiKey || !settings.model) { $('dlgSettings').showModal(); status('API 키와 모델 이름을 먼저 설정하세요.'); return; }
  if (!game) { $('dlgNew').showModal(); return; }
  busy = true; $('btnSend').disabled = true;
  game.messages.push({ role: 'user', content: text + diceLine() });
  addMsg('user', text);
  const box = addMsg('assistant', '…');
  status('응답 생성 중…');
  try {
    const out = await callModel((t) => { box.innerHTML = render(t); box.scrollIntoView({ block: 'end' }); });
    game.messages.push({ role: 'assistant', content: out });
    if (captureSave(out)) status('세이브를 기억했습니다. 대화가 길어져도 이 세이브를 기준으로 이어 갑니다.');
    else status('');
    persist();
  } catch (e) {
    game.messages.pop(); box.remove();
    status(e.message);
  } finally { busy = false; $('btnSend').disabled = false; }
}

// ---------- 이벤트 ----------
function fillSettings() {
  $('provider').value = settings.provider; $('baseUrl').value = settings.baseUrl; $('apiKey').value = settings.apiKey;
  $('model').value = settings.model; $('keepTurns').value = settings.keepTurns; $('maxTokens').value = settings.maxTokens;
}
$('provider').addEventListener('change', () => {
  const p = PRESETS[$('provider').value];
  $('baseUrl').value = p.baseUrl; if (p.model) $('model').value = p.model;
});
$('btnSettings').onclick = () => { fillSettings(); $('dlgSettings').showModal(); };
$('btnSaveSettings').onclick = () => {
  settings = { provider: $('provider').value, baseUrl: $('baseUrl').value.trim(), apiKey: $('apiKey').value.trim(),
    model: $('model').value.trim(), keepTurns: Number($('keepTurns').value) || 10, maxTokens: Number($('maxTokens').value) || 4096 };
  store.set('lp_settings', settings); status('설정을 저장했습니다.');
};
$('btnClearKey').onclick = () => { settings.apiKey = ''; $('apiKey').value = ''; store.set('lp_settings', settings); status('키를 지웠습니다.'); };

$('startYear').innerHTML = YEARS.map((y) => `<option${y === 2026 ? ' selected' : ''}>${y}</option>`).join('');
$('btnNew').onclick = () => $('dlgNew').showModal();
$('btnStart').onclick = async () => {
  const year = Number($('startYear').value);
  status('DB 파일을 불러오는 중…');
  try {
    game = { year, system: await buildSystem(year), messages: [], latestSave: null };
    persist(); redraw();
    status(`준비 완료 (참조 자료 약 ${Math.round(game.system.length / 1000)}천 자).`);
    send(`${year}년 1월에 새 커리어를 시작한다. lolpro.md 2장대로 캐릭터 생성을 진행해 줘(배경은 3지선다).`);
  } catch (e) { status(e.message); }
};
$('btnSave').onclick = () => send('세이브');
$('btnExport').onclick = () => {
  if (!game) return;
  const blob = new Blob([JSON.stringify({ app: 'lolpro', version: 1, game }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `lolpro_${game.year}_${new Date().toISOString().slice(0, 10)}.json`; a.click();
};
$('fileImport').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!d.game || !d.game.system) throw new Error('롤프로 내보내기 파일이 아닙니다.');
    game = d.game; persist(); redraw(); status('불러왔습니다.');
  } catch (err) { status(err.message); }
  e.target.value = '';
};
$('composer').onsubmit = (e) => { e.preventDefault(); const t = $('input').value.trim(); if (t) { $('input').value = ''; send(t); } };
$('input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('composer').requestSubmit(); } });

redraw();
