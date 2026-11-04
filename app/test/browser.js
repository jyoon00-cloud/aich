/* 브라우저 테스트 (node app/test/browser.js): http.server를 띄우고 데스크톱(1280)·모바일(390) 각각
   새 게임 → 생성(시그니처 선택) → 탭 이동 → 4주 → 경기(직접 밴픽·관전·결과) → 자동 진행까지
   콘솔 오류 없음, 가로 스크롤 없음을 확인한다. SHOT=디렉터리 를 주면 스크린샷을 남긴다. */
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..');
const PORT = 8765 + Math.floor(Math.random() * 200);
const SHOT = process.env.SHOT || '';
if (SHOT) fs.mkdirSync(SHOT, { recursive: true });

// 열려 있는 모달을 순서대로 닫는다. 경기 모달이면 진행한다.
async function drain(page, opts) {
  opts = opts || {};
  for (let i = 0; i < 80 && await page.$('.overlay'); i++) {
    const h = await page.$('.modal h2'); const title = h ? await h.textContent() : '';
    if (await page.$('.map')) {
      const sk = await page.$('.mbtns .btn:has-text("건너뛰기")'); if (sk) { await sk.click(); await page.waitForTimeout(80); }
      const b = await page.$('.mbtns .btn:has-text("다음 세트"), .mbtns .btn:has-text("결과 보기")'); if (b) await b.click();
      await page.waitForTimeout(120); continue;
    }
    if (title.includes('세트 챔피언 선택')) { await page.click('.mbtns .btn:first-child'); await page.waitForTimeout(100); continue; }
    if (await page.$('.modal .opt[data-o]')) { await page.click('.modal .opt[data-o]'); await page.waitForTimeout(100); continue; }
    const b = await page.$('.mbtns .btn'); if (b) { await b.click(); await page.waitForTimeout(120); } else break;
  }
}
async function noHScroll(page, errors, label) {
  const ok = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  if (!ok) errors.push('가로 스크롤 발생: ' + label);
}
async function shot(page, name) { if (SHOT) await page.screenshot({ path: path.join(SHOT, name + '.png') }); }
async function tab(page, id) { await page.click(`#tabs [data-tab=${id}]`); await page.waitForTimeout(80); }

async function runOne(browser, base, vp, scheme, errors, tag) {
  const ctx = await browser.newContext({ viewport: vp.size, colorScheme: scheme });
  const page = await ctx.newPage();
  const err = m => errors.push(`[${tag}] ${m}`);
  page.on('console', m => { if (m.type() === 'error') err('console: ' + m.text()); });
  page.on('pageerror', e => err('pageerror: ' + e.message));
  page.on('requestfailed', r => err('requestfailed: ' + r.url()));
  page.on('response', r => { if (r.status() >= 400) err('http ' + r.status() + ' ' + r.url()); });
  await page.goto(`${base}/app/`);
  await page.waitForSelector('#t-new');
  // 캐시 버전 쿼리 확인
  const q = await page.evaluate(() => Array.from(document.querySelectorAll('script[src],link[rel=stylesheet]')).map(e => e.getAttribute('src') || e.getAttribute('href')));
  if (!q.length || q.some(u => !/\?v=[\w.]+$/.test(u))) err('버전 쿼리 없음: ' + q.join(','));
  await shot(page, `${tag}-0-title`);
  await page.click('#t-new');
  await page.fill('#c-name', '홍길동');
  await page.fill('#c-nick', 'Gildong');
  await page.selectOption('#c-pos', 'MID');
  await page.selectOption('#c-year', '2026');
  for (const k of ['lan', 'phy', 'skr', 'tf', 'vis']) await page.fill(`[data-st=${k}]`, '420');
  await page.click('[data-kw=침착]'); await page.click('[data-kw=승부욕]');
  await page.fill('#c-seed', 'pw-test');
  // 시그니처: 검색 후 3개 선택
  await page.click('#c-next');
  if (!(await page.textContent('#c-err')).includes('시그니처')) err('시그니처 없이 진행됨');
  await page.fill('#c-sigq', '아');
  const hits = await page.$$('#c-siglist button');
  if (hits.length < 1) err('시그니처 검색 결과 없음');
  await page.fill('#c-sigq', '');
  for (let i = 0; i < 3; i++) await page.locator('#c-siglist button').nth(i).click();
  await shot(page, `${tag}-1-create`);
  await page.click('#c-next');
  await page.waitForSelector('.bg-card');
  await page.click('.bg-card');
  await page.click('.mbtns .btn:not(.sec)');
  await page.waitForSelector('body[data-mode=game] .next-card');
  await noHScroll(page, errors, tag + ' home');
  await shot(page, `${tag}-2-home`);
  // 탭 이동
  for (const t of ['sched', 'rank', 'player', 'log', 'home']) {
    await tab(page, t); await noHScroll(page, errors, `${tag} tab ${t}`);
    if (t !== 'home') await shot(page, `${tag}-3-${t}`);
  }
  // 4주 진행
  let weeks = 0;
  for (let i = 0; i < 14 && weeks < 4; i++) {
    if (await page.$('.overlay')) { await drain(page); continue; }
    await page.click('#go-week'); weeks++; await page.waitForTimeout(60);
  }
  await drain(page);
  // 1군 주전으로 만들고 경기 주로 이동
  await page.evaluate(() => {
    const st = LP.main.state, L = LP.league;
    for (const o of L.offers(st, 'pro', 20, false)) { if (o.league === 'LCK') { o.role = 'starter'; L.join(st, o); break; } }
    st.date = '2026-03-30'; st.wk = null; st.pending = null; st.prefs.draft = 'always'; st.prefs.watch = 'all';
    LP.main.render();
  });
  let sawMatch = false;
  for (let i = 0; i < 40 && !sawMatch; i++) {
    const mm = await page.$('.modal h2'); const title = mm ? await mm.textContent() : '';
    if (title.includes('경기 준비')) { sawMatch = true; break; }
    if (await page.$('.overlay')) { await drain(page); continue; }
    await page.click('#go-week'); await page.waitForTimeout(150);
  }
  if (!sawMatch) throw new Error('경기 모달을 보지 못했습니다');
  await shot(page, `${tag}-4-prep`);
  await page.click('.mbtns .btn');                       // 경기 시작
  await page.waitForSelector('.modal h2:has-text("세트 챔피언 선택")');
  if (!(await page.$('.pick-row:disabled')) && !(await page.$('.pick-row'))) err('밴픽 목록 없음');
  const firstTag = await page.$('.pick-row .tagx.sig');
  if (!firstTag) err('밴픽 목록에 시그니처 표시 없음');
  await shot(page, `${tag}-5-draft`);
  await noHScroll(page, errors, tag + ' draft');
  await page.click('.mbtns .btn:first-child');
  await page.waitForSelector('.map');
  await page.waitForTimeout(3500);
  await shot(page, `${tag}-6-watch`);
  await noHScroll(page, errors, tag + ' watch');
  // 나머지 세트 진행: 건너뛰기 → 다음 세트/결과, 직접 밴픽은 첫 버튼
  for (let k = 0; k < 40; k++) {
    if (await page.$('.modal h2:has-text("경기 결과"), .modal h2:has-text("무승부")')) break;
    await drain(page, {});
    if (await page.$('.modal h2:has-text("경기 결과"), .modal h2:has-text("무승부")')) break;
  }
  // drain이 결과 모달까지 닫아 버릴 수 있어, 결과 화면은 별도 시리즈에서 한 번 더 확인한다
  await drain(page);
  await page.waitForSelector('body[data-mode=game]');
  // 결과 화면: 같은 방식으로 다음 경기를 직접 열어 스크린샷
  await page.evaluate(() => { const st = LP.main.state; st.wk = null; st.pending = null; st.prefs.draft = 'auto'; st.prefs.watch = 'none'; LP.main.render(); });
  let gotResult = false;
  for (let i = 0; i < 60 && !gotResult; i++) {
    const mm = await page.$('.modal h2'); const title = mm ? await mm.textContent() : '';
    if (title.includes('경기 준비')) { await page.click('.mbtns .btn'); await page.waitForTimeout(150); continue; }
    if (title.includes('경기 결과') || title.includes('무승부')) { gotResult = true; break; }
    if (await page.$('.overlay')) { await drain(page); continue; }
    await page.click('#go-week'); await page.waitForTimeout(120);
  }
  if (!gotResult) err('경기 결과 화면을 보지 못했습니다');
  else {
    if (await page.$('#r-detail:not([hidden])')) err('판정 상세가 기본으로 열려 있음');
    const bodyText = await page.textContent('.modal .mbody');
    const vis = await page.evaluate(() => { const d = document.querySelector('#r-detail'); const t = document.querySelector('.modal .mbody').innerText; return { dice: /주사위/.test(t), hidden: d && d.hidden }; });
    if (vis.dice) err('판정 상세 밖에 주사위 표기 노출');
    await shot(page, `${tag}-7-result`);
    await noHScroll(page, errors, tag + ' result');
    await page.click('#r-toggle'); await shot(page, `${tag}-7b-result-detail`);
    await page.click('.mbtns .btn');
  }
  await drain(page);
  // 자동 진행 4주
  await page.selectOption('#auto-go', '4');
  await page.waitForTimeout(400);
  await drain(page);
  await tab(page, 'log'); await noHScroll(page, errors, tag + ' log');
  const first = await page.$('.lg:not(.oneline) > summary'); if (first) { await first.click(); await shot(page, `${tag}-8-log`); }
  await tab(page, 'player'); await noHScroll(page, errors, tag + ' player');
  console.log(`[${tag}] 상태:`, await page.evaluate(() => LP.main.state.date + ' ' + LP.main.state.career.stage + ' 시그니처 ' + LP.main.state.p.sig.length));
  await ctx.close();
}

(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1200));
  const errors = [];
  let browser;
  try {
    browser = await chromium.launch();
    const base = `http://127.0.0.1:${PORT}`;
    const runs = [
      ['desktop-dark', { size: { width: 1280, height: 800 } }, 'dark'],
      ['desktop-light', { size: { width: 1280, height: 800 } }, 'light'],
      ['mobile-dark', { size: { width: 390, height: 844 } }, 'dark'],
      ['mobile-light', { size: { width: 390, height: 844 } }, 'light']
    ];
    for (const [tag, vp, scheme] of runs) {
      try { await runOne(browser, base, vp, scheme, errors, tag); }
      catch (e) { errors.push(`[${tag}] test: ` + (e && e.stack.split('\n').slice(0, 4).join(' | '))); }
    }
  } finally {
    if (browser) await browser.close();
    srv.kill();
  }
  if (errors.length) { console.error('FAIL\n' + errors.join('\n')); process.exit(1); }
  console.log('browser OK');
})();
