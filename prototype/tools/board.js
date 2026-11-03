#!/usr/bin/env node
/* Render the visual style overview board for a theme.
 *   node tools/board.js <theme> [out.png]
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const theme = process.argv[2] || 'mallow';
const out = process.argv[3] || path.join(__dirname, '..', '..', 'deliverables', 'overviews', `${theme}.png`);
(async () => {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'index.html') + `?theme=${theme}&record=1`);
  await p.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  await p.addScriptTag({ path: path.join(__dirname, '..', 'shared', 'board.js') });
  const b64 = await p.evaluate(() => window.renderBoard());
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log('wrote', out);
  await b.close();
})();
