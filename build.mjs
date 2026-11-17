#!/usr/bin/env node
/*
  Builds the portfolio into docs/.   Run:  node build.mjs

  Reads   content/site.json       name, contact links, résumé PDF, site URL
          content/projects.json   the projects, in the order they are shown
          content/pages/**.html   page bodies
          content/figures/*.html  drawings and charts, included by pages
          content/media.json      image sizes (written by tools/optimize_images.py)
          templates/layout.html   the shell around every page
  Writes  docs/**.html            (docs/assets is edited in place)

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
const { projects } = json('content/projects.json');
const media = fs.existsSync(path.join(ROOT, 'content/media.json')) ? json('content/media.json') : {};
const layout = read('templates/layout.html');
const warnings = [];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hash = (file) => crypto.createHash('sha1').update(fs.readFileSync(path.join(OUT, file))).digest('hex').slice(0, 8);
const siteUrl = (site.url || '').replace(/\/+$/, '');
const ARROW = '<svg class="ar" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';
const BACK = '<svg class="ar" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H6M11 6l-6 6 6 6"/></svg>';

/* ---------- evidence tags: where a number came from ---------- */
const EVIDENCE = {
  measured: 'Measured',
  tested: 'Tested on hardware',
  simulated: 'Simulated',
  calculated: 'Calculated',
  cad: 'From CAD',
  reported: 'My own record',
  estimate: 'Estimate, untested',
};
function ev(kind, label) {
  if (!EVIDENCE[kind]) warnings.push(`unknown evidence tag "${kind}"`);
  return `<span class="ev ev-${kind}">${esc(label || EVIDENCE[kind] || kind)}</span>`;
}

/* ---------- images ---------- */
function attrs(str) {
  const out = {};
  for (const m of str.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) out[m[1]] = m[2] === undefined ? true : m[2];
  return out;
}
const stemOf = (f) => f.replace(/\.[^.]+$/, '');
function webp(stem, w) { return `assets/media/${stem}-${w}.webp`; }
function pic(a, root) {
  const stem = stemOf(a.src);
  const info = media[stem];
  if (a.alt === undefined) warnings.push(`image ${a.src} has no alt text`);
  if (!info) { warnings.push(`image ${a.src} is not in content/media.json (run tools/optimize_images.py)`); return ''; }
  const srcset = info.widths.map((w) => `${root}${webp(stem, w)} ${w}w`).join(', ');
  const sizes = a.sizes || '(min-width: 1100px) 50vw, 100vw';
  const cls = a.class ? ` class="${a.class}"` : '';
  const load = a.eager ? 'fetchpriority="high"' : 'loading="lazy"';
  return `<img src="${root}${webp(stem, info.w)}" srcset="${srcset}" sizes="${sizes}" width="${info.w}" height="${info.h}" alt="${esc(a.alt || '')}"${cls} ${load} decoding="async">`;
}
function posterUrl(file, root) {
  const info = media[stemOf(file)];
  if (!info) { warnings.push(`poster ${file} is not in content/media.json`); return ''; }
  return root + webp(stemOf(file), info.w);
}

/* ---------- blocks generated from projects.json ---------- */
const statusPill = (s) => `<span class="status status-${s.kind}"><b>${esc(s.label)}</b>${s.detail ? ` <span>${esc(s.detail)}</span>` : ''}</span>`;

function rowMedia(p, root) {
  const m = p.media;
  if (m.type === 'video') {
    return `<div class="row-media"><video src="${root}${m.src}" poster="${posterUrl(m.poster, root)}" width="${m.w}" height="${m.h}" muted loop playsinline preload="none" data-preview aria-label="${esc(m.alt)}"></video></div>`;
  }
  if (m.type === 'figure') {
    return `<div class="row-media draw" role="img" aria-label="${esc(m.alt)}">{{include ${m.include}}}</div>`;
  }
  return `<div class="row-media">${pic({ src: m.src, alt: m.alt, sizes: '(min-width: 900px) 42vw, 100vw' }, root)}</div>`;
}

function projectRows(root) {
  return projects.map((p) => `
<article class="row" aria-labelledby="p-${p.slug}">
  <div class="row-in">
    <div class="row-text">
      <p class="row-kind">${p.kind.map(esc).join(' · ')}</p>
      <h2 id="p-${p.slug}">${esc(p.title)}</h2>
      <p class="desc">${esc(p.desc)}</p>
      <p class="meta">${statusPill(p.status)}<span class="tools">${p.tools.slice(0, 4).map(esc).join(' · ')}</span></p>
      <a class="pill" href="${root}work/${p.slug}.html" data-go>Learn more<span class="vh"> about ${esc(p.title)}</span><span class="pill-ar" aria-hidden="true">${ARROW}</span></a>
    </div>
    ${rowMedia(p, root)}
  </div>
</article>`).join('\n');
}

function caseHead(p, page, root) {
  return `
<header class="ph">
  <div class="wrap">
    <p class="row-kind">${p.kind.map(esc).join(' · ')}</p>
    <h1>${esc(p.headline)}</h1>
    <p class="lede">${page.lede || esc(p.desc)}</p>
    <dl class="spec">
      <div><dt>Status</dt><dd>${statusPill(p.status)}</dd></div>
      <div><dt>My part</dt><dd>${esc(p.myPart)}</dd></div>
      <div><dt>Team</dt><dd>${esc(p.team)}</dd></div>
      <div><dt>Tools</dt><dd>${p.tools.map(esc).join(' · ')}</dd></div>
    </dl>
  </div>
</header>`;
}

function caseNext(p, root) {
  const i = projects.indexOf(p);
  const next = projects[(i + 1) % projects.length];
  const prev = projects[(i - 1 + projects.length) % projects.length];
  return `
<nav class="next" aria-label="More projects">
  <a class="next-main" href="${root}work/${next.slug}.html" data-go>
    <span class="next-k">Next project</span>
    <span class="next-t">${esc(next.title)}</span>
    <span class="next-d">${esc(next.desc)}</span>
    <span class="next-ar" aria-hidden="true">${ARROW}</span>
  </a>
  <div class="next-side"><a href="${root}work/${prev.slug}.html" data-go><span>Previous</span> ${esc(prev.title)}</a><a href="${root}projects.html" data-go><span>All projects</span> Back to the list</a></div>
</nav>`;
}

/* ---------- template engine: {{token}} replacement ---------- */
function render(src, ctx, depth = 0) {
  if (depth > 6) throw new Error('include loop');
  let out = src.replace(/\{\{include ([^}]+)\}\}/g, (_, f) => render(read(`content/${f.trim()}`), ctx, depth + 1));
  out = out.replace(/\{\{project-rows\}\}/g, () => render(projectRows(ctx.root), ctx, depth + 1));
  out = out.replace(/\{\{case-head\}\}/g, () => caseHead(ctx.project, ctx.page, ctx.root));
  out = out.replace(/\{\{case-next\}\}/g, () => caseNext(ctx.project, ctx.root));
  out = out.replace(/\{\{pic ([^}]+)\}\}/g, (_, a) => pic(attrs(a), ctx.root));
  out = out.replace(/\{\{poster ([^}]+)\}\}/g, (_, f) => posterUrl(f.trim(), ctx.root));
  out = out.replace(/\{\{ev (\w+)(?: "([^"]*)")?\}\}/g, (_, k, label) => ev(k, label));
  out = out.replace(/\{\{arrow\}\}/g, ARROW);
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

function bar(kind, root, withContact) {
  const resume = `<a class="bar-link" href="${root}${site.resumePdf}" target="_blank" rel="noopener">Résumé</a>` + (withContact ? '<a class="bar-link" href="#contact">Contact</a>' : '');
  if (kind === 'none') return '';
  if (kind === 'case') {
    return `<header class="bar"><div class="bar-in"><a class="back" href="${root}projects.html" data-go>${BACK}<span>Projects</span></a><a class="bar-name" href="${root}index.html" data-go>${esc(site.name)}</a><nav aria-label="Main">${resume}</nav></div><div class="progress" aria-hidden="true"></div></header>`;
  }
  return `<header class="bar"><div class="bar-in"><a class="bar-name" href="${root}index.html" data-go>${esc(site.name)}</a><nav aria-label="Main">${resume}</nav></div></header>`;
}

const pagesDir = path.join(ROOT, 'content/pages');
const assetV = { css: hash('assets/css/site.css'), js: hash('assets/js/site.js') };
const built = [];
const order = projects.map((p) => `work/${p.slug}.html`);

for (const file of walk(pagesDir)) {
  const rel = path.relative(pagesDir, file).split(path.sep).join('/');
  const { meta, body } = frontMatter(fs.readFileSync(file, 'utf8'));
  const depth = rel.split('/').length - 1;
  const root = '../'.repeat(depth);
  const project = projects.find((p) => `work/${p.slug}.html` === rel);
  const title = meta.title || (project && project.headline) || site.name;
  const isHome = rel === 'index.html';
  const barKind = meta.bar || (project ? 'case' : 'plain');
  const page = {
    ...meta,
    path: rel,
    fullTitle: isHome ? `${site.name} · Aerospace engineering portfolio` : `${title} · ${site.name}`,
    ogTitle: isHome ? site.name : title,
    description: meta.description || (project && project.desc) || site.description,
    bodyClass: meta.class || (project ? 'case' : 'page'),
    ogImage: (project && project.og) || meta.og || 'og-home.jpg',
    footer: barKind !== 'none' && !meta.nofooter ? '1' : '',
  };
  page.bar = bar(barKind, root, !!page.footer);
  page.url = siteUrl ? `${siteUrl}/${isHome ? '' : rel}` : '';
  page.ogImageUrl = siteUrl ? `${siteUrl}/assets/media/${page.ogImage}` : `${root}assets/media/${page.ogImage}`;
  page.canonical = page.url ? `<link rel="canonical" href="${page.url}">\n<meta property="og:url" content="${page.url}">` : '';
  page.robots = meta.noindex ? '<meta name="robots" content="noindex">' : '';

  const ctx = { site, page, project, root, v: assetV, year: new Date().getFullYear() };
  ctx.content = render(body, ctx);
  const html = render(layout, ctx).replace(/[ \t]+$/gm, '');
  const outFile = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html);
  built.push({ rel, html });
}

/* every project in projects.json needs a page */
for (const rel of order) if (!built.some((b) => b.rel === rel)) warnings.push(`projects.json lists ${rel} but content/pages/${rel} does not exist`);

/* remove pages that are no longer built */
(function clean() {
  const keep = new Set(built.map((b) => b.rel));
  for (const f of walk(OUT)) {
    const rel = path.relative(OUT, f).split(path.sep).join('/');
    if (!keep.has(rel)) { fs.unlinkSync(f); console.log(`removed stale ${rel}`); }
  }
})();

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
