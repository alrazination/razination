# Razination

Website for Razination, a Munich studio that builds training simulations. Plain HTML, CSS and
JavaScript, no build step, no dependencies. Runs on GitHub Pages as is.

**Brand line:** *Fail here. Not on the job.* The reasoning behind every design decision is in
[`docs/DESIGN.md`](docs/DESIGN.md).

## Pages

| File | What it is |
|---|---|
| `index.html` | Home: hero with three playable simulations, slide 14, about, process, pricing, FAQ, contact form |
| `simulations.html` | All eight simulations: a 1280 × 720 player plus the full list (deep links: `simulations.html#flat-tire`) |
| `impressum.html`, `datenschutz.html` | Legal pages (German). **Fill in the yellow placeholders before publishing.** |

## Structure

```
css/site.css        All styles. Tokens and brand rules are at the top.
js/sims-data.js     The list of simulations (titles, mistake → consequence → lesson, readouts)
js/site.js          Stage player, replay, tabs, theater, slide 14, Gantt, contact form
sims/<slug>/        The simulations, each a 1280 × 720 page
img/thumbs/         <slug>-start.webp = opening screen, <slug>.webp = the mistake (both 1280 × 720)
img/og/             Link-preview images (1200 × 630). razination.jpg is the site's own
img/razin-*.webp    Portrait
fonts/              Archivo and Martian Mono, self-hosted (SIL OFL)
vendor/             three.js and fonts used inside the simulations
docs/DESIGN.md      Design decisions
```

## Add a simulation

1. Put it in `sims/<slug>/index.html`. It should be a 1280 × 720 page.
2. Add two screenshots at 1280 × 720: `img/thumbs/<slug>-start.webp` (opening screen) and `img/thumbs/<slug>.webp` (the moment of the mistake).
3. Add an entry to `js/sims-data.js`: `group: 'work'` or `'class'`, plus a `triad` of *you do / what happens / what sticks*.
4. Add a card for it in `simulations.html` (copy an existing `<a class="card">`).

To show a different simulation on the home page, change the three tab buttons in `index.html` (`data-sim="<slug>"`).

## Contact form

The form posts to [Web3Forms](https://web3forms.com). The `access_key` in `index.html` is the one from
the portfolio site, so messages currently go to the inbox registered with that key. To use a different
inbox, create a key at web3forms.com and replace the value of `access_key`. Also name the provider in the
yellow placeholder in `datenschutz.html`.

## Before publishing

- [ ] Fill in the yellow placeholders in `impressum.html` and `datenschutz.html`: address, email, phone, VAT ID, Web3Forms provider, supervisory authority, date.
- [ ] Check the `og:image` URLs in `index.html` and `simulations.html`. They assume `https://alrazination.github.io/razination/`.
- [ ] Optional: show an email address next to the form (search for `contact__alt` in `index.html`).

## Run locally

```
python3 -m http.server
```
Then open http://localhost:8000.
