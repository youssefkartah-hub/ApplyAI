#!/usr/bin/env node
/*
  Optional: redraws the social preview images (the card shown when a link to the
  site is pasted into LinkedIn, Slack, iMessage and so on).

      node tools/make_og_images.cjs

  Run it after changing a project title or result in content/projects.json.
  Needs Playwright with Chromium:  npm i -D playwright && npx playwright install chromium
  Output: docs/assets/media/og-home.jpg and one og-<slug>.jpg per project.
*/
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/site.json'), 'utf8'));
const { projects } = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/projects.json'), 'utf8'));
const media = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/media.json'), 'utf8'));
const fig = (f) => fs.readFileSync(path.join(ROOT, 'content', f), 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const img = (stem, pos = '50% 50%') => `<img src="assets/media/${stem}-${media[stem].w}.webp" alt="" style="object-position:${pos}">`;

/* What sits in the right-hand panel of each card. */
function visual(p) {
  const m = p.media;
  if (m.type === 'figure') return `<div class="draw">${fig(m.include)}</div>`;
  const stem = (m.type === 'video' ? m.poster : m.src).replace(/\.[^.]+$/, '');
  return img(stem, p.slug === 'uav-builds' ? '38% 50%' : '50% 40%');
}

function card({ kicker, title, line, vis, home }) {
  const longest = Math.max(...title.split(/\s+/).map((w) => w.length));
  const size = longest >= 11 ? 62 : title.length > 42 ? 58 : title.length > 22 ? 70 : 118;
  return `<!doctype html><html><head><meta charset="utf-8"><base href="file://${DOCS}/">
<link rel="stylesheet" href="assets/css/site.css">
<style>
  html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:${home ? 'var(--blue)' : 'var(--paper)'}}
  .og{display:grid;grid-template-columns:${home ? '700px' : '640px'} 1fr;height:630px;color:${home ? '#fff' : 'var(--ink)'}}
  .l{padding:56px 40px 52px 64px;display:flex;flex-direction:column}
  .k{font:600 21px/1.3 var(--f);color:${home ? 'rgba(255,255,255,.85)' : 'var(--blue)'}}
  h1{font-size:${size}px;line-height:.98;letter-spacing:-.035em;margin:24px 0 0;color:inherit}
  .line{margin-top:auto;font-size:25px;line-height:1.35;color:${home ? 'rgba(255,255,255,.9)' : 'var(--ink-2)'}}
  .line b{font:800 30px var(--fx);letter-spacing:-.03em;color:var(--blue)}
  .r{position:relative;overflow:hidden;background:#fff}
  .r img{width:100%;height:100%;object-fit:cover}
  .draw{position:absolute;inset:0;display:grid;place-items:center;padding:34px 60px;background:#fff}
  .draw svg{width:100%;height:auto;max-height:100%}
  .draw .duo{width:100%}
  .draw .chartcard{width:100%}
  .draw .readout{display:none}
  .y{position:absolute;right:0;top:0;width:90px;height:100%;background:var(--yellow)}
</style></head><body><div class="og">
  <div class="l"><p class="k">${esc(kicker)}</p><h1>${esc(title)}</h1><p class="line">${line}</p></div>
  <div class="r">${vis}${home ? '' : ''}</div>
</div></body></html>`;
}

(async () => {
  const cards = [{
    out: 'og-home.jpg',
    html: card({
      home: true,
      kicker: 'Aerospace Engineering · Penn State · Class of 2027',
      title: site.name,
      line: `${esc(site.tagline)}.`,
      vis: img('portrait', '50% 20%'),
    }),
  }];
  for (const p of projects) {
    cards.push({
      out: p.og,
      html: card({
        kicker: `${site.name} · ${p.kind[0]}`,
        title: p.title,
        line: `<b>${esc(p.result.value)}</b> ${esc(p.result.text)}`,
        vis: visual(p),
      }),
    });
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  const tmp = path.join(DOCS, '_og.html');
  for (const c of cards) {
    fs.writeFileSync(tmp, c.html);
    await page.goto(`file://${tmp}`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(DOCS, 'assets/media', c.out), type: 'jpeg', quality: 88 });
    console.log('wrote', c.out);
  }
  fs.unlinkSync(tmp);
  await browser.close();
})();
