# Quillpad — landing page

The download site for Quillpad. "The Field Notebook": the page wears the
app's own skin — cream paper, brown ink, one rust accent, Fraunces display,
Caveat margin notes, IBM Plex Mono meta labels, dashed rules and a
notebook margin line running down the left edge. The product and its front
door are the same object.

The hero centerpiece is the Quill Trail: slow ink flourishes that draw
themselves across the cream paper — long sweeps, cursive loop flourishes,
rising curls and gentle waves, each composed from a few hand-placed
anchors and resampled with Catmull-Rom so the path flows. Every stroke
draws in over a few seconds with a pen-pressure width, rests, then fades
while the next begins; the ink is feathered, a wide faint halo under a
dark core that pools where the hand slows. Canvas 2D, DPR capped at 1.5,
the rAF loop pauses offscreen, and there is no pointer interaction: the
page simply writes on its own. Strokes are kept out of the reading column
by the hero's own quiet zone, with two soft paper veils behind the copy
(composited pixel contrast is a hard check in the suite, not a guess). The
reduced motion path is a settled static SVG. Beside it, a hand-drawn specimen
sheet on a stacked paper pile with tape corners, a pointer-follow 3D tilt,
and a gentle float, whose animal cell draws itself in with the app's own
diagram wobble.

Built and verified against design-taste-mcp: rubric from
`get_design_constraints` (marketing, variance 8), motion presets for
reveals/hovers, `run_static_checks` with a documented 3-font brand-fidelity
override, `critique_render` passes cross-checked against DOM audits.

## Page structure

- **Nav** — paper glass, condenses on scroll, rust progress hairline
- **Hero** — margin rule + handwritten margin note, Fraunces headline
  ("Read the chapter. Keep the margin.") with a rust emphasis stroke drawn
  in, the self-writing Quill Trail ink flourishes behind it, and the real
  Biology 04 note as a taped specimen sheet whose animal-cell diagram inks
  itself in stroke by stroke
- **Front matter** — a real YAML block, the way every Quillpad note opens
- **Transform** — the pinned scroll-scrub: the dense chapter page dissolves
  line by line while the distilled note assembles (summary, key points,
  recap) with the app's note anatomy
- **Study** — working demos: a flashcard that flips (mouse or keyboard), a
  real quiz question from the seed content, the three study modes
- **Ask** — working client-side search over the real five-chapter seed
  corpus, styled as the app's ask bar with the online/offline chips
- **Yours** — the app's own sidebar re-created: subject groups and real
  .md filenames file in one by one, the active chapter lit with the rust
  border; local-first philosophy rows
- **Engine** — the four pipeline stages as editorial rows, the provider
  failover chain, the offline honesty note
- **Download** — the finale: real stamped facts (v0.1.0, 14.2 MB, sha-256
  with copy), first-three-steps strip, SmartScreen honesty
- **Footer** — quiet close

All demo content is real: the actual seed notes, the actual folder names,
the actual checksum of the served exe.

## Layout

```
web/
  index.html                  entry, meta, OG tags
  public/
    favicon.svg               the quill mark (ink + rust)
    og.png                    hero screenshot (scripts/make-og.mjs)
    download/Quillpad.exe     the real Tauri artifact (gitignored)
  scripts/
    fetch-download.mjs        pre-build: copies exe + stamps size/sha256
    verify-page.mjs           27-check browser acceptance suite (Edge)
    make-og.mjs               OG image generator
  src/
    App.tsx                   page assembly
    content.ts                real seed content, sidebar data, engine chain
    download-info.ts          generated artifact facts
    index.css                 Tailwind v4 field-notebook tokens + keyframes
    components/
      bloom.tsx               Quill Trail wrapper + static SVG fallback
      quill-field.ts          canvas-2d ink gesture engine (gestures,
                              Catmull-Rom resampling, feathered ink)
      quill-field-canvas.tsx  lazy canvas mount + quiet-zone measurement
      motion-primitives.tsx   Reveal, WordMask
      ui.tsx                  QuillMark, Button, SectionHead
    sections/                 nav, hero, transform, study, ask, yours,
                              engine, download, footer
  vite.config.artifact.ts     fully-inlined single-file build used by
                              design-taste-mcp critique_render
```

## Commands

```bash
npm install
npm run dev                   # vite dev server
npm run build                 # fetch download info + typecheck + production build
npm run preview               # serve dist/ (default :4173)
npx vite build --config vite.config.artifact.ts   # self-contained artifact
node scripts/verify-page.mjs --url=http://localhost:4173
node scripts/make-og.mjs --url=http://localhost:4173
```

## Keeping the download honest

The download button serves `public/download/Quillpad.exe`, a copy of the
Tauri release build. `npm run build` re-copies the exe and re-stamps its
size and sha256 into `src/download-info.ts`, and fails the build if the
exe was built without embedded assets (the bare `cargo build --release`
trap: build with `npm run tauri build -- --no-bundle` in the project root).

## Verification performed

- `tsc --noEmit` clean; production + artifact builds clean
- design-taste-mcp `run_static_checks` against the marketing rubric with a
  documented brand-fidelity override (maxFontFamilies: 3). The checker's
  source-level regex counts Tailwind v4 architecture that is not design:
  `var(--font-*)` indirections, preflight `initial/inherit/bolder`, and
  8-digit alpha hexes of the base tokens. Ground truth comes from a
  computed-style audit (`getComputedStyle`, vars resolved): exactly 3
  families (Fraunces, Caveat, IBM Plex Mono), exactly 3 weights (400/500/
  600),   one accent hue, zero text-contrast failures at 1440 and 390 widths
  (worst computed static-text ratio 4.92:1; behind the live hero ink,
  the composited pixel worst case stays above the 4.5:1 floor)
- DOM geometry audit: zero element overlaps (nav/hero/CTA), zero
  horizontal overflow at desktop and mobile
- design-taste-mcp `critique_render`: transcribes the real page accurately
  ("Read the chapter. Keep the margin.", the "Get the app" button, the
  light-beige paper) but the configured vision model
  (NVIDIA llama-3.2-11b-vision, the only working provider on this
  machine's keys) is too weak to grade contrast/spacing reliably and
  contradicts the measurements above; its actionable hits — a real 4.39:1
  caption contrast fail and off-scale hero spacing — were fixed. The MCP
  behaved honestly throughout: no fabricated scores, raw model output
  always returned
- `verify-page.mjs`: 27/27 checks (hero reveal, quill-trail canvas animating
  and staying inked,
  scroll scrub, flashcard flip, quiz + number-key keyboard, ask search,
  sidebar filing animation, raw/rendered .md toggle, midnight-band
  computed colors, index-tab jump + active state, checksum copy,
  reduced-motion static render, mobile 390px overflow, no external
  requests, zero console errors, computed font budget, and a composited
  pixel-contrast check that hides the hero text, screenshots the live ink
  behind it, and verifies ink-on-paper contrast stays >= 4.5:1)
- UX audit: keyboard focus visible on every control (dashed rust), all
  interactive touch targets >= 28px at 390 (skip link excepted, by
  design), single h1 + ordered heading tree, quill trail holds ~144fps at
  DPR 1.5 on this machine, no pointer input to trap or leave stale
- WCAG: ink text on paper 11.9:1, rust-deep small text 5.3:1, white on
  rust CTA 5.1:1; skip link, focus-visible dashes, aria-live regions,
  sr-only alternatives on all decorative art

## Design-taste-mcp registration

`.opencode/opencode.json` registers the server for opencode sessions:
`npx`-free direct `design-taste-mcp` command with the vision provider
pinned to OpenAI-compatible NVIDIA (`meta/llama-3.2-11b-vision-instruct`),
key via `{env:NVIDIA_API_KEY}` — nothing secret committed. Restart opencode
to load it.
