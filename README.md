# Quillpad

A local-first notebook app that turns your chapter PDFs into brief, clear,
subject-organized study notes — with hand-drawn-style diagrams.

Built with **Tauri 2** (Rust backend + web UI). No database: notes are plain
`.md` files on disk, organized by subject and chapter, mirroring the sidebar:

```
Quillpad/
  Biology/
    01-intro-to-cell-biology.md
    04-cell-structure-function.md
  Chemistry/
    02-periodic-trends.md
```

## Download (Windows)

1. Go to [**Releases**](https://github.com/uppalasrichaitanya/Quillpad/releases)
   and download `Quillpad.exe` from the latest release (~14 MB, portable —
   no install needed).
2. Double-click `Quillpad.exe` to run it.
3. If Windows SmartScreen says *"Windows protected your PC"* (the app is
   unsigned), click **More info → Run anyway**.
4. Requires **WebView2** — preinstalled on Windows 10/11. If the window is
   blank, install it from
   [Microsoft](https://developer.microsoft.com/microsoft-edge/webview2/).

On first launch Quillpad asks where to keep your notes (sample chapters are
already there to explore) and, optionally, for an AI key. Reading, searching,
flashcards and exams work fully offline; turning chapters into notes needs a
key — see [Getting your AI key](#getting-your-ai-key-2-minutes).

> Verify your download (optional): the SHA-256 of `Quillpad.exe` is listed
> on the release page.

## Run it from source (dev)

```bash
npm install
npm run tauri dev
```

Requires Node 22+, Rust (MSVC toolchain), and WebView2 (preinstalled on
Windows 10/11).

To build the exe yourself:

```bash
npm run tauri build -- --no-bundle
# → src-tauri/target/release/quillpad.exe

npm test                       # frontend logic tests
(cd src-tauri && cargo test)   # backend tests
```

## Features

- **Import chapters** — `+ import chapter file` in the sidebar. Pick a
  chapter PDF, Word document, or PowerPoint file, then its subject/number/
  title and optionally the chapter's important questions. Re-importing a
  name that already exists asks before replacing the note on disk.
- **Read** — text-based PDFs are extracted directly (`pdf-extract` crate).
  **Scanned PDFs** are detected automatically: pages render via pdf.js in
  the app and are transcribed by a vision model.
- **Distill** — the chapter text goes to Claude (or any Anthropic
  Messages-compatible endpoint you configure), which returns a strict-JSON note draft: summary, key points,
  question answers, and **diagrams as typed specs** (labelled-blob /
  trend-grid / process-flow / distribution-curve).
- **Render** — the frontend renders those specs as hand-drawn-style SVGs
  (turbulence filter, dashed leader lines, Caveat labels, rust accents),
  with a Midnight Ink dark mode.
- **Ask your notes** — `ask` in the sidebar works offline (scored matcher
  points at the chapter that answers, no network call) or online (excerpts
  sent to the configured endpoint, labelled when it goes beyond your notes).
- **Study & exam** — flashcards, quizzes, and practice writing grade into
  one state file (`study-state.json`); timed mock exams grade into exam
  history. Both autosave per action and are written atomically.
- **Export** — `export chapter` at the bottom of any note: Markdown
  (round-trips back into the app) or self-contained themed HTML.

## Getting your AI key (2 minutes)

Reading, searching, flashcards and exams work offline with no key. Turning
chapters into notes, online answers and quiz generation use Claude through
**your own** Anthropic API key — you pay Anthropic directly for what you use,
and nothing goes through anyone else's server.

1. Go to [console.anthropic.com](https://console.anthropic.com), sign up, and
   add a little credit under **Billing**.
2. Open **API keys → Create key** and copy it.
3. In Quillpad: **settings → AI key**, paste, press **test**, then **save**.

The key is stored in Windows Credential Manager, not in a file. The default
model is `claude-opus-5-5`; for cheaper notes set **advanced → model** to
`claude-sonnet-5-5`. Any Anthropic Messages-compatible endpoint can be set
under **advanced → API base URL**.

*Developers:* a `.env` next to the exe or in the project root
(`ANTHROPIC_API_KEY`, …) is still honoured as a fallback — see `.env.example`.

## Notes format

Markdown with YAML front-matter (subject, num, title, questions, created,
pdf_path) and `##` sections. Diagrams live in fenced ` ```quill-diagram `
JSON blocks inside the note, so prose stays prose and diagrams stay
structured. The slug drops punctuation rather than expanding it, so
`Cell Structure & Function` becomes `04-cell-structure-function.md`.

## Project layout

```
src/            frontend (vanilla JS, no framework)
  main.js         app shell, import wizard, offline search, study + exam flows
  onboarding.js   first-run welcome + key test
  ai-gate.js      "add a key" prompt in front of AI actions
  cards.js        deck building and the study session runner
  readiness.js    mastery, weak pile, due deck
  exam.js         exam paper construction and scoring
  pdfr.js         PDF probe + page rendering for scanned chapters
  diagrams.js     typed diagram specs → hand-drawn SVG
  quill.js        the Floating Quill brand mark
  styles.css      the field-notebook theme
src-tauri/      Rust backend
  note.rs         note format: parse + render markdown
  library.rs      settings (+ 0.1 migration), atomic writes, notes-folder scanning
  ai_config.rs    endpoint defaults, URL hygiene, plain-English API errors
  keystore.rs     API key in Windows Credential Manager
  distill.rs      PDF/office extraction, prompts, endpoint failover
  commands.rs     Tauri commands (the IPC surface)
  seed.rs         first-run seed chapters
notebook-seed/  first-run example chapters as real notes
tests/          frontend logic tests (npm test)
scripts/make_icon.py   generates the app icon (Pillow)
```
