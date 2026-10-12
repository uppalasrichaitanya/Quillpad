# Quillpad — website

The download page for Quillpad. **"Desk at night":** a warm dark desk with
Quillpad's own cream paper lying on it, lit from the upper left. The paper is
the app's real skin, so the page and the product look like the same object.

One orchestrated moment carries the page: in the hero, a dense textbook page
lands on the desk, a stroke of rust ink crosses it, and the Quillpad note rises
in its place while its cell diagram draws itself. Everything else moves only
when you touch it.

## Sections

- **Hero** — headline, download button, the distill sequence (replayable;
  reduced motion shows the finished note)
- **How it works** — three steps beside a small HTML re-creation of the app
  window (import → note → flashcard); auto-advances, pauses on hover/focus
- **Features** — paper objects on the desk, each a working demo on the real
  seed notes: offline ask, a flashcard, a ticking mock-exam clock, a redrawn
  diagram, the Midnight Ink toggle
- **Your notes are just files** — folder tree + the real `.md` (raw/rendered)
- **Download** — version, size and SHA-256 stamped from the release build;
  links to the GitHub release
- **FAQ** and footer

All demo content comes from `notebook-seed/seed.json` (see `src/seed.ts`).

## Commands

```bash
npm install
npm run dev        # dev server
npm run build      # stamp release facts → typecheck → build → pre-render HTML
npm run preview    # serve dist/ on :4173
npm run verify     # 13 acceptance checks in headless Edge (needs preview running)
npm run shoot      # screenshots at 1440 and 390 into .shots/
node scripts/make-og.mjs   # regenerate public/og.png from the live hero
```

`npm run build` reads `src-tauri/target/release/quillpad.exe` (build the app
first with `npm run tauri build -- --no-bundle` in the repo root) and writes
`src/release.ts`; without a local exe it keeps the committed one.

## Deploying

`dist/` is a static site — it works on GitHub Pages, Netlify, Vercel or any
static host. The download button points at the GitHub release asset, so the
exe is never hosted here; publish the GitHub release for the stamped version
first, or the button will 404.

## Layout

```
src/
  App.tsx              page assembly
  entry-server.tsx     build-time render (scripts/prerender.mjs)
  index.css            tokens (Tailwind v4 @theme), desk light, grain, paper
  release.ts           generated download facts
  seed.ts              the app's seed notes, as page content
  components/          paper, cell diagram, quill mark, app frame, distill sequence
  sections/            nav, hero, how-it-works, features, files, download, faq, footer
scripts/
  release-info.mjs     stamp version/size/sha-256 from the release exe
  prerender.mjs        inline rendered HTML + CSS into dist/index.html
  verify-page.mjs      acceptance suite
  shoot.mjs, make-og.mjs
```
