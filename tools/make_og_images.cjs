#!/usr/bin/env node
/*
  Optional: redraws the social preview images (the card shown when a link to the
  site is pasted into LinkedIn, Slack, iMessage and so on).

      node tools/make_og_images.cjs

  Run it after changing a project title or result in content/projects.json.
  Needs Playwright with Chromium:  npm i -D playwright && npx playwright install chromium
  Output: docs/assets/media/og-home.jpg and one og-<slug>.jpg per case study.
*/
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/site.json'), 'utf8'));
const projects = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/projects.json'), 'utf8'));
const fig = (f) => fs.readFileSync(path.join(ROOT, 'content', f), 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/* What sits in the right-hand panel of each card. */
const visuals = {
  home: '<img src="assets/media/uav-build-poster.jpg" alt="">',
  marv: `<div class="draw">${fig('figures/marv-pickups.html').split('</svg>')[1]}</svg></div>`,
  'uav-builds': '<img src="assets/media/uav-parts.jpg" alt="" style="object-position:38% 50%">',
  analysis: `<div class="draw wide">${fig('figures/home-analysis.html')}</div>`,
  'line-follower': '<img src="assets/media/lf-robot.jpg" alt="">',
};

function card({ kicker, title, line, visual }) {
  return `<!doctype html><html><head><meta charset="utf-8"><base href="file://${DOCS}/">
<link rel="stylesheet" href="assets/css/site.css">
<style>
  html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:var(--paper)}
  .og{display:grid;grid-template-columns:660px 1fr;height:630px}
  .l{padding:56px 44px 52px 64px;display:flex;flex-direction:column}
  .k{font:500 17px/1.4 var(--f-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
  h1{font-size:${title.length > 42 ? 58 : title.length > 22 ? 68 : 104}px;line-height:1;letter-spacing:-.03em;margin:26px 0 0}
  .line{margin-top:auto;font-size:25px;line-height:1.35;color:var(--ink-2);border-top:1.5px solid var(--ink);padding-top:22px}
  .line b{font:500 25px var(--f-mono);letter-spacing:-.03em;color:var(--accent-ink)}
  .r{border-left:1.5px solid var(--ink);background:var(--sheet);position:relative;overflow:hidden}
  .r img{width:100%;height:100%;object-fit:cover}
  .draw{position:absolute;inset:0;display:grid;place-items:center;padding:34px 70px}
  .draw svg{height:100%;width:auto}
  .draw.wide{padding:44px 40px;place-items:center stretch}
  .draw.wide .chartcard{width:100%}
</style></head><body><div class="og">
  <div class="l"><p class="k">${esc(kicker)}</p><h1>${esc(title)}</h1><p class="line">${line}</p></div>
  <div class="r">${visual}</div>
</div></body></html>`;
}

(async () => {
  const cards = [{
    out: 'og-home.jpg',
    html: card({
      kicker: 'Engineering portfolio',
      title: site.name,
      line: `${esc(site.tagline)}.<br>Aerospace engineering, Penn State, May 2027.`,
      visual: visuals.home,
    }),
  }];
  for (const p of projects.flagship) {
    cards.push({
      out: p.og,
      html: card({
        kicker: `${site.name} · case study ${p.number}`,
        title: p.title,
        line: `<b>${esc(p.result.value)}</b> ${esc(p.result.text)}`,
        visual: visuals[p.slug] || '',
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
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(DOCS, 'assets/media', c.out), type: 'jpeg', quality: 88 });
    console.log('wrote', c.out);
  }
  fs.unlinkSync(tmp);
  await browser.close();
})();
