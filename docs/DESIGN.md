# Razination: design decisions

> **Update: version 2 ("Black box").** The owner found version 1 too quiet and asked for a "wow" site
> without the 1280 px frame. Version 2 keeps the brand idea (*Fail here. Not on the job.*), the
> flight-recorder orange and Archivo, but rebuilds everything else around **real footage**:
>
> - The **hero** is a tilted, glowing screen playing recordings of the actual mistakes, back to back: the
>   fat-pan fireball, the phishing click spreading across the network, 1,800 customers leaving the
>   building, the car rolling off the jack, and the contaminated cleanroom suit. Each is recorded from the
>   simulations themselves. A live REC timecode, captions synced to each clip and an orange flash on every
>   consequence sit on top, and the footage also lights the room behind it.
> - A **pinned scroll story** tilts "slide 14 of 38" away and replaces it with the real flat-tire footage.
> - **Cards** play their footage on hover and tilt toward the cursor. Every simulation opens in a full-screen
>   **cinema player**, scaled to fit any screen.
> - **Layout and type:** the page is dark, full-bleed, with film grain, glowing type, a 5-step timeline that
>   draws in as you scroll, and a giant outlined wordmark in the footer.
> - **Reduced motion:** with `prefers-reduced-motion`, nothing autoplays and the story becomes a static sequence.
>
> The reasoning below is the record of version 1. Its content decisions (honesty, no invented proof,
> pricing, contact) still apply.

How the redesign was decided. Four expert reviewers argued a first direction from their own point of
view, disagreements were settled one by one, and a second round reviewed the built site.

**The panel**
- **Brand director**: identity, distinctiveness, anything that looks generic or AI-made.
- **L&D buyer + conversion specialist**: a sceptical Head of L&D at a 2,000-person German manufacturer, plus a B2B conversion lens.
- **UX, accessibility and motion**: WCAG 2.2 AA, interaction design, performance.
- **Copy chief**: short, concrete, plain English that non-native readers understand.

**Research inputs**: interactive-demo landing pages (Brilliant's "try it before you sign up" hero),
B2B service-site conversion patterns (problem-first hero, proof where buyers hesitate, visible pricing),
and published "AI slop" catalogues (purple gradients, recoloured headline words, fade-ups everywhere,
icon-card grids, before/after sliders, generic copy).

---

## 1. Brand idea

**"Fail here. Not on the job."** Razination is the safe place to make the mistake.

- Copy chief: keep it. It's six words in two beats, with one promise. "Fail" is understood in German too.
- Buyer: on its own it could be a flight school's line, so the sub-line must say what is sold:
  *Training simulations for safety, compliance and IT security.*
- **Decision:** keep the line, and put the product name, the audience and the person behind it in the first screen.

## 2. Colour

| Proposal | Objection | Decision |
|---|---|---|
| Orange brand, plus signal green for "the right way" | Brand: orange + green is a traffic-light cliché. UX: red-green colour blindness can't tell them apart | **No green.** Two colours on paper and ink |
| Orange everywhere as the accent | Brand: if everything is orange, nothing is | **Orange = the mistake**, plus one main button per screen |
| Orange text and focus rings on paper | UX: #FF4F00 on paper is 2.9:1 and fails | Orange only as a fill with ink text (5.9:1). Text-orange is `#B83800`. Focus rings are ink on paper and orange on ink |

The orange is flight-recorder orange. Flight recorders are painted orange so they can be found after
something goes wrong. The footer says: *"Ours is for before."*

## 3. Type

- First pick: an expanded grotesk. Brand: too close to the portfolio's Unbounded.
- **Decision:** **Archivo condensed 800** for headlines. It has the energy of a warning placard, and the
  hero line fits on **one line across the 1280 frame**. That also solves the buyer's and UX's hero-height
  problem. Archivo at normal width for text (one variable file), and **Martian Mono** only for real data:
  weeks, prices, SCORM versions, counters taken from the simulations.
- All fonts are self-hosted (OFL licences in `/fonts`). No Google Fonts, for GDPR reasons.

## 4. Logo

- First proposal: a "learning loop" mark. Brand: the default edtech shape, and it reads as "refresh" at 16 px.
- **Decision:** a wordmark where the **first i gets an orange square for a dot**. That square becomes the
  site's mistake marker: the cut point in each replay, the "design the mistakes" bar in the Gantt, list
  bullets and the favicon.

## 5. Hero

| Voice | Position |
|---|---|
| Buyer | Merge the three simulations *into* the hero. Two 720 px stages waste a screen. Open on fire safety |
| UX | Replay is right, but keep headline + CTA under ~200 px, put tabs on top, keep it pausable, stop autoplay on any interaction, no autoplay with reduced motion |
| Brand | A before/after slider is a real-estate cliché. Cut hard from the move to the consequence on a scrub timeline instead. No captions over the sims, because their own UIs turn red at the mistake |

**Decision:** a playable stage with three tabs (Fire safety, Phishing, GDPR), on an ink band.
- **Preview:** "your move" for 2.5 s, then a hard cut with an orange flash to "what happens" for 3.5 s, then the next tab.
- **Timeline:** a real `<input type=range>` with the orange square at the cut point. It is draggable, works with the keyboard, has a pause button, and runs only while visible.
- **The deck:** under the screen, three cells light up in sync: *01 You do* (paper), *02 What happens* (orange), *03 What sticks* (ink with a tick).
- **Press start:** loads the real simulation at exactly 1280 × 720.

## 6. Which three simulations on the home page

Buyer: fire safety, IT security and data protection are the mandatory trainings every company already
budgets for, and everyone is bored with the current versions. School games next to fire safety would make a
factory buyer file us as a school vendor.

**Decision:** Fire / Phishing / GDPR on the home page. All eight sit on `simulations.html`, grouped as
**For the workplace** (5) and **For the classroom** (3). The panel cut topic filters: eight items don't need filtering.

## 7. "Nobody remembers slide 14."

- Buyer: cut it, they know slides fail.
- Copy and brand: keep the line. Brand also wanted it shown fairly, in the same 1280 × 720 frame.
- **Decision:** keep it as one fast visual joke. A lovingly dull e-learning slide ("Slide 14 of 38")
  sits in the frame, its **Next** button invites the click everyone makes, and clicking it cuts to the car
  rolling off the jack: *"Everybody remembers the car rolling off the jack."*

## 8. Trust without testimonials

No testimonials, client logos or metrics exist, and none were invented. The panel's honest replacements:
- **The person:** Razin's photo, name and Munich appear in the first screen, and an About section sits
  third (the buyer said hiding the only person reads as concealment).
- **A spec plate:** 8 playable demos, SCORM & xAPI, 3 to 5 weeks, from €500, no learner data by default, source files yours.
- **Honest labels:** the simulations are called *studio demos, built in-house*.
- **Real counters:** numbers quoted on the site come from the simulations' own screens: *5/10 devices
  infected · 3,700 records exposed*, *Particle counter: 10,000*.
- **Removed:** the "Most popular" badge, since no client history backs it. "Playable in week 2" was also removed: the facts don't support it.

## 9. Process, pricing, FAQ

- **Process:** a five-week Gantt. Razination's work is a thick bar, *your part* is a thin line with a short label, and the orange square marks where the mistakes get designed. Headline: *Live in 3 to 5 weeks.*
- **Pricing:** three sizes, each with the same week bar as the Gantt. "Start here" goes on Spark as a paid pilot. Prices exclude VAT, a fixed quote comes first, and payment is 50/50.
- **FAQ:** six real objections with the answers visible, not hidden in an accordion: LMS, what we need from you, learner data, ownership, phones, payments.

## 10. Contact

- Brand: the portfolio already ends on a giant coral block, so go ink, and style the form as a paper **incident report** with numbered fields.
- Buyer: a form they can forward, few required fields, and a clear promise next to it.
- **Decision:** three required fields (name, work email, what goes wrong) plus optional topic chips, organisation and deadline. It sends through Web3Forms. The promise next to it: a reply within one working day, no sales sequence, and the message is only used to reply.

## 11. Motion

Kept: the hard cut, the tab progress fill, the Gantt drawing in once, and the fade when a sim loads.
Avoided: fade-up on every section, parallax, marquees, count-up numbers, letter-by-letter reveals.
With `prefers-reduced-motion`, nothing autoplays.

## 12. The 1280 frame

Every section sits on `min(1280px, 100% - 2 × gutter)`. Simulations are 1280 × 720 iframes, scaled with a
CSS transform only when the frame is narrower. The gutter is sized so the frame is a full 1280 px on
1366 px laptops and wider. The sims run at scale 1 at 1366, 1440 and 1920.

---

## Round 2: review of the built site

Two reviewers (brand/visual and buyer/UX) critiqued screenshots of the finished pages at 1440, 1366 × 768 and
390 px. What changed as a result:

**Accuracy (buyer/UX, the most important catch)**
- The fire replay paired fire 1 (a paper bin, where water is *right*) with the fire 3 fireball. A safety
  officer would read that as "water on a bin causes a fireball".
- The GDPR replay paired the newsletter with the export.
- Both "your move" frames were re-captured at the same decision point as their consequence, in one
  playthrough each. Fire: fire 3 with the pointer on Water. GDPR: situation 2 with the pointer on
  "Email it to my personal Gmail".
- The spec plate no longer implies a €500 simulation. It now reads *Pilot €500 · sim €1,800*.

**First screen (both)**
- The hero opens on the consequence (a cold open), then replays how it happened.
- The duplicate quote button is gone, replaced by three facts: SCORM & xAPI, live in 3–5 weeks, fixed quote first.
- The stage starts about 90 px higher.

**Differentiation (brand)**
- All hard drop-shadows are removed. They were a neo-brutalist cliché, and the same device the portfolio uses.
- Buttons are flat with 2 px borders and invert on hover.
- The start button is paper with an orange triangle, because orange on an orange fireball disappeared.

**Clarity**
- The "what sticks" cell never dims below 55%, so it doesn't look disabled.
- Restart, Full screen and New tab moved to the stage bar, so the deck reads as three equal steps.
- The Slide 14 switch is a 60 px control in the section head.
- Build is inverted (ink) as the core offer, and the "Start here" tag is gone.
- Sections use less padding, and the alternating section has ink rules at its edges.

**Behaviour (buyer/UX)**
- "Play a simulation" and clicking the preview start the sim.
- The replay holds 3 s on the lesson, then loops through the three tabs once and stops.
- Pause and play no longer restart endless cycling.
- With reduced motion, the pause button is hidden.
- Slide 14 moves focus between Next and Back.
- The form shows "Sending…" and reports errors in a live region that is always present.

**Phones**
- The Simulations link stays in the header.
- Start opens the sim full screen and asks for landscape.
- Buttons are full width, the portrait is smaller, and the preview is cropped to 4:3 so the scene stays readable.

**Added**
- An FAQ answer on German-language delivery, worded only as far as the facts allow.

**Left to the owner**
- The Impressum and Datenschutz placeholders: address, email, phone, VAT ID, the Web3Forms provider and the supervisory authority.
- A public email address. The buyer reviewer insists on one; it isn't on the site because no Razination email was given.
