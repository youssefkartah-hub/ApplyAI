#!/usr/bin/env node
/*
  Builds the portfolio into docs/.   Run:  node build.mjs

  Reads   content/site.json       name, contact links, résumé PDF, site URL
          content/projects.json   the project list (order, status, card copy)
          content/pages/**.html   page bodies
          content/figures/*.html  drawings and charts, included by pages
          templates/layout.html   the shell around every page
  Writes  docs/**.html            (assets in docs/assets are edited in place)

  No dependencies. Node 18 or newer.
*/
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'docs');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));

const site = json('content/site.json');
const projects = json('content/projects.json');
const media = fs.existsSync(path.join(ROOT, 'content/media.json')) ? json('content/media.json') : {};
const layout = read('templates/layout.html');
const warnings = [];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hash = (file) => crypto.createHash('sha1').update(fs.readFileSync(path.join(OUT, file))).digest('hex').slice(0, 8);
const siteUrl = (site.url || '').replace(/\/+$/, '');

/* ---------- evidence tags: where a number came from ---------- */
const EVIDENCE = {
  measured: 'Measured',
  tested: 'Tested on hardware',
  simulated: 'Simulated',
  calculated: 'Calculated',
  cad: 'From CAD',
  estimate: 'Estimate, untested',
};
function ev(kind, label) {
  if (!EVIDENCE[kind]) warnings.push(`unknown evidence tag "${kind}"`);
  return `<span class="ev ev-${kind}">${esc(label || EVIDENCE[kind] || kind)}</span>`;
}

/* ---------- responsive pictures ---------- */
function attrs(str) {
  const out = {};
  for (const m of str.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) out[m[1]] = m[2] === undefined ? true : m[2];
  return out;
}
function pic(a, root) {
  const file = a.src;
  const info = media[file];
  const src = `${root}assets/media/${file}`;
  const common = `alt="${esc(a.alt || '')}"${a.class ? ` class="${a.class}"` : ''} ${a.eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"`;
  if (a.alt === undefined) warnings.push(`image ${file} has no alt text`);
  if (!info) {
    warnings.push(`image ${file} is not in content/media.json (run tools/optimize_images.py)`);
    return `<img src="${src}" ${common}>`;
  }
  const stem = file.replace(/\.[^.]+$/, '');
  const srcset = info.webp.map((w) => `${root}assets/media/${stem}-${w}.webp ${w}w`).join(', ');
  const sizes = a.sizes || '(min-width: 1100px) 50vw, 100vw';
  return `<picture><source type="image/webp" srcset="${srcset}" sizes="${sizes}"><img src="${src}" width="${info.w}" height="${info.h}" ${common}></picture>`;
}

/* ---------- blocks generated from projects.json ---------- */
const statusPill = (s) => `<span class="status status-${s.kind}"><b>${esc(s.label)}</b>${s.detail ? ` <span>${esc(s.detail)}</span>` : ''}</span>`;

function workList(root) {
  return projects.flagship.map((p, i) => `
<article class="feature${i % 2 ? ' flip' : ''}" aria-labelledby="w-${p.slug}">
  <a class="feature-fig" href="${root}work/${p.slug}.html" tabindex="-1" aria-hidden="true">
    <div class="plate${p.figureClass ? ` ${p.figureClass}` : ''}">{{include ${p.figure}}}</div>
    <p class="plate-cap"><span>Fig. ${p.number}</span><span>${esc(p.figureCaption)}</span><span>${esc(p.figureKind)}</span></p>
  </a>
  <div class="feature-body">
    <p class="kicker"><b>${p.number}</b>${p.kicker.map((k) => `<span>${esc(k)}</span>`).join('')}</p>
    <h3 id="w-${p.slug}"><a href="${root}work/${p.slug}.html">${esc(p.title)}</a></h3>
    <p class="feature-sum">${esc(p.summary)}</p>
    <dl class="feature-facts">
      <div><dt>My part</dt><dd>${esc(p.myPart)}</dd></div>
      <div><dt>Result</dt><dd><strong class="num">${esc(p.result.value)}</strong> ${esc(p.result.text)} ${ev(p.result.evidence)}</dd></div>
      <div><dt>Status</dt><dd>${statusPill(p.status)}</dd></div>
    </dl>
    <a class="more" href="${root}work/${p.slug}.html">Read the case study<span aria-hidden="true"> →</span><span class="vh">: ${esc(p.title)}</span></a>
  </div>
</article>`).join('\n');
}

function moreWork(root) {
  return projects.more.map((m) => `
<article class="mini">
  <div class="mini-img">{{pic src="${m.image}" alt="${esc(m.alt)}" sizes="(min-width: 900px) 280px, 100vw"}}</div>
  <div class="mini-body">
    <p class="kicker"><span>${esc(m.kind)}</span><span>${esc(m.status)}</span></p>
    <h3>${esc(m.title)}</h3>
    <p>${esc(m.text)}</p>
    <p class="mini-result">${esc(m.result)}</p>
    <p class="tools">${esc(m.tools)}</p>
  </div>
</article>`).join('\n');
}

function caseHead(p, page, root) {
  return `
<header class="case-head">
  <div class="wrap">
    <p class="crumb"><a href="${root}index.html#work">Selected work</a><span aria-hidden="true">/</span><span>${p.number} of ${String(projects.flagship.length).padStart(2, '0')}</span></p>
    <div class="case-head-grid">
      <div>
        <p class="kicker">${p.kicker.map((k) => `<span>${esc(k)}</span>`).join('')}</p>
        <h1>${esc(p.title)}</h1>
        <p class="lede">${page.lede || esc(p.summary)}</p>
      </div>
      <dl class="spec">
        <div><dt>Status</dt><dd>${statusPill(p.status)}</dd></div>
        <div><dt>My part</dt><dd>${esc(p.myPart)}</dd></div>
        <div><dt>Team</dt><dd>${esc(p.team)}</dd></div>
        <div><dt>Tools</dt><dd>${p.tools.map(esc).join(' · ')}</dd></div>
      </dl>
    </div>
  </div>
</header>`;
}

function caseNext(p, root) {
  const list = projects.flagship;
  const i = list.indexOf(p);
  const prev = list[(i - 1 + list.length) % list.length];
  const next = list[(i + 1) % list.length];
  return `
<nav class="case-next" aria-label="More case studies">
  <div class="wrap">
    <a href="${root}work/${prev.slug}.html"><span class="k">← Previous · ${prev.number}</span><b>${esc(prev.title)}</b></a>
    <a href="${root}work/${next.slug}.html" class="nx"><span class="k">Next · ${next.number} →</span><b>${esc(next.title)}</b></a>
  </div>
</nav>`;
}

/* ---------- résumé buttons ---------- */
function resumeActions(root) {
  const pdf = site.resumePdf
    ? `<a class="btn btn-primary" href="${root}${site.resumePdf}" download>Download PDF</a>`
    : '';
  return `${pdf}<button class="btn${pdf ? '' : ' btn-primary'}" type="button" data-print>Print or save as PDF</button>`;
}

/* ---------- template engine: {{token}} replacement ---------- */
function render(src, ctx, depth = 0) {
  if (depth > 6) throw new Error('include loop');
  let out = src.replace(/\{\{include ([^}]+)\}\}/g, (_, f) => render(read(`content/${f.trim()}`), ctx, depth + 1));
  out = out.replace(/\{\{work-list\}\}/g, () => render(workList(ctx.root), ctx, depth + 1));
  out = out.replace(/\{\{more-work\}\}/g, () => render(moreWork(ctx.root), ctx, depth + 1));
  out = out.replace(/\{\{case-head\}\}/g, () => caseHead(ctx.project, ctx.page, ctx.root));
  out = out.replace(/\{\{case-next\}\}/g, () => caseNext(ctx.project, ctx.root));
  out = out.replace(/\{\{resume-actions\}\}/g, () => resumeActions(ctx.root));
  out = out.replace(/\{\{pic ([^}]+)\}\}/g, (_, a) => pic(attrs(a), ctx.root));
  out = out.replace(/\{\{ev (\w+)(?: "([^"]*)")?\}\}/g, (_, k, label) => ev(k, label));
  out = out.replace(/\{\{if ([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, body) => (lookup(ctx, key) ? body : ''));
  out = out.replace(/\{\{([\w.]+)\}\}/g, (m, key) => {
    const v = lookup(ctx, key);
    if (v === undefined) { warnings.push(`unknown token ${m}`); return ''; }
    return v;
  });
  return out;
}
function lookup(ctx, key) {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), ctx);
}

/* ---------- pages ---------- */
function frontMatter(src) {
  const m = src.match(/^<!--\n([\s\S]*?)\n-->\n?/);
  const meta = {};
  if (!m) return { meta, body: src };
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: src.slice(m[0].length) };
}
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.html') ? [path.join(dir, e.name)] : []);
}

const pagesDir = path.join(ROOT, 'content/pages');
const assetV = { css: hash('assets/css/site.css'), js: hash('assets/js/site.js') };
const built = [];

for (const file of walk(pagesDir)) {
  const rel = path.relative(pagesDir, file).split(path.sep).join('/');
  const { meta, body } = frontMatter(fs.readFileSync(file, 'utf8'));
  const depth = rel.split('/').length - 1;
  const root = '../'.repeat(depth);
  const project = projects.flagship.find((p) => `work/${p.slug}.html` === rel);
  const title = meta.title || (project && project.title) || site.name;
  const isHome = rel === 'index.html';
  const page = {
    ...meta,
    path: rel,
    fullTitle: isHome ? `${site.name} · ${site.tagline}` : `${title} · ${site.name}`,
    ogTitle: isHome ? site.name : title,
    description: meta.description || (project && project.summary) || site.description,
    bodyClass: meta.class || (project ? 'case' : 'page'),
    ogImage: (project && project.og) || meta.og || 'og-home.jpg',
    section: isHome ? 'home' : project ? 'work' : meta.section || '',
  };
  /* Social previews need absolute URLs. Until site.url is set they are written relative. */
  page.url = siteUrl ? `${siteUrl}/${isHome ? '' : rel}` : '';
  page.ogImageUrl = siteUrl ? `${siteUrl}/assets/media/${page.ogImage}` : `${root}assets/media/${page.ogImage}`;
  page.canonical = page.url ? `<link rel="canonical" href="${page.url}">\n<meta property="og:url" content="${page.url}">` : '';
  page.robots = meta.noindex ? '<meta name="robots" content="noindex">' : '';
  page.cur = { work: '', about: '', resume: '', contact: '' };
  if (page.section in page.cur) page.cur[page.section] = ' aria-current="page"';
  if (page.section === 'work') page.cur.work = ' aria-current="true"';

  const ctx = { site, page, project, root, v: assetV, year: new Date().getFullYear() };
  ctx.content = render(body, ctx);
  const html = render(layout, ctx).replace(/[ \t]+$/gm, '');
  const outFile = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html);
  built.push({ rel, html });
}

/* ---------- check every local link, image and anchor ---------- */
const ids = Object.fromEntries(built.map((b) => [b.rel, new Set([...b.html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))]));
let broken = 0;
for (const { rel, html } of built) {
  const refs = [...html.matchAll(/\s(?:href|src|poster)="([^"]+)"/g)].map((m) => m[1]);
  for (const m of html.matchAll(/\ssrcset="([^"]+)"/g)) refs.push(...m[1].split(',').map((s) => s.trim().split(' ')[0]));
  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|data:)/.test(ref)) continue;
    const [p, frag] = ref.split('#');
    const target = p ? path.posix.normalize(path.posix.join(path.posix.dirname(rel), p.split('?')[0])) : rel;
    if (!fs.existsSync(path.join(OUT, target))) { console.error(`BROKEN  ${rel} -> ${ref}`); broken++; continue; }
    if (frag && ids[target] && !ids[target].has(frag)) { console.error(`BROKEN  ${rel} -> ${ref} (no element with id="${frag}")`); broken++; }
  }
}

for (const w of [...new Set(warnings)]) console.warn(`warning: ${w}`);
if (!siteUrl) console.warn('note: site.url is empty in content/site.json, so social preview images use relative URLs. Set it once the site has an address.');
console.log(`built ${built.length} pages into docs/${broken ? `, ${broken} broken link(s)` : ', all local links resolve'}`);
if (broken) process.exit(1);
