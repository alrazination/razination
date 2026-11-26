# Razination

Website for Razination, a Munich studio that builds training simulations. Plain HTML, CSS and
JavaScript, with no dependencies. Runs on GitHub Pages as is.

**Brand line:** *Fail here. Not on the job.* The reasoning behind every design decision is in
[`docs/DESIGN.md`](docs/DESIGN.md).

## Admin panel

Open **`/admin/`** on the live site, e.g. https://alrazination.github.io/razination/admin/. It isn't linked
from the site and is hidden from search engines.

- **Sign in** with a GitHub fine-grained access key. In GitHub, go to Settings → Developer settings →
  Fine-grained tokens → Generate. Give it access to this repository only, with **Contents: Read and
  write**. The sign-in screen has the same steps.
- **Simulations**
  - Show or hide, reorder, and pick the one to three that appear on the home page.
  - Edit every line of text: card line, you do / what happens / what sticks, readout, descriptions.
  - Replace pictures. Uploads are cropped to 1280 × 720.
  - Replace a simulation, or add a new one (one HTML file, or a folder with an `index.html`).
  - Delete.
- **Home page:** headline (refitted to one line automatically), intro, facts, the facts strip, About
  (photo, quote, facts), the 5-week plan, the simulations-page header, footer line and page titles.
- **Pricing & FAQ:** the three packages, terms, and questions (add, reorder, delete).
- **Contact & legal:**
  - Email, phone, LinkedIn, booking link and the Web3Forms key.
  - Contact section text.
  - Every field of the Impressum and Datenschutz. Empty fields show as yellow placeholders.
  - The site address used for link previews.
- **Preview** opens the home page with your unpublished changes.
- **Publish changes** makes one commit to the branch GitHub Pages publishes (default `main`). The site
  updates about a minute later.

The panel reads its content from `data/site.json` on the chosen branch, so the redesign has to be merged
into that branch first. To use another branch, open *Repository settings* on the sign-in screen.

### How publishing works

The pages stay plain static HTML, which keeps them fast and readable by search engines and link previews.
Every editable part of a page sits between markers:

```html
<!--@pricing--> … <!--/@pricing-->
```

On Publish, the admin renders those parts from `data/site.json` with `js/render.js` and commits the data,
the pages, `js/sims-data.js` and any uploads together. Edit inside the markers only through the admin,
or `data/site.json`: hand edits there are overwritten on the next publish. Everything outside the markers
(e.g. the Slide 14 section, the header, the styles) is ordinary HTML you can edit by hand.

If you edit `data/site.json` by hand, run `node tools/build.js` to rebuild the pages.

## Pages

| File | What it is |
|---|---|
| `index.html` | Home: hero with three playable simulations, slide 14, about, process, pricing, FAQ, contact form |
| `simulations.html` | All simulations: a 1280 × 720 player plus the full list (deep links: `simulations.html#flat-tire`) |
| `impressum.html`, `datenschutz.html` | Legal pages (German), filled from the admin |

## Structure

```
admin/              The admin panel
data/site.json      All editable content (written by the admin)
js/render.js        Turns site.json into the pages' editable parts (used by the admin and tools/build.js)
js/sims-data.js     Generated list of the shown simulations, read by the player
js/site.js          Stage player, replay, tabs, theater, slide 14, Gantt, contact form
css/site.css        All styles. Tokens and brand rules are at the top
sims/<slug>/        The simulations, each a 1280 × 720 page
img/thumbs/         1280 × 720 pictures per simulation: opening screen, your move, what happens
img/og/             Link-preview image (1200 × 630)
fonts/              Archivo and Martian Mono, self-hosted (SIL OFL)
vendor/             three.js and fonts used inside the simulations
tools/build.js      Rebuild the pages from data/site.json without the admin
docs/DESIGN.md      Design decisions
```

## Contact form

The form posts to [Web3Forms](https://web3forms.com). The key currently set is the one from the portfolio
site, so messages go to the inbox registered with that key. To use another inbox, create a key at
web3forms.com and paste it into the admin under *Contact & legal*. With no key, the form opens the
visitor's email app instead, addressed to the email you set.

## Before going live

- [ ] Admin → Contact & legal: fill in email, address, VAT ID (or tick "Keine USt-IdNr."), hosting and
  Web3Forms details, supervisory authority and date. Then have the legal text checked.
- [ ] Admin → Contact & legal → Site address: check it matches where the site is published.

## Run locally

```
python3 -m http.server
```
Then open http://localhost:8000. The admin also runs locally, but it always reads and writes the GitHub repository.
