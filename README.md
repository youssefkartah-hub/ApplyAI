# Youssef Kartah · engineering portfolio

A static portfolio site: a homepage, four case-study pages and a résumé page.
No framework, no backend, no trackers. The finished site is the `docs/` folder.

## Look at it

```bash
python3 -m http.server 8000 --directory docs
```

Then open http://localhost:8000. (Opening `docs/index.html` directly also works.)

## Where things live

| You want to change | Edit this |
| --- | --- |
| Name, email, LinkedIn, phone, location, availability line | `content/site.json` |
| Résumé PDF and site address | `content/site.json` (`resumePdf`, `url`) |
| The four projects on the homepage: order, titles, status, "my part", result | `content/projects.json` → `flagship` |
| The two small software entries | `content/projects.json` → `more` |
| Homepage text: intro, experience, about, tools | `content/pages/index.html` |
| A case study | `content/pages/work/<name>.html` |
| The résumé page | `content/pages/resume.html` |
| A drawing or chart | `content/figures/<name>.html` (inline SVG) |
| Header, footer, page `<head>` | `templates/layout.html` |
| Colours, type, spacing | `docs/assets/css/site.css` (tokens are at the top) |
| Photos and video | `docs/assets/media/` |

After any change in `content/` or `templates/`, rebuild:

```bash
node build.mjs
```

It needs Node 18 or newer and nothing else. The build rewrites the `.html`
files in `docs/`, then checks every local link, image and `#anchor` and fails
loudly if one is broken. Files in `docs/assets/` are edited in place and are
not generated.

## Common jobs

**Change contact details.** Edit `content/site.json` and rebuild. Leave
`phone` empty to keep it off the site; fill it in and it appears in the
contact list and on the résumé.

**Add your résumé PDF.** Put the file at `docs/resume.pdf`, set
`"resumePdf": "resume.pdf"` in `content/site.json`, rebuild. The résumé page
then shows a Download PDF button next to the print button. The résumé page
itself is `content/pages/resume.html`; it is laid out to print on one sheet.

**Edit a project card.** Each entry in `flagship` has `title`, `kicker`,
`status`, `summary`, `myPart`, `team`, `result` and `tools`. The same entry
feeds the homepage card, the header of the case study and the previous/next
links, so they cannot drift apart. `status.kind` is `progress` or `done`.

**Tag a number with where it came from.** In any page write
`{{ev measured}}`, `{{ev tested}}`, `{{ev simulated}}`, `{{ev calculated}}`,
`{{ev cad}}` or `{{ev estimate}}`. Add a custom label with
`{{ev measured "Flight logs"}}`. In `projects.json`, set `result.evidence`
to one of the same words.

**Add or replace a photo.**

1. Put the `.jpg` in `docs/assets/media/`.
2. Run `python3 tools/optimize_images.py` (needs `pip install pillow`). It
   writes smaller WebP copies and updates `content/media.json`.
3. Use it in a page: `{{pic src="my-photo.jpg" alt="What the photo shows"}}`.
4. Rebuild.

To wrap a photo in the framed figure style used across the site:

```html
<figure class="fig">
  <div class="plate">{{pic src="my-photo.jpg" alt="What the photo shows"}}</div>
  <figcaption class="plate-cap"><span>Fig. 1.5</span><span>Caption.</span><span>Photo</span></figcaption>
</figure>
```

**Add a case study.**

1. Copy an entry in `content/projects.json` → `flagship` and give it a new `slug`.
2. Copy `content/pages/work/line-follower.html` to `content/pages/work/<slug>.html`
   and rewrite it. Keep `{{case-head}}` at the top and `{{case-next}}` at the bottom.
3. Add a figure for the homepage card in `content/figures/` and point `figure` at it.
4. Rebuild.

**Refresh the link-preview images.** `node tools/make_og_images.cjs` redraws
the cards shown when a link is pasted into LinkedIn or a chat. It needs
Playwright (`npm i -D playwright && npx playwright install chromium`). Only
needed if a project title or result changes.

## Publish

The site is plain files, so any static host works. On GitHub Pages:
**Settings → Pages → Deploy from a branch → `main` → `/docs`**.

Then set `"url"` in `content/site.json` to the site's address (for example
`https://example.github.io/portfolio`) and rebuild. Link previews need that
absolute address; everything else on the site uses relative links and works
from any folder.

## Credits

Type: Newsreader, Geist and Geist Mono, self-hosted under the SIL Open Font
License. The licence texts are in `docs/assets/fonts/`.
