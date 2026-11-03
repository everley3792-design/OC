#!/usr/bin/env node
/* Record a theme's prototype to MP4 (frame-exact, deterministic).
 *   node tools/record.js <theme> [out.mp4] [--from=0] [--to=45] [--fps=30]
 * Requires: playwright (Chromium) + ffmpeg on PATH.
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const theme = args[0] || 'mallow';
const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const out = args.find((a, i) => i > 0 && !a.startsWith('--')) || path.join(__dirname, '..', '..', 'deliverables', 'videos', `${theme}.mp4`);
const fps = +(opt.fps || 30);

(async () => {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  const url = 'file://' + path.join(__dirname, '..', 'index.html') + `?theme=${theme}&record=1`;
  await page.goto(url);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  const dur = await page.evaluate(() => OC.DURATION);
  const from = +(opt.from || 0), to = +(opt.to || dur);
  const n0 = Math.round(from * fps), n1 = Math.round(to * fps);

  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart',
    '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });

  const t0 = Date.now();
  for (let i = n0; i < n1; i++) {
    const b64 = await page.evaluate((t) => { renderFrame(t); return document.getElementById('c').toDataURL('image/png').split(',')[1]; }, i / fps);
    const buf = Buffer.from(b64, 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((i - n0) % 90 === 0) process.stdout.write(`${theme}: frame ${i - n0}/${n1 - n0} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  console.log(`${theme}: wrote ${out} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
})();
