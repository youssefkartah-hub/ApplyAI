# Youssef Kartah · engineering portfolio

A static portfolio site. No framework, no backend, no trackers.

- **Home** (`index.html`): name, a short introduction, résumé and ways to connect. One scroll down is a single **Projects** button.
- **Projects** (`projects.html`): all eight projects, each with a short description and a **Learn more** button.
- **Eight case-study pages** (`work/<name>.html`), one per project.

The finished site is the `docs/` folder.

## Look at it

```bash
python3 -m http.server 8000 --directory docs
```

Then open http://localhost:8000.

## Where things live

| You want to change | Edit this |
| --- | --- |
| Name, email, LinkedIn, phone, location, availability line | `content/site.json` |
| Résumé PDF | replace `docs/Youssef_Kartah_Resume.pdf` (keep the name) |
| Site address (for link previews) | `url` in `content/site.json` |
| Project order, titles, one-paragraph descriptions, status | `content/projects.json` |
| The home page text | `content/pages/index.html` |
| The Projects list heading | `content/pages/projects.html` |
| A case study | `content/pages/work/<name>.html` |
| A drawing or chart | `content/figures/<name>.html` (inline SVG) |
| Header, footer, page `<head>` | `templates/layout.html` |
| Colours, type, spacing, motion | `docs/assets/css/site.css` (tokens at the top) |
| Interactions | `docs/assets/js/site.js` |
| Original photos | `media-src/` (not published) |
| Published photos and video | `docs/assets/media/` |

After any change in `content/` or `templates/`, rebuild:

```bash
node build.mjs
```

Needs Node 18 or newer and nothing else. The build rewrites the `.html` files
in `docs/`, then checks every local link, image and `#anchor` and fails loudly
if one is broken. Files in `docs/assets/` are edited in place and not generated.

## Project order

Projects appear in the order they are listed in `content/projects.json`, and
the "next project" link at the bottom of each case study follows the same order.
The current order runs from the project with the most footage and documentation
to the one with the least. To reorder, move an entry up or down and rebuild.

## Common jobs

**Change contact details.** Edit `content/site.json` and rebuild. Leave `phone`
empty to keep it off the site.

**Replace the résumé.** Overwrite `docs/Youssef_Kartah_Resume.pdf` with the new
file. Nothing needs rebuilding.

**Edit a project card.** Each entry in `projects.json` has `title`, `headline`,
`kind`, `status`, `desc`, `myPart`, `team`, `tools`, `media` and `result`. The
same entry feeds the Projects list, the header of the case study and the
next-project link. `status.kind` is `progress` or `done`. `media` picks what
shows beside the description: a `video` (plays on hover), an `image`, or a
`figure` (an SVG from `content/figures/`).

**Tag a number with where it came from.** In any page write `{{ev measured}}`,
`{{ev tested}}`, `{{ev simulated}}`, `{{ev calculated}}`, `{{ev cad}}`,
`{{ev reported}}` or `{{ev estimate}}`. Add a custom label with
`{{ev measured "Flight logs"}}`.

**Add or replace a photo.**

1. Put the `.jpg` in `media-src/`.
2. Run `python3 tools/optimize_images.py` (needs `pip install pillow`). It writes
   WebP copies into `docs/assets/media/` and updates `content/media.json`.
3. Use it in a page: `{{pic src="my-photo.jpg" alt="What the photo shows"}}`.
4. Rebuild.

To wrap a photo in the site's figure style:

```html
<figure class="fig">
  <div class="plate">{{pic src="my-photo.jpg" alt="What the photo shows"}}</div>
  <figcaption class="plate-cap"><span>Fig. 1</span><span>Caption.</span><span>Photo</span></figcaption>
</figure>
```

**Add a project.**

1. Add an entry to `content/projects.json` with a new `slug`, in the position it should appear.
2. Copy `content/pages/work/safran.html` to `content/pages/work/<slug>.html` and rewrite it. Keep `{{case-head}}` at the top and `{{case-next}}` at the bottom.
3. Rebuild, then `node tools/make_og_images.cjs` for its link-preview card.

**Refresh the link-preview images.** `node tools/make_og_images.cjs` redraws the
cards shown when a link is pasted into LinkedIn or a chat. It needs Playwright
(`npm i -D playwright && npx playwright install chromium`).

## Publish

The site is plain files, so any static host works. On GitHub Pages:
**Settings → Pages → Deploy from a branch → `main` → `/docs`**.

Then set `"url"` in `content/site.json` to the site's address and rebuild. Link
previews need that absolute address; everything else uses relative links and
works from any folder.

## Motion

Page transitions, the cover animation and scroll reveals are in
`docs/assets/js/site.js` and `site.css`. All of it switches off for visitors who
ask their device for reduced motion, and every page reads correctly with
JavaScript turned off.

## Credits

Type: Archivo, self-hosted under the SIL Open Font License. The licence text is
in `docs/assets/fonts/`.
