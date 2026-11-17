import {selectVdpExample} from './lib/select-vdp-example.mjs';
// The VDP acceptance probe: Build Machine on the VDP example, then feed a
// minimal TMS9918 program through the ASM tab (set backdrop color + enable
// display — the border renders even with an empty name table), and check
// the VdpScreen canvas goes non-blank.
import { chromium } from 'playwright';
const out = process.argv[2] || '/tmp/vdp-asm.png';
// ca65 + ld65 with eater.cfg: code in the default segment, the reset
// vector via the VECTORS segment (a bare .org $FFFC would fight the
// linker config). Register writes: value byte then $80|reg to $4001.
const ASM = `; minimal TMS9918 smoke: backdrop light blue, display on
reset:
  lda #$E0
  sta $4001
  lda #$81
  sta $4001
  lda #$F5
  sta $4001
  lda #$87
  sta $4001
loop:
  jmp loop
  .segment "VECTORS"
  .word reset
  .word reset
  .word reset
`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('dialog', d => d.accept());
page.on('pageerror', e => console.log('PAGEERR:', String(e).slice(0, 200)));
page.on('console', m => { if (m.type() === 'error') console.log('JSERR:', m.text().slice(0, 140)); });
await page.addInitScript(() => {
  localStorage.clear();
  window.__probeLog = [];
  for (const ev of ['bw-machine-extracted', 'bw-machine-media-load', 'bw-asm-rom-ready']) {
    window.addEventListener(ev, e => {
      const d = e.detail || {};
      const b = d.rom || d.bytes;
      window.__probeLog.push(ev + ' bytes=' + (b ? b.length : 'none') + ' head=' + (b ? Array.from(b.slice(0, 4)).map(x => x.toString(16)).join(',') : '-') + ' kind=' + (d.kind || d.target || '?'));
    });
  }
});
await page.goto(process.env.BW_URL || 'https://crispstrobe.github.io/brickwright-lite/', { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForSelector('[role="tab"]', { timeout: 60000 });
console.log('TABS:', (await page.locator('[role="tab"]').allInnerTexts()).join('|'));
await page.locator('[role="tab"]', { hasText: 'Circuit' }).first().click();
await page.waitForTimeout(2500);
await selectVdpExample(page);
await page.waitForTimeout(3500);
try { await page.locator('button', { hasText: 'Build Machine' }).first().click({ timeout: 6000 }); console.log('built machine'); } catch (e) { console.log('no build btn:', e.message.slice(0, 80)); }
await page.waitForTimeout(2500);
console.log('EXTRACT:', await page.evaluate(() => {
  const el = document.querySelector('[data-build-machine]');
  return el ? el.innerText.replace(/\n/g, ' | ').slice(0, 400) : 'no build section';
}));

// The ASM surface lives under the Code tab's mode switch.
await page.locator('[role="tab"]', { hasText: 'Code' }).first().click();
await page.waitForTimeout(1500);
console.log('CODE TAB BUTTONS:', (await page.locator('button, [role="tab"], select option').allInnerTexts().catch(() => [])).filter(t => t && t.length < 30).join('|').slice(0, 400));
try {
  const sel = page.locator('select').first();
  const opts = await sel.locator('option').allInnerTexts().catch(() => []);
  console.log('SELECT OPTS:', JSON.stringify(opts));
  if (opts.some(o => /asm|assembl/i.test(o))) {
    await sel.selectOption({ label: opts.find(o => /asm|assembl/i.test(o)) });
    console.log('selected ASM mode');
  }
} catch (e) { console.log('mode select:', e.message.slice(0, 60)); }
try {
  await page.locator('button, [role="tab"]', { hasText: /ASM/ }).first().click({ timeout: 3000 });
  console.log('clicked ASM tab');
} catch { /* maybe the select did it */ }
await page.waitForTimeout(2000);
console.log('frames:', page.frames().length);
// The editor is CodeMirror 6 (contenteditable .cm-content), with a
// plain-textarea fallback while the chunk loads. Type for real — that
// is the only path that reaches React state in both cases.
const cm = page.locator('.cm-content').first();
let typed;
if (await cm.count()) {
  await cm.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+KeyA' : 'Control+KeyA');
  await page.keyboard.press('Delete');
  await page.keyboard.type(ASM, { delay: 1 });
  typed = 'typed into CodeMirror';
} else {
  const ta = page.locator('textarea').first();
  await ta.fill(ASM);
  typed = 'filled textarea fallback';
}
console.log('EDITOR:', typed);
await page.waitForTimeout(500);
const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /Assemble/i.test(b.textContent || ''));
  if (!btn) return 'no assemble button';
  btn.click();
  return 'clicked: ' + btn.textContent.trim();
});
console.log('RUN:', clicked);
await page.waitForTimeout(4000);
// Grab the importer's status line (assembly errors surface there).
console.log('ASM STATUS:', await page.evaluate(() =>
  (document.body.innerText.match(/Assembl[^\n]{0,140}|Assembly errors[^\n]{0,140}/g) || []).join(' | ')));

// The VdpScreen face lives in the CIRCUIT tab's debugger panel — switch
// back before looking for its canvas.
await page.locator('[role="tab"]', { hasText: 'Circuit' }).first().click();
await page.waitForTimeout(5000);

const state = await page.evaluate(() => {
  const canvases = [...document.querySelectorAll('canvas')].map(c => {
    let nonBlank = -1;
    try {
      const ctx = c.getContext('2d');
      if (ctx && c.width) {
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        nonBlank = 0;
        for (let i = 0; i < d.length; i += 40) { if (d[i] > 8 || d[i + 1] > 8 || d[i + 2] > 8) nonBlank++; }
      }
    } catch { /* webgl */ }
    const r = c.getBoundingClientRect();
    return { w: c.width, h: c.height, vis: r.width > 0, nonBlank };
  });
  return { canvases, text: document.body.innerText.match(/running|halted|error[^\n]{0,80}/gi)?.slice(0, 4) };
});
console.log('STATE:', JSON.stringify(state));
console.log('BENCH:', await page.evaluate(() => {
  const t = window.__benchTarget;
  if (!t) return 'no target hook';
  const out = {};
  try { out.pc = t.regs().pc.toString(16); } catch (e) { out.pc = 'err ' + e.message; }
  try { out.romAt8000 = Array.from(t.readMem('mem', 0x8000, 8)).map(x => x.toString(16)).join(','); } catch (e) { out.romAt8000 = 'err ' + e.message; }
  try { const v = t.video(); out.video = v ? { frame: v.frame, px: [v.rgba[0], v.rgba[1], v.rgba[2]] } : null; } catch (e) { out.video = 'err ' + e.message; }
  return JSON.stringify(out);
}));
console.log('EVENTS:', await page.evaluate(() => window.__probeLog.join(' || ')));
console.log('STASH:', await page.evaluate(() => {
  const p = window.__bwPendingMedia;
  if (!p) return 'none';
  const b = p.detail && (p.detail.rom || p.detail.bytes);
  return p.type + ' bytes=' + (b ? b.length : 'none') + ' head=' + (b ? Array.from(b.slice(0, 4)).map(x => x.toString(16)).join(',') : '-');
}));
await page.screenshot({ path: out });
console.log('saved', out);
await browser.close();
