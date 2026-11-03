#!/usr/bin/env node
/* Render individual frames to PNG for review.
 *   node tools/stills.js <theme> <outDir> t1 t2 ...   (times in seconds)
 *   --scale=0.5 to downscale, --sheet to also write a contact sheet
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const theme = args[0];
const outDir = args[1];
const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const times = args.slice(2).filter((a) => !a.startsWith('--')).map(Number);
const scale = +(opt.scale || 1);

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html') + `?theme=${theme}&record=1`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  for (const t of times) {
    const b64 = await page.evaluate(([t, s]) => {
      renderFrame(t);
      const c = document.getElementById('c');
      if (s === 1) return c.toDataURL('image/png').split(',')[1];
      const o = document.createElement('canvas'); o.width = c.width * s; o.height = c.height * s;
      const x = o.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, o.width, o.height);
      return o.toDataURL('image/png').split(',')[1];
    }, [t, scale]);
    const f = path.join(outDir, `${theme}_${t.toFixed(2)}.png`);
    fs.writeFileSync(f, Buffer.from(b64, 'base64'));
    console.log(f);
  }
  await browser.close();
})();
