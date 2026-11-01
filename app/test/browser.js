/* 브라우저 테스트 (node app/test/browser.js): http.server를 띄우고 새 게임 → 생성 → 4주 → 경기 1회까지 콘솔 오류가 없는지 확인 */
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..');
const PORT = 8765 + Math.floor(Math.random() * 200);

async function drain(page) {
  for (let i = 0; i < 40 && await page.$('.overlay'); i++) {
    const h = await page.$('.modal h2'); const title = h ? await h.textContent() : '';
    const sk = await page.$('text=건너뛰기'); if (sk) { await sk.click(); await page.waitForTimeout(100); }
    if (!title.includes('경기 준비') && !(await page.$('.map'))) { const o = await page.$('.modal .opt'); if (o) { await o.click(); await page.waitForTimeout(120); continue; } }
    const b = await page.$('.mbtns .btn:last-child'); if (b) { await b.click(); await page.waitForTimeout(150); }
  }
}
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1200));
  const errors = [];
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('requestfailed', r => errors.push('requestfailed: ' + r.url()));
    page.on('response', r => { if (r.status() >= 400) errors.push('http ' + r.status() + ' ' + r.url()); });
    await page.goto(`http://127.0.0.1:${PORT}/app/`);
    await page.waitForSelector('#t-new');
    await page.click('#t-new');
    await page.fill('#c-name', '홍길동');
    await page.fill('#c-nick', 'Gildong');
    await page.selectOption('#c-pos', 'MID');
    await page.selectOption('#c-year', '2026');
    for (const k of ['lan', 'phy', 'skr', 'tf', 'vis']) await page.fill(`[data-st=${k}]`, '420');
    await page.click('[data-kw=침착]'); await page.click('[data-kw=승부욕]');
    await page.fill('#c-seed', 'pw-test');
    await page.click('#c-next');
    await page.waitForSelector('.bg-card');
    await page.click('.bg-card');
    await page.click('.mbtns .btn:not(.ghost)');
    await page.waitForSelector('.status');
    // 4주 진행 (이벤트가 뜨면 첫 선택지)
    let weeks = 0;
    for (let i = 0; i < 12 && weeks < 4; i++) {
      const ev = await page.$('.opt');
      if (ev) { await ev.click(); await page.waitForTimeout(100); continue; }
      await page.click('#go-week'); weeks++;
      await page.waitForTimeout(80);
    }
    // 계약을 시킨 뒤(1군 주전) 경기 주까지 진행
    await page.evaluate(() => {
      const st = LP.main.state, L = LP.league;
      for (const o of L.offers(st, 'pro', 20, false)) { if (o.league === 'LCK') { o.role = 'starter'; L.join(st, o); break; } }
      st.career.stage = st.career.stage === 'pro' ? 'pro' : st.career.stage;
      st.date = '2026-03-30'; st.wk = null; st.pending = null;
    });
    await page.evaluate(() => { document.querySelector('#btn-menu').click(); });
    await page.keyboard.press('Escape');
    await page.evaluate(() => { document.querySelectorAll('.overlay').forEach(e => e.remove()); LP.ui.renderGame(LP.main.state); });
    let sawMatch = false;
    for (let i = 0; i < 40 && !sawMatch; i++) {
      const mm = await page.$('.modal h2');
      const title = mm ? await mm.textContent() : '';
      if (title.includes('경기 준비')) { sawMatch = true; break; }
      const o = await page.$('.modal .opt');
      if (o) { await o.click(); await page.waitForTimeout(120); continue; }
      if (await page.$('.overlay')) { await page.click('.mbtns .btn'); continue; }
      await page.click('#go-week');
      await page.waitForTimeout(150);
    }
    if (!sawMatch) throw new Error('경기 모달을 보지 못했습니다');
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + '/prep.png' });
    await page.click('.mbtns .btn');        // 경기 시작 (관전)
    await page.waitForSelector('.map');
    await page.waitForTimeout(6000);
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + '/watch.png' });
    for (let k = 0; k < 6; k++) {
      const skip = await page.$('text=건너뛰기');
      if (skip) await skip.click();
      await page.waitForTimeout(150);
      const nxt = await page.$('.mbtns .btn:has-text("다음 세트")');
      if (nxt) { await nxt.click(); continue; }
      const fin = await page.$('.mbtns .btn:has-text("결과 보기")');
      if (fin) { await fin.click(); break; }
    }
    await page.waitForSelector('.modal h2:has-text("경기 결과"), .modal h2:has-text("무승부")');
    await page.click('.mbtns .btn');
    await drain(page);
    await page.waitForSelector('.status');
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + '/game.png', fullPage: false });
    const noScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    if (!noScroll) errors.push('가로 스크롤 발생');
    // 자동 진행 4주
    await page.click('[data-seg] button[data-v=auto]');
    await page.selectOption('#auto-span', '4');
    await page.click('#go-auto');
    await page.waitForTimeout(500);
    await drain(page);
    console.log('상태:', await page.evaluate(() => LP.main.state.date + ' ' + LP.main.state.career.stage));
  } catch (e) {
    errors.push('test: ' + (e && e.stack.split('\n').filter(l => l.includes('browser.js')).join(' | ')));
  } finally {
    if (browser) await browser.close();
    srv.kill();
  }
  if (errors.length) { console.error('FAIL\n' + errors.join('\n')); process.exit(1); }
  console.log('browser OK');
})();
