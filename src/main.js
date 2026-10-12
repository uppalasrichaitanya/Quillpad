// Quillpad frontend — ported from the notebook.html prototype.
// Reads/writes plain .md files on disk via the Rust backend (no database).

import './styles.css';
import { invoke } from '@tauri-apps/api/core';
import { open as dialogOpen, save as dialogSave } from '@tauri-apps/plugin-dialog';
import { quillMark, quillMarkFull } from './quill.js';
import { renderDiagram, diagramFrame, setDiagramTheme } from './diagrams.js';
import { probePdf, renderPdfPages } from './pdfr.js';
import { refreshAiStatus, requireKey, onOpenSettings } from './ai-gate.js';
import { maybeShowWelcome, testKey } from './onboarding.js';
import { buildDeck, mergeDecks, Session, skeletonOf, trapOf } from './cards.js';
import {
  masteryBySubject,
  overallMastery,
  weakTopics,
  buildDueDeck,
  dueSummary,
  withWriteCards,
} from './readiness.js';
import {
  realQuestions,
  assemblePaper,
  scoreAttempt,
  verdictOf,
  clockOf,
  QUESTION_MARKS,
} from './exam.js';

const $ = (id) => document.getElementById(id);

// ---------- state ----------
let library = [];        // [{subject, num, title, file}]
let current = null;      // {subject, file} of the open chapter
let mode = 'offline';
let allNotes = [];       // every note, read once for dashboard/exam/study reuse
let examHistory = [];    // recent mock-exam attempts (newest first)

// ---------- helpers ----------

function stripTags(s) {
  return String(s).replace(/<[^>]*>/g, '');
}

// Allowlist-only HTML filter for note prose. The distiller emits <em>/<strong>
// for emphasis; everything else (including attributes) is neutralized so a
// hand-edited .md or rogue LLM output can't inject markup into the webview.
function safeRich(s) {
  const raw = String(s ?? '');
  let out = '';
  let i = 0;
  while (i < raw.length) {
    const open = raw.indexOf('<', i);
    if (open < 0) {
      out += raw.slice(i);
      break;
    }
    out += raw.slice(i, open);
    const close = raw.indexOf('>', open);
    if (close < 0) {
      out += '&lt;';
      i = open + 1;
      continue;
    }
    const tag = raw.slice(open + 1, close).trim();
    const m = tag.match(/^(\/?)([a-zA-Z0-9]+)([\s\S]*)$/);
    const ALLOWED = new Set(['em', 'strong', 'i', 'b']);
    if (m && ALLOWED.has(m[2].toLowerCase()) && !m[3].trim()) {
      out += `<${m[1]}${m[2].toLowerCase()}>`;
    } else {
      out += `&lt;${esc(tag)}&gt;`;
    }
    i = close + 1;
  }
  return out;
}

function fileSort(a, b) {
  return (
    a.subject.localeCompare(b.subject) ||
    // chapter numbers read as numbers, so 2 sorts before 10
    (parseInt(a.num, 10) || 0) - (parseInt(b.num, 10) || 0) ||
    a.num.localeCompare(b.num) ||
    a.file.localeCompare(b.file)
  );
}

// ---------- sidebar ----------

async function refreshLibrary() {
  library = await invoke('list_library');
  library.sort(fileSort);
  renderSidebar();
}

// per-subject collapse state (survives re-renders within a session)
const collapsedSubjects = new Set();
const collapseTimers = new Map();

function renderSidebar() {
  // collapse timers are keyed by subject: a pending hide must never land on a
  // group the user re-expanded first. Cleared here because the nodes it
  // targets are about to be replaced.
  for (const t of collapseTimers.values()) clearTimeout(t);
  collapseTimers.clear();
  const groups = new Map();
  for (const entry of library) {
    if (!groups.has(entry.subject)) groups.set(entry.subject, []);
    groups.get(entry.subject).push(entry);
  }
  const el = $('subjectGroups');
  el.innerHTML = [...groups.entries()]
    .map(([subject, chapters]) => {
      const collapsed = collapsedSubjects.has(subject);
      // auto-expand the subject of the open chapter
      const open = collapsed && current && current.subject === subject ? false : collapsed;
      return `
      <div class="subject-group${open ? ' collapsed' : ''}" data-subject="${esc(subject)}">
        <div class="subject-label" data-toggle="${esc(subject)}" role="button" tabindex="0">
          <span class="subject-name">${esc(subject)}</span>
          <svg class="subject-arrow" viewBox="0 0 10 9" width="9" height="8" aria-hidden="true">
            <path d="M5 8.2 L9.6 1.8 L0.4 1.8 Z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
          </svg>
          <span class="subject-count">${chapters.length}</span>
        </div>
        <div class="subject-chapters"${open ? ' hidden' : ''}>
        ${chapters
          .map(
            (c) => `
        <div class="chapter-item${isActive(c) ? ' active' : ''}" data-subject="${esc(c.subject)}" data-file="${esc(c.file)}">
          <span class="num">${esc(c.num)}</span> ${esc(c.title)}
        </div>`,
          )
          .join('')}
        </div>
      </div>`;
    })
    .join('');
  el.querySelectorAll('.chapter-item').forEach((item) => {
    item.addEventListener('click', () => {
      openChapter(item.dataset.subject, item.dataset.file);
    });
  });
  el.querySelectorAll('.subject-label').forEach((label) => {
    const toggle = () => {
      const subject = label.dataset.toggle;
      const group = label.closest('.subject-group');
      const chapters = group.querySelector('.subject-chapters');
      const nowCollapsed = !collapsedSubjects.has(subject);
      if (nowCollapsed) collapsedSubjects.add(subject);
      else collapsedSubjects.delete(subject);
      group.classList.toggle('collapsed', nowCollapsed);
      clearTimeout(collapseTimers.get(subject));
      collapseTimers.delete(subject);
      // animate height instead of hard-hidden for the smooth feel
      if (nowCollapsed) {
        chapters.style.height = `${chapters.scrollHeight}px`;
        requestAnimationFrame(() => {
          chapters.style.height = '0px';
          chapters.style.opacity = '0';
        });
        collapseTimers.set(
          subject,
          setTimeout(() => {
            // only hide if this group is still collapsed
            if (collapsedSubjects.has(subject)) chapters.setAttribute('hidden', '');
            collapseTimers.delete(subject);
          }, 400),
        );
      } else {
        chapters.removeAttribute('hidden');
        chapters.style.height = '0px';
        chapters.style.opacity = '0';
        requestAnimationFrame(() => {
          chapters.style.height = `${chapters.scrollHeight}px`;
          chapters.style.opacity = '1';
          setTimeout(() => {
            chapters.style.height = '';
            chapters.style.opacity = '';
          }, 400);
        });
      }
    };
    label.addEventListener('click', toggle);
    label.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  });
}

function isActive(entry) {
  return current && current.subject === entry.subject && current.file === entry.file;
}

// ---------- chapter view ----------

async function openChapter(subject, file) {
  // A slow read must never overwrite a chapter the user picked after it.
  const generation = ++chapterGeneration;
  const view = ++viewGeneration;
  try {
    const note = await invoke('read_note', { subject, file });
    if (generation !== chapterGeneration) return;
    current = { subject, file, title: note.meta.title };
    renderChapter(note);
    renderSidebar();
    // restart the settle animation + reset scroll for the new chapter
    const el = $('chapterView');
    el.style.animation = 'none';
    void el.offsetHeight;
    el.style.animation = '';
    document.querySelector('.main').scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    if (generation !== chapterGeneration) return;
    console.error('failed to open note', e);
    flash(`could not open note: ${e}`, true);
  }
}

// Render one body string as one or more paragraph lines. Exam-note bodies
// carry \n-separated blocks (skeleton / Definition / (i) points / Step lines)
// that must each land on their own line for reproducible reading.
function bodyLines(para) {
  return String(para)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => `<p class="topic-para${line.startsWith('<em>') ? ' topic-skeleton' : ''}">${safeRich(line)}</p>`)
    .join('');
}

function topicHtml(topic) {
  const diagrams = topic.diagrams.map((d) => diagramFrame(renderDiagram(d))).join('');
  const qa = topic.qa.length
    ? `<div class="topic-questions">${topic.qa
        .map(
          (item) => `
      <div class="qa-item">
        <div class="qa-q">${safeRich(item.q)}</div>
        <div class="qa-a">${safeRich(item.a)}</div>
      </div>`,
        )
        .join('')}</div>`
    : '';
  return `
    <section class="topic">
      <h2 class="section-h">${esc(topic.title)}</h2>
      ${topic.body.map(bodyLines).join('')}
      ${diagrams}
      ${qa}
    </section>`;
}

function legacySectionsHtml(note) {
  const qaSection = note.qa.length
    ? `<h2 class="section-h">Questions Answered</h2>
       ${note.qa
         .map(
           (qa) => `
      <div class="qa-item">
        <div class="qa-q">${safeRich(qa.q)}</div>
        <div class="qa-a">${safeRich(qa.a)}</div>
      </div>`,
         )
         .join('')}`
    : '';
  const diagrams = note.diagrams.map((d) => diagramFrame(renderDiagram(d))).join('');
  const diagramsSection = diagrams
    ? `<h2 class="section-h">Diagrams</h2>${diagrams}`
    : '';
  const points = note.key_points.length
    ? `<h2 class="section-h">Key Points</h2>
       <ul class="keypoints">${note.key_points.map((p) => `<li>${safeRich(p)}</li>`).join('')}</ul>`
    : '';
  return `${points}${qaSection}${diagramsSection}`;
}

function renderChapter(note) {
  const m = note.meta;
  const body = note.topics?.length
    ? note.topics.map(topicHtml).join('')
    : legacySectionsHtml(note);
  $('chapterView').innerHTML = `
    <div class="chap-eyebrow">${esc(m.subject)} · Chapter ${esc(m.num)}</div>
    <h1 class="chap-title">${esc(m.title)}</h1>
    <div class="chap-rule"></div>
    <div class="summary">${safeRich(note.summary)}</div>
    ${body}
    <div class="recap"><p>${safeRich(note.recap)}</p></div>
    <div class="export-row">
      <span class="export-label">this chapter</span>
      <button class="export-btn" data-act="study">study</button>
      <button class="export-btn" data-act="edit">edit</button>
      <span class="export-sep"></span>
      <span class="export-label">export</span>
      <button class="export-btn" data-fmt="md">markdown</button>
      <button class="export-btn" data-fmt="html">styled html</button>
      <button class="export-btn" data-fmt="pdf">pdf</button>
    </div>
    <div class="export-row">
      <span class="export-label">whole subject</span>
      <button class="export-btn" data-act="study-subject">study all</button>
      <button class="export-btn" data-act="cheat">cheat sheet</button>
    </div>
  `;
  let editMode = false;
  $('chapterView')
    .querySelectorAll('.export-btn')
    .forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (btn.dataset.fmt === 'pdf') return exportPdf(note);
        if (btn.dataset.fmt) return exportFile(note, btn.dataset.fmt);
        switch (btn.dataset.act) {
          case 'study':
            return startStudy([note]);
          case 'study-subject': {
            const notes = [];
            for (const e of library.filter((x) => x.subject === m.subject)) {
              notes.push(await invoke('read_note', { subject: e.subject, file: e.file }));
            }
            return startStudy(notes);
          }
          case 'cheat':
            return exportCheatSheet(m.subject);
          case 'edit':
            editMode = !editMode;
            setEditMode(editMode, note, btn);
            break;
        }
      });
    });
}

async function exportFile(note, fmt) {
  const stem = `${note.meta.num}-${slug(note.meta.title)}`;
  const dest = await dialogSave({
    title: 'Export chapter',
    defaultPath: fmt === 'html' ? `${stem}.html` : `${stem}.md`,
    filters: [
      fmt === 'html'
        ? { name: 'Styled HTML', extensions: ['html'] }
        : { name: 'Markdown', extensions: ['md'] },
    ],
  });
  if (!dest) return;
  try {
    if (fmt === 'html') {
      // diagrams always print on light paper
      const html = withLightDiagrams(buildStyledHtml, note);
      await invoke('write_export', { dest, contents: html });
    } else {
      await invoke('export_note_markdown', { note, dest });
    }
    flash(`saved — ${dest}`);
  } catch (e) {
    flash(`export failed: ${e}`, true);
  }
}

// ---------- export ----------

// PDF export: render the themed HTML into a hidden print frame and open the
// system print dialog — WebView2's printer list includes "Save as PDF".
function exportPdf(note) {
  const html = withLightDiagrams(buildStyledHtml, note);
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(frame);
  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    frame.contentWindow.focus();
    frame.contentWindow.print();
    // remove the frame after the dialog closes (give slow printers time)
    setTimeout(() => frame.remove(), 60000);
  };
  frame.onload = doPrint;
  const doc = frame.contentDocument || frame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  // synchronous doc.write leaves readyState complete before onload can be
  // caught in some engines — fall back after a beat if load never fired
  setTimeout(doPrint, 800);
}

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildStyledHtml(note) {
  // Self-contained themed page; fonts fall back to system stacks offline.
  const m = note.meta;

  const topicBlock = (t, h) => `
    <h2>${esc(t.title)}</h2>
    ${t.body.map((p) => String(p).split('\n').map((l) => l.trim()).filter(Boolean)
      .map((line) => `<p class="topic-para${line.startsWith('<em>') ? ' topic-skeleton' : ''}">${safeRich(line)}</p>`).join('')).join('')}
    ${t.diagrams.map((d) => diagramFrame(renderDiagram(d))).join('')}
    ${t.qa.length ? t.qa.map((q) => `<div class="qa"><div class="q">${safeRich(q.q)}</div><div class="a">${safeRich(q.a)}</div></div>`).join('') : ''}`;

  const legacyBlock = `
    ${note.key_points.length ? `<h2>Key Points</h2><ul>${note.key_points.map((p) => `<li>${safeRich(p)}</li>`).join('')}</ul>` : ''}
    ${note.qa.length ? `<h2>Questions Answered</h2>${note.qa.map((q) => `<div class="qa"><div class="q">${safeRich(q.q)}</div><div class="a">${safeRich(q.a)}</div></div>`).join('')}` : ''}
    ${note.diagrams.length ? `<h2>Diagrams</h2>${note.diagrams.map((d) => diagramFrame(renderDiagram(d))).join('')}` : ''}`;

  const body = note.topics?.length
    ? note.topics.map(topicBlock).join('')
    : legacyBlock;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(m.title)} — Quillpad</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
${EXPORT_CSS}
</style>
</head>
<body>
<div class="eyebrow">${esc(m.subject)} · Chapter ${esc(m.num)}</div>
<h1>${esc(m.title)}</h1>
<div class="rule"></div>
<div class="summary">${safeRich(note.summary)}</div>
${body}
<div class="recap"><p>${safeRich(note.recap)}</p></div>
<div class="footer">written in Quillpad — the margin is where the real thinking happens</div>
</body>
</html>`;
}

const EXPORT_CSS = `
  :root { --paper:#F3EADA; --paper-deep:#E8D8BB; --ink:#362B1E; --ink-soft:#6C5D49;
    --rust:#BC5A32; --rust-soft:#E0A579; --line:rgba(54,43,30,0.14); }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { background: var(--paper); color: var(--ink);
    font-family: 'Source Serif 4', Georgia, serif; max-width: 760px; margin: 0 auto; padding: 48px 32px 80px; }
  .eyebrow { font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 11px;
    letter-spacing: 1.5px; text-transform: uppercase; color: var(--rust); margin-bottom: 6px; }
  h1 { font-family: Fraunces, Georgia, serif; font-weight: 600; font-size: 36px; margin: 0 0 6px; line-height: 1.1; }
  .rule { height: 1px; margin: 14px 0 22px; opacity: .5;
    background: repeating-linear-gradient(to right, var(--ink-soft) 0 6px, transparent 6px 11px); }
  .summary { font-size: 17px; line-height: 1.7; margin-bottom: 28px; }
  h2 { font-family: Fraunces, Georgia, serif; font-style: italic; font-weight: 600; font-size: 21px; margin: 30px 0 12px; }
  .topic-para { font-size: 15.5px; line-height: 1.7; margin: 0 0 12px; }
  .topic-skeleton { font-style: italic; color: var(--rust); font-size: 14px;
    background: #F5E4CB; border-left: 3px solid var(--rust-soft); padding: 8px 12px; margin-bottom: 14px; }
  ul { padding-left: 0; list-style: none; }
  li { position: relative; padding-left: 22px; margin-bottom: 11px; font-size: 15.5px; line-height: 1.6; }
  li::before { content: "—"; position: absolute; left: 0; color: var(--rust); font-weight: 600; }
  .qa { margin-bottom: 18px; }
  .qa .q { font-weight: 600; margin-bottom: 4px; }
  .qa .a { line-height: 1.6; }
  .diagram-wrap { background: var(--paper-deep); border: 1px solid var(--line);
    border-radius: 4px; padding: 18px 20px 14px; margin: 8px 0 24px; }
  .diagram-wrap svg { width: 100%; height: auto; display: block; }
  .fig-caption { font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 11px; color: var(--ink-soft); margin-top: 8px; }
  .recap { background: rgba(224,165,121,0.16); border: 1px dashed var(--rust-soft); border-radius: 3px; padding: 16px 20px; position: relative; }
  .recap::before { content: "quick recap"; position: absolute; top: -10px; left: 14px; background: var(--paper);
    padding: 0 8px; font-family: 'Caveat', cursive; font-size: 19px; color: var(--rust); font-weight: 700; }
  .footer { margin-top: 48px; font-family: 'IBM Plex Mono', Consolas, monospace;
    font-size: 10.5px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink-soft); }
  @media print {
    body { padding: 0; background: #F3EADA; }
    h2, .recap, .diagram-wrap { break-inside: avoid; }
    .recap { background: #F5E4CB; border-color: #E0A579; }
    .diagram-wrap { background: #EFE3C8; }
  }
`;

function flash(msg, isErr = false) {
  let el = $('flash');
  if (!el) {
    el = document.createElement('div');
    el.id = 'flash';
    el.style.cssText =
      // above the study (80) and exam (90) overlays, or errors vanish behind them
      'position:fixed;bottom:22px;right:22px;font-family:IBM Plex Mono,monospace;font-size:11px;letter-spacing:.5px;padding:10px 16px;border-radius:3px;z-index:120;max-width:60vw;';
    document.body.appendChild(el);
  }
  // theme-aware toast: uses the CSS vars so it flips with midnight ink
  el.style.background = isErr ? 'var(--rust)' : 'var(--ink)';
  el.style.color = 'var(--paper)';
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(flash._t);
  flash._t = setTimeout(() => (el.style.opacity = '0'), 2600);
  el.style.transition = 'opacity .4s';
}

// ---------- offline search: scored term matching over the note corpus ----------

let searchIndex = [];
let searchGeneration = 0;
let chapterGeneration = 0;
let viewGeneration = 0;

const STOPWORDS = new Set(
  ('a an the is are was were be been being of in on at to for from by with about as and or if then than ' +
    'that this these those it its i you we they he she what which who whom how why when where does do did ' +
    'can could should would will shall may might must not no nor so such very more most some any each every ' +
    'into over under between during before after above below up down out off again further once here there ' +
    'all both few other own same too s t just don now me my your his her their our us them him hers myself ' +
    'write wrote written notes note did does explain explained tell describe').split(' '),
);

function terms(text) {
  const raw = stripTags(String(text))
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  // light stemming: strip plural/verb endings so "frames" matches "framing"
  // and "detection" matches "detecting" — the corpus is technical vocabulary
  const stem = (t) =>
    t
      .replace(/(ational|tional|ization|iveness|fulness|ousness)$/, '')
      .replace(/(ing|ed|es|s)$/, '');
  return raw.map((t) => {
    const s = stem(t);
    return s.length >= 3 ? s : t;
  });
}

async function buildSearchIndex() {
  // Build into locals and commit once: overlapping rebuilds used to interleave
  // their awaits and leave a half-populated index behind.
  const generation = ++searchGeneration;
  const index = [];
  const notes = [];
  for (const entry of library) {
    try {
      const note = await invoke('read_note', entry);
      notes.push(note);
      const legacyParts = [
        note.summary,
        ...note.key_points,
        ...note.qa.flatMap((q) => [q.q, q.a]),
        note.recap,
      ];
      const topicParts = (note.topics || []).flatMap((t) => [
        t.title,
        ...t.body,
        ...t.qa.flatMap((q) => [q.q, q.a]),
      ]);
      const bodyText = [...legacyParts, ...topicParts].join('\n');
      const bodyOriginal = stripTags(bodyText);
      index.push({
        subject: entry.subject,
        file: entry.file,
        num: entry.num,
        title: note.meta.title,
        titleTerms: terms(note.meta.title),
        // lowercased copy for matching, original for excerpts/snippets
        body: bodyOriginal.toLowerCase(),
        bodyOriginal,
        bodyTerms: terms(bodyText),
      });
    } catch (e) {
      // unparseable note: skip silently
    }
    if (generation !== searchGeneration) return;
  }
  searchIndex = index;
  allNotes = notes;
}

function snippetAround(body, idx) {
  const start = Math.max(0, idx - 60);
  const end = Math.min(body.length, idx + 90);
  let s = body.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) s = '…' + s;
  if (end < body.length) s = s + '…';
  return s;
}

function scoreNote(note, qTerms, qPhrase) {
  const titleSet = new Set(note.titleTerms);
  let score = 0;
  let matched = 0;
  for (const t of qTerms) {
    const inTitle = titleSet.has(t) ? 3 : 0;
    const inBody = note.bodyTerms.includes(t) ? 1 : 0;
    score += inTitle * 4 + inBody;
    if (inTitle || inBody) matched += 1;
  }
  if (qTerms.length && matched === 0) return null;
  // phrase bonus: the whole question appears verbatim somewhere
  if (qPhrase.length >= 3 && note.body.includes(qPhrase)) score += 5;
  // coverage reward: matching more distinct terms scales up
  score += (matched / qTerms.length) * 4;
  return { score, matched };
}

const askInput = $('askInput');
const resultsEl = $('results');
let searchDebounce = null;

askInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(runSearch, 120);
});

// ---------- revision agent (online mode) ----------

// Best matching windows from a note, original case. Query terms are stemmed
// (e.g. "detect"), so matching uses word-prefix regexes — "detect" matches
// "detecting", "detection", "detects" in the original text.
function contextWindows(text, qTerms, span, count) {
  const lower = text.toLowerCase();
  const re = new RegExp(`\\b(${qTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\w*`, 'g');
  const hits = [];
  let m;
  while ((m = re.exec(lower)) !== null) {
    hits.push(m.index);
    if (hits.length > 400) break; // sanity cap
  }
  if (!hits.length) return [text.slice(0, span)];
  // merge hits within 1.2*span of each other into clusters
  const clusters = [];
  for (const h of hits) {
    const last = clusters[clusters.length - 1];
    if (last && h - last.start < span * 1.2) {
      last.end = h;
      last.n += 1;
    } else {
      clusters.push({ start: h, end: h, n: 1 });
    }
  }
  // density = hits per cluster; ties broken by earlier position
  clusters.sort((a, b) => b.n - a.n || a.start - b.start);
  return clusters.slice(0, count).map((c) => {
    const start = Math.max(0, c.start - Math.floor(span * 0.35));
    return text.slice(start, start + span).trim();
  });
}

function pickContexts(raw, qTerms) {
  const scored = searchIndex
    .map((s) => ({ s, r: scoreNote(s, qTerms, raw.toLowerCase()) }))
    .filter((x) => x.r && x.r.score > 0)
    .sort((a, b) => b.r.score - a.r.score)
    .slice(0, 3);
  return scored.map(({ s }) => ({
    subject: s.subject,
    chapter: `Chapter ${s.num} — ${s.title}`,
    excerpt: contextWindows(s.bodyOriginal, qTerms, 1600, 2).join('\n…\n'),
  }));
}

let agentBusy = false;

async function askOnline() {
  const raw = askInput.value.trim();
  if (raw.length < 2 || agentBusy) return;
  const qTerms = [...new Set(terms(raw))];
  const contexts = pickContexts(raw, qTerms);
  if (!contexts.length) {
    showAnswerCard({
      answer: 'your notes don\'t cover this topic yet — import the chapter that does, or ask again and I\'ll answer from general knowledge',
      question: raw,
      contexts: [],
      source: 'general',
    });
    return;
  }
  agentBusy = true;
  showAnswerCard({ pending: true, used: contexts.length });
  try {
    const outcome = await invoke('ask_notes', { question: raw, contexts });
    showAnswerCard({ answer: outcome.answer, question: raw, contexts, source: outcome.source });
  } catch (e) {
    // the pending card must resolve to a failure, not spin forever
    showAnswerCard({ error: String(e).slice(0, 160), question: raw, contexts });
    resultsEl.classList.add('show');
  } finally {
    agentBusy = false;
  }
}

function showAnswerCard({ pending, answer, error, contexts, used, source = 'notes' }) {
  let card = $('answerCard');
  if (!card) {
    card = document.createElement('div');
    card.id = 'answerCard';
    card.className = 'answer-card';
    resultsEl.prepend(card);
  }
  if (pending) {
    card.classList.remove('beyond');
    card.innerHTML = `
      <div class="answer-tag">answering from your notes</div>
      <div class="answer-body"><span class="spinner"></span> reading ${used} note${used === 1 ? '' : 's'} for the answer…</div>`;
  } else if (error) {
    card.classList.remove('beyond');
    card.innerHTML = `
      <div class="answer-tag">could not answer</div>
      <div class="answer-body">${esc(error)}</div>
      <div class="answer-src">check the model and key in settings, then ask again</div>`;
  } else if (source === 'general') {
    card.classList.add('beyond');
    card.innerHTML = `
      <div class="answer-tag beyond-tag">answered beyond your notes — not from your material</div>
      <div class="answer-body">${safeRich(answer)}</div>`;
  } else {
    card.classList.remove('beyond');
    card.innerHTML = `
      <div class="answer-tag">answered from your notes</div>
      <div class="answer-body">${safeRich(answer)}</div>
      ${contexts.length ? `<div class="answer-sources">${contexts
        .map(
          (c) =>
            `<button class="source-chip" data-subject="${esc(c.subject)}" data-chapter="${esc(c.chapter)}">${esc(c.subject)} › ${esc(c.chapter)}</button>`,
        )
        .join('')}</div>` : ''}`;
    card.querySelectorAll('.source-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const hit = searchIndex.find(
          (s) => s.subject === chip.dataset.subject && `Chapter ${s.num} — ${s.title}` === chip.dataset.chapter,
        );
        if (hit) openChapter(hit.subject, hit.file);
      });
    });
  }
  resultsEl.classList.add('show');
}

askInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (mode === 'online') {
    e.preventDefault();
    askOnline();
  } else if (resultsEl.classList.contains('show')) {
    // offline: Enter opens the top search result
    e.preventDefault();
    const first = resultsEl.querySelector('.result-item');
    if (first) {
      openChapter(first.dataset.subject, first.dataset.file);
      resultsEl.classList.remove('show');
      askInput.value = '';
    }
  }
});

function runSearch() {
  const raw = askInput.value.trim();
  const q = raw.toLowerCase();
  // a fresh query invalidates any previous agent answer — but never yank
  // the card out from under an in-flight agent run
  if (!agentBusy) {
    $('answerCard')?.remove();
  }
  if (q.length < 2) {
    resultsEl.classList.remove('show');
    resultsEl.innerHTML = '';
    return;
  }
  const qTerms = [...new Set(terms(raw))];
  if (!qTerms.length) {
    resultsEl.classList.remove('show');
    return;
  }
  const hits = [];
  for (const s of searchIndex) {
    const r = scoreNote(s, qTerms, q);
    if (r && r.score > 0) {
      // snippet: window around the first matched term (stemmed → prefix match)
      let snip = '';
      try {
        const re = new RegExp(`\\b(${qTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\w*`);
        const m = s.bodyOriginal.toLowerCase().match(re);
        if (m) snip = snippetAround(s.bodyOriginal, m.index);
      } catch {
        snip = '';
      }
      hits.push({ ...s, score: r.score, snip });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  const shown = hits.slice(0, 6);
  if (!shown.length) {
    resultsEl.innerHTML = `<div class="no-results">nothing in your notes matches that yet — maybe it's time to add a chapter.</div>`;
  } else {
    resultsEl.innerHTML = shown
      .map(
        (h) => `
      <div class="result-item" data-subject="${esc(h.subject)}" data-file="${esc(h.file)}">
        <div class="path">${esc(h.subject)} › Chapter ${esc(h.num)} › ${esc(h.title)}</div>
        <div class="snip">${esc(h.snip)}</div>
      </div>`,
      )
      .join('');
    resultsEl.querySelectorAll('.result-item').forEach((el) => {
      el.addEventListener('click', () => {
        openChapter(el.dataset.subject, el.dataset.file);
        resultsEl.classList.remove('show');
        askInput.value = '';
      });
    });
  }
  resultsEl.classList.add('show');
}

// clicking the folder path opens settings (to change it)
$('notesDir').addEventListener('click', () => $('settingsBtn').click());
// clicking the brand re-opens the cover page (with fresh animations)
document.querySelector('.brand').addEventListener('click', () => {
  const cover = $('coverPage');
  const ink = $('coverInk');
  const quill = $('coverQuill');
  cover.removeAttribute('hidden');
  cover.classList.remove('gone');
  // restart the ink-write + quill-ride animations
  [ink, quill, document.querySelector('.cover-foot')].forEach((el) => {
    el.style.animation = 'none';
    void el.offsetHeight;
    el.style.animation = '';
  });
  cover.addEventListener('click', dismissCover, { once: true });
});

// ---------- mode toggle (revision agent ships later) ----------

$('modeOnline').addEventListener('click', () => {
  if (!requireKey('Online answers')) return;
  mode = 'online';
  $('modeOnline').classList.add('on');
  $('modeOffline').classList.remove('on');
  $('askHint').textContent =
    'online mode — press Enter to ask your notes; answers come only from what you\'ve already written';
});
$('modeOffline').addEventListener('click', () => {
  mode = 'offline';
  $('modeOffline').classList.add('on');
  $('modeOnline').classList.remove('on');
  $('askHint').textContent =
    'offline mode — matches your question against topics already in your notes';
});

// ---------- modals ----------

function wireModal(backId, closeId, onClose) {
  const close = () => {
    $(backId).setAttribute('hidden', '');
    if (onClose) onClose();
  };
  $(closeId).addEventListener('click', close);
  $(backId).addEventListener('click', (e) => {
    if (e.target === $(backId)) close();
  });
}

// ---------- import wizard ----------

wireModal('importModal', 'importCancel', cancelImport);
wireModal('settingsModal', 'settingsClose');

let pickedPdf = null;
let importGeneration = 0;

function cancelImport() {
  // a distil in flight must not act on a wizard that has since been closed
  ++importGeneration;
  pickedPdf = null;
}

$('importBtn').addEventListener('click', () => {
  // ask for a key before the user fills the wizard, not after
  if (!requireKey('Turning a chapter into notes')) return;
  // reset form
  ++importGeneration;
  pickedPdf = null;
  $('pdfPath').textContent = '—';
  $('impSubject').value = '';
  $('impNum').value = '';
  $('impTitle').value = '';
  $('impQuestions').value = '';
  setStatus('');
  // suggest existing subjects so imports group correctly
  const subjects = [...new Set(library.map((e) => e.subject))];
  $('subjectList').innerHTML = subjects
    .map((s) => `<option value="${esc(s)}"></option>`)
    .join('');
  $('importModal').removeAttribute('hidden');
});

function setStatus(msg, isErr = false, spinning = false) {
  const el = $('importStatus');
  if (!msg && !spinning) {
    el.setAttribute('hidden', '');
    return;
  }
  el.removeAttribute('hidden');
  el.classList.toggle('err', isErr);
  el.innerHTML = (spinning ? '<span class="spinner"></span>' : '') + esc(msg);
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

$('pickPdfBtn').addEventListener('click', async () => {
  const f = await dialogOpen({
    title: 'Choose chapter file',
    multiple: false,
    filters: [
      { name: 'Chapter files', extensions: ['pdf', 'docx', 'pptx'] },
      { name: 'PDF', extensions: ['pdf'] },
      { name: 'Word document', extensions: ['docx'] },
      { name: 'PowerPoint', extensions: ['pptx'] },
    ],
  });
  if (f) {
    pickedPdf = f;
    $('pdfPath').textContent = f;
    // prefill title from filename if empty: "04-cell-structure" → num 04, title guess
    const stem = f.split(/[\\/]/).pop().replace(/\.(pdf|docx|pptx)$/i, '');
    if (!$('impTitle').value) {
      const m = stem.match(/^(\d+)[\s_-]+(.+)$/);
      if (m) {
        if (!$('impNum').value) $('impNum').value = m[1];
        $('impTitle').value = m[2].replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
      } else {
        $('impTitle').value = stem.replace(/[-_]+/g, ' ').trim();
      }
    }
  }
});

$('importGo').addEventListener('click', async () => {
  if (!pickedPdf) {
    setStatus('pick a chapter PDF first', true);
    return;
  }
  // snapshot everything before the first await: the wizard can be closed and
  // reopened mid-distil, which resets the module-level pickedPdf
  const generation = importGeneration;
  const path = pickedPdf;
  const subject = $('impSubject').value.trim();
  const num = $('impNum').value.trim() || '00';
  const title = $('impTitle').value.trim();
  if (!subject || !title) {
    setStatus('subject and title are needed', true);
    return;
  }
  if (!requireKey('Turning a chapter into notes')) return;
  const questions = $('impQuestions').value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const stale = () => generation !== importGeneration;

  $('importGo').disabled = true;
  setStatus('reading pdf…', false, true);
  try {
    const run = async (allowOverwrite) => {
      // probe first: text PDFs skip rendering entirely; scans render to images
      const { hadText, total } = await probePdf(path);
      if (stale()) return null;

      let outcome;
      if (hadText) {
        setStatus('distilling — extracting chapter & answering…', false, true);
        outcome = await invoke('import_chapter', {
          req: { subject, num, title, pdf_path: path, questions, allow_overwrite: allowOverwrite },
          pageImages: null,
        });
      } else {
        setStatus(`rendering ${total} pages…`, false, true);
        const pages = await renderPdfPages(path, {
          onProgress: (n, t) => setStatus(`rendering pages ${n}/${t}…`, false, true),
        });
        if (stale()) return null;
        setStatus(`transcribing ${total} scanned pages (vision)…`, false, true);
        outcome = await invoke('import_chapter', {
          req: { subject, num, title, pdf_path: path, questions, allow_overwrite: allowOverwrite },
          pageImages: pages,
        });
      }
      return outcome;
    };

    let outcome;
    try {
      outcome = await run(false);
    } catch (e) {
      const msg = String(e);
      if (!msg.startsWith('note_exists:')) throw e;
      if (stale()) return;
      const existing = msg.slice('note_exists:'.length);
      const replace = window.confirm(
        `${existing} already exists.\n\nReplacing it will discard any edits made to that note. Continue?`,
      );
      if (!replace) {
        setStatus('import cancelled — the existing note was left alone', true);
        return;
      }
      outcome = await run(true);
    }
    if (stale() || !outcome) return;
    setStatus('');
    $('importModal').setAttribute('hidden', '');
    await refreshLibrary();
    await buildSearchIndex();
    // open the freshly-filed note by its real on-disk filename
    await openChapter(outcome.note.meta.subject, outcome.file);
    flash('chapter distilled & filed');
  } catch (e) {
    if (!stale()) setStatus(String(e), true);
  } finally {
    if (!stale()) $('importGo').disabled = false;
  }
});

async function openSettings() {
  const s = await invoke('get_settings');
  const st = await refreshAiStatus();
  // defaults show as empty fields so the placeholders explain them
  $('llmBaseUrl').value = s.llm_base_url === 'https://api.anthropic.com' ? '' : s.llm_base_url || '';
  $('llmModel').value = s.llm_model === 'claude-opus-5-5' ? '' : s.llm_model || '';
  $('llmKey').value = '';
  $('llmKey').placeholder = st.key_set ? '•••••••• saved — paste to replace' : 'sk-ant-…';
  $('llmClearKey').hidden = !st.key_set;
  $('llmKeyNote').textContent =
    st.key_error || 'get one at console.anthropic.com → API keys · stored in Windows Credential Manager';
  $('llmKeyNote').classList.remove('ok');
  $('llmKeyNote').classList.toggle('err', Boolean(st.key_error));
  $('settingsDirPath').textContent = await invoke('resolve_notes_dir');
  $('settingsModal').removeAttribute('hidden');
}
onOpenSettings(openSettings);
$('settingsBtn').addEventListener('click', openSettings);

$('llmTest').addEventListener('click', () =>
  testKey($('llmKey'), $('llmKeyNote'), {
    baseUrl: $('llmBaseUrl').value.trim(),
    model: $('llmModel').value.trim(),
  }),
);

$('llmClearKey').addEventListener('click', async () => {
  try {
    await invoke('set_llm_settings', {
      baseUrl: $('llmBaseUrl').value.trim(),
      model: $('llmModel').value.trim(),
      apiKey: null,
      clearKey: true,
    });
  } catch (e) {
    $('llmKeyNote').textContent = String(e);
    $('llmKeyNote').classList.add('err');
    return;
  }
  await refreshAiStatus();
  $('llmClearKey').hidden = true;
  $('llmKey').placeholder = 'sk-ant-…';
  flash('key removed');
});

$('chooseDirBtn').addEventListener('click', async () => {
  const dir = await dialogOpen({ directory: true, title: 'Choose notes folder' });
  if (dir) {
    await invoke('set_notes_dir', { dir });
    const resolved = await invoke('resolve_notes_dir');
    $('settingsDirPath').textContent = resolved;
    $('notesDir').textContent = resolved;
    // the open chapter belongs to the old library — drop it before reloading
    current = null;
    await refreshLibrary();
    await buildSearchIndex();
    await openFirst();
  }
});

$('settingsSave').addEventListener('click', async () => {
  try {
    await invoke('set_llm_settings', {
      baseUrl: $('llmBaseUrl').value.trim(),
      model: $('llmModel').value.trim(),
      apiKey: $('llmKey').value.trim() || null,
      clearKey: false,
    });
  } catch (e) {
    $('llmKeyNote').textContent = String(e);
    $('llmKeyNote').classList.add('err');
    return;
  }
  await refreshAiStatus();
  $('settingsModal').setAttribute('hidden', '');
  flash('settings saved');
});

// ---------- theme (Midnight Ink) ----------

const LIGHT_DIAGRAM = { ink: '#362B1E', inkSoft: '#6C5D49', rust: '#BC5A32', tintAccent: '#F3DFD0', tintAlt: '#E7DCC8' };
const MIDNIGHT_DIAGRAM = { ink: '#E9DCC4', inkSoft: '#B3A184', rust: '#D0744A', tintAccent: '#3E2A1E', tintAlt: '#352818' };
let midnight = false;

function applyTheme(on, { persist = true } = {}) {
  midnight = on;
  document.body.classList.toggle('midnight', on);
  setDiagramTheme(on ? MIDNIGHT_DIAGRAM : LIGHT_DIAGRAM);
  renderQuillMarks();
  $('themeBtn').textContent = on ? 'daylight paper' : 'midnight ink';
  // diagram colors are baked into SVG attributes at render time — re-render
  // the open view so on-screen diagrams re-palette live. Never during
  // practice writing (would wipe the in-progress answer) or an exam. Skipped
  // during boot (library not loaded yet — boot renders the view itself).
  if (!practiceQueue && !examPaper && library.length) {
    if (current) {
      // match on identity, not a recomputed slug: the filename belongs to Rust
      const note = allNotes.find(
        (n) => n.meta.subject === current.subject && n.meta.title === current.title,
      );
      if (note) renderChapter(note);
    } else {
      showDashboard();
    }
  }
  if (persist) {
    invoke('set_theme', { theme: on ? 'midnight' : 'light' }).catch((e) =>
      flash(`theme not saved: ${e}`, true),
    );
  }
}

$('themeBtn').addEventListener('click', () => applyTheme(!midnight));

$('readinessBtn').addEventListener('click', () => showDashboard());

// Export builders always render light cream-paper diagrams (print convention),
// even when studying in Midnight Ink.
function withLightDiagrams(fn, ...args) {
  const wasMidnight = midnight;
  setDiagramTheme(LIGHT_DIAGRAM);
  try {
    return fn(...args);
  } finally {
    if (wasMidnight) setDiagramTheme(MIDNIGHT_DIAGRAM);
  }
}

// ---------- boot ----------

async function openFirst() {
  if (library.length && !current) {
    await openChapter(library[0].subject, library[0].file);
  } else if (!library.length) {
    showDashboard();
  }
}

// ---------- readiness dashboard ----------

// The full deck over every note in the library — the dashboard's data source.
function wholeDeck() {
  return mergeDecks(allNotes.map(buildDeck));
}

async function loadStudyStateSafe() {
  try {
    return await invoke('load_study_state');
  } catch {
    return {};
  }
}

function fmtWhen(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const days = Math.floor((now - d) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

async function showDashboard() {
  current = null;
  const view = ++viewGeneration;
  ++chapterGeneration; // any in-flight chapter read is now stale
  renderSidebar();
  const state = await loadStudyStateSafe();
  if (view !== viewGeneration) return; // a chapter was opened while loading
  // mastery counts #write practice grades too (a written topic is a mastered
  // topic); weak-topics and the due pile stay flashcard-based — they feed
  // startStudy, which needs real cards
  const rawDeck = wholeDeck();
  const cards = withWriteCards(rawDeck, state);
  const overall = overallMastery(cards, state);
  const mastery = masteryBySubject(cards, state);
  const weak = weakTopics(rawDeck, state, 6);
  const due = buildDueDeck(rawDeck, state, Date.now());
  const dueSum = dueSummary(rawDeck, state, Date.now());

  const weakHtml = weak.length
    ? weak
        .map(
          (w) => `
      <div class="weak-row">
        <span class="weak-topic">${esc(w.title)}</span>
        <span class="weak-meta${w.misses ? ' miss' : ''}">${esc(w.subject)} · ${w.misses ? `${w.misses} miss${w.misses > 1 ? 'es' : ''}` : w.unseen ? 'not seen' : ''}</span>
      </div>`,
        )
        .join('')
    : `<div class="weak-empty">nothing weak — every card in the notebook is nailed.</div>`;

  const attemptsHtml = examHistory.length
    ? examHistory
        .slice(0, 3)
        .map(
          (a) => `
      <div class="attempt">
        <div class="attempt-score">${a.earned}<small>/${a.max}</small></div>
        <div class="attempt-meta">${esc(a.subjects || 'exam')} · ${a.qCount} questions · ${fmtWhen(a.gradedAt)}</div>
      </div>`,
        )
        .join('')
    : `<div class="weak-empty">no exams yet — set a paper and see where you stand.</div>`;

  $('chapterView').innerHTML = `
    <div class="dash">
      <div class="dash-hero">
        <div class="dash-eyebrow">readiness · ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        <h1 class="dash-title">Where you stand today</h1>
        <div class="dash-sub">${overall.mastered} of ${overall.total} cards mastered across ${mastery.length} subject${mastery.length === 1 ? '' : 's'}</div>
      </div>

      <div class="dash-actions">
        <button class="dash-btn" data-dash="due">study the weak pile${due.length ? ` · ${due.length}` : ''}</button>
        <button class="dash-btn ghost" data-dash="exam">mock exam</button>
      </div>

      <div class="dash-grid">
        <div class="dash-card">
          <div class="dash-card-tag">mastery by subject</div>
          <div class="mastery-overall">
            <div class="mastery-big">${overall.pct}%</div>
            <div class="mastery-big-note">overall<br />readiness</div>
          </div>
          ${mastery
            .map(
              (m) => `
          <div class="mastery-row">
            <div class="mastery-head">
              <span class="mastery-name">${esc(m.subject)}</span>
              <span class="mastery-pct">${m.mastered}/${m.total} · ${m.pct}%</span>
            </div>
            <div class="mastery-bar"><div class="mastery-fill" style="width:${m.pct}%"></div></div>
          </div>`,
            )
            .join('')}
          <div class="due-block">
            <div class="due-counts">due today: <b>${dueSum.weak}</b> weak · <b>${dueSum.new}</b> new · <b>${dueSum.stale}</b> stale</div>
          </div>
        </div>

        <div class="dash-card">
          <div class="dash-card-tag">weak topics — revise these first</div>
          <div class="weak-list">${weakHtml}</div>
          <div class="due-block">
            <div class="dash-card-tag">recent exams</div>
            <div class="attempt-list">${attemptsHtml}</div>
          </div>
        </div>
      </div>
    </div>`;

  $('chapterView')
    .querySelectorAll('[data-dash]')
    .forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (btn.dataset.dash === 'due') {
          const state = await loadStudyStateSafe();
          const due = buildDueDeck(wholeDeck(), state, Date.now());
          if (!due.length) {
            flash('nothing due — well studied');
            return;
          }
          const dueNotes = [...new Set(due.map(cardNoteOf).filter(Boolean))];
          startStudy(dueNotes, due);
        } else if (btn.dataset.dash === 'exam') {
          openExamSetup();
        }
      });
    });
}

// Map a card back to its source note (due cards → the notes they came from).
function cardNoteOf(card) {
  const subject = card.id.split('/')[0];
  return allNotes.find((n) => n.meta.subject === subject && card.id.startsWith(`${subject}/${n.meta.num}/`)) || null;
}

// ---------- study overlay (flashcards + quiz) ----------

let studySession = null;
let studyState = null;
let studyFlipped = false;
let studyNotes = null; // notes being studied (for quiz topic text)
let studyCards = null; // the exact deck this session runs on
let savedSession = null; // flashcard session paused while practicing/quiz runs
let quizItems = null;
let quizAnswered = null;
let studyGeneration = 0; // bumped on every open/close, so late replies are dropped

// Grades are small and worth protecting: surface a failed write instead of
// letting the session look saved and reappear ungraded on the next launch.
function saveStudyState() {
  if (!studyState) return;
  invoke('save_study_state', { state: studyState }).catch((e) =>
    flash(`could not save grades: ${e}`, true),
  );
}

async function startStudy(notes, prebuiltCards) {
  // prebuiltCards: an explicit card list (the dashboard's due pile) —
  // otherwise the deck is built from the notes themselves
  const cards = prebuiltCards || mergeDecks((notes || []).map(buildDeck));
  if (!cards.length) {
    flash('no cards in these notes yet');
    return;
  }
  const generation = ++studyGeneration;
  studyNotes = notes || [];
  studyCards = cards;
  savedSession = null;
  try {
    studyState = await invoke('load_study_state');
  } catch (e) {
    flash(`could not load grades: ${e}`, true);
    return;
  }
  if (generation !== studyGeneration) return; // closed while loading
  studySession = new Session(cards, studyState);
  studyFlipped = false;
  quizItems = null;
  practiceQueue = null;
  const overlay = $('studyOverlay');
  overlay.removeAttribute('hidden');
  document.addEventListener('keydown', studyKeys);
  $('studyClose').onclick = closeStudy;
  $('quizBtn').onclick = startQuiz;
  $('writeBtn').onclick = startPractice;
  showNextCard();
}

function closeStudy() {
  ++studyGeneration; // any in-flight quiz/practice reply is now stale
  const overlay = $('studyOverlay');
  overlay.setAttribute('hidden', '');
  document.removeEventListener('keydown', studyKeys);
  // persist grades on every exit so nothing is lost
  saveStudyState();
  studySession = null;
  studyNotes = null;
  studyCards = null;
  savedSession = null;
  quizItems = null;
  practiceQueue = null;
  setPracticeHint(false);
}

function cardBackHtml(card) {
  if (card.type === 'recall' && card.topic) return topicHtml(card.topic);
  return `<div class="study-back-text">${safeRich(card.back || '')}</div>`;
}

function showNextCard() {
  const card = studySession?.next();
  const wrap = $('studyCardWrap');
  if (!card) {
    wrap.innerHTML = `
      <div class="study-done">
        <div class="study-done-tag">deck complete</div>
        <div class="study-done-body">${studySession.done} cards seen · ${studySession.missedThisSession} missed</div>
        <button class="study-btn" id="studyAgain">run the missed pile again</button>
      </div>`;
    const again = $('studyAgain');
    if (again) {
      again.onclick = () => {
        const missedCards = Object.entries(studySession.state)
          .filter(([, st]) => st.missed > 0)
          .map(([id]) => studySession && [...studySession.queue, ...studySession.requeue].find((c) => c.id === id) || null)
          .filter(Boolean);
        // fall back: rebuild from the original notes if ids were exhausted
        const cards =
          missedCards.length ||
          mergeDecks((studyNotes || []).map(buildDeck)).filter(
            (c) => studyState?.[c.id]?.missed > 0,
          );
        if (!cards.length) {
          flash('nothing missed — well studied');
          return;
        }
        studySession = new Session(cards, studyState);
        showNextCard();
      };
    }
    $('studyProgress').textContent = 'deck complete';
    return;
  }
  studyFlipped = false;
  const front =
    card.type === 'trap'
      ? `<div class="study-card-type">trap check</div>`
      : card.type === 'qa'
        ? `<div class="study-card-type">question</div>`
        : `<div class="study-card-type">recall</div>`;
  wrap.innerHTML = `
    <div class="study-card" id="studyCard">
      ${front}
      <div class="study-card-front">${esc(card.front)}</div>
      <div class="study-card-back">${cardBackHtml(card)}</div>
    </div>`;
  $('studyCard').addEventListener('click', flipCard);
  const p = studySession.progress;
  $('studyProgress').textContent = `card ${p.done + 1} of ${p.done + p.remaining} · ${studySession.missedThisSession} missed`;
}

function flipCard() {
  studyFlipped = !studyFlipped;
  $('studyCard')?.classList.toggle('flipped', studyFlipped);
}

async function studyKeys(e) {
  if (e.repeat) return; // holding a grade key would otherwise skip whole cards
  if (e.key === 'Escape') return closeStudy();
  if (quizItems) return; // quiz has its own interaction
  if (practiceQueue) return; // practice writing has its own buttons — typing must not trigger grading
  if (e.key === ' ') {
    e.preventDefault();
    flipCard();
  } else if (e.key === '1' || e.key === '2') {
    if (!studySession?.current) return;
    if (e.key === '2' && !studyFlipped) flipCard(); // reveal before grading a miss
    studySession.grade(e.key === '1');
    // autosave grades periodically (every card is cheap — state is tiny)
    saveStudyState();
    showNextCard();
  }
}

// ---------- quiz mode ----------

async function startQuiz() {
  if (!requireKey('Quiz generation')) return;
  const wrap = $('studyCardWrap');
  if (!studyNotes?.length) return;
  const generation = studyGeneration;
  // pause the flashcard session like practice mode does — the quiz replaces
  // the card flow and there is no per-card resume after it
  savedSession = studySession;
  practiceQueue = null; // quiz replaces practice mode — hint is a lie there too
  setPracticeHint(false);
  $('quizBtn').disabled = true;
  $('writeBtn').disabled = true;
  wrap.innerHTML = `<div class="study-card"><div class="study-card-type">loading quiz…</div>
    <div class="study-card-front">generating questions from your notes</div>
    <div class="study-back-text"><span class="spinner"></span> thinking…</div></div>`;
  const topicsText = studyNotes
    .flatMap((n) =>
      (n.topics || []).map(
        (t) => `${t.title}\n${(t.body || []).join('\n').slice(0, 1200)}`,
      ),
    )
    .join('\n\n')
    .slice(0, 60000);
  try {
    const items = await invoke('gen_quiz', {
      noteTitle: studyNotes.map((n) => n.meta.title).join(' + '),
      topicsText,
    });
    if (generation !== studyGeneration) return; // closed, or a new session started
    quizItems = items;
    quizAnswered = new Set();
    renderQuiz();
  } catch (e) {
    if (generation !== studyGeneration) return;
    quizItems = null;
    wrap.innerHTML = `<div class="study-card"><div class="study-card-type">quiz unavailable</div>
      <div class="study-card-front">${esc(String(e).slice(0, 200))}</div>
      <div class="study-back-text">the flashcards still work — press esc to close this and keep studying</div></div>`;
  } finally {
    if (generation === studyGeneration) {
      $('quizBtn').disabled = false;
      $('writeBtn').disabled = false;
    }
  }
}

function renderQuiz() {
  const wrap = $('studyCardWrap');
  if (!quizItems?.length) {
    wrap.innerHTML = `<div class="study-card"><div class="study-card-type">quiz</div>
      <div class="study-card-front">no valid questions came back</div></div>`;
    return;
  }
  wrap.innerHTML = `
    <div class="study-quiz" id="studyQuiz">
      <div class="study-card-type">quiz · ${quizItems.length} questions</div>
      ${quizItems
        .map(
          (q, qi) => `
        <div class="quiz-item" data-qi="${qi}">
          <div class="quiz-q">${safeRich(q.question)}</div>
          <div class="quiz-options">
            ${q.options
              .map(
                (o, oi) => `
              <button class="quiz-opt" data-qi="${qi}" data-oi="${oi}">${esc(o)}</button>`,
              )
              .join('')}
          </div>
          <div class="quiz-explain"></div>
        </div>`,
        )
        .join('')}
      <div class="quiz-score" id="quizScore"></div>
    </div>`;
  wrap.querySelectorAll('.quiz-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      const qi = +btn.dataset.qi;
      const oi = +btn.dataset.oi;
      const q = quizItems[qi];
      if (quizAnswered.has(qi)) return;
      quizAnswered.add(qi);
      const item = btn.closest('.quiz-item');
      item.querySelectorAll('.quiz-opt').forEach((b, bi) => {
        b.classList.add(bi === q.correct ? 'correct' : bi === oi ? 'wrong' : 'dim');
      });
      item.querySelector('.quiz-explain').innerHTML = `${oi === q.correct ? '✔' : '✘'} ${safeRich(q.explanation)}`;
      updateQuizScore();
    });
  });
}

function itemAnsweredCorrect(qi) {
  // stored on the element data — find clicked wrong/correct pair
  const el = document.querySelector(`.quiz-item[data-qi="${qi}"] .quiz-opt.wrong`);
  return !el; // no wrong click on this item = correct
}

function updateQuizScore() {
  const total = quizItems.length;
  const done = quizAnswered.size;
  const right = [...quizAnswered].filter((qi) => itemAnsweredCorrect(qi)).length;
  const el = $('quizScore');
  if (el) el.textContent = `${right}/${done} correct${done < total ? ` · ${total - done} left` : ` of ${total}`}`;
}

// ---------- practice writing (exam trainer) ----------

let practiceQueue = null; // recall cards with topics, shuffled
let practiceIdx = 0;

// Model answer text for a recall card's topic: body lines joined (the frame).
function modelAnswerOf(card) {
  return (card.topic?.body || []).join('\n');
}

function startPractice() {
  const recallCards = (studyCards || []).filter((c) => c.type === 'recall' && c.topic);
  if (!recallCards.length) {
    flash('no topics to write from in this deck');
    return;
  }
  practiceQueue = recallCards;
  practiceIdx = 0;
  quizItems = null; // leave quiz interaction mode
  // pause the flashcard session so "back to flashcards" resumes, not restarts
  savedSession = studySession;
  setPracticeHint(true);
  showPracticeCard();
}

function setPracticeHint(on) {
  $('studyFoot').innerHTML = on
    ? '<span class="study-hint">esc · close anytime — grades save automatically</span>'
    : '<span class="study-hint">space · flip&nbsp;&nbsp;1 · got it&nbsp;&nbsp;2 · missed it</span>';
}

function showPracticeCard(keepAnswer) {
  const card = practiceQueue[practiceIdx];
  const wrap = $('studyCardWrap');
  if (!card) {
    wrap.innerHTML = `
      <div class="study-card">
        <div class="study-card-type">practice complete</div>
        <div class="study-done">
          <div class="study-done-tag">pens down</div>
          <div class="study-done-body">${practiceQueue.length} answers written from memory</div>
          <button class="study-btn" id="practiceBack">back to flashcards</button>
        </div>
      </div>`;
    $('practiceBack').onclick = () => {
      practiceQueue = null;
      setPracticeHint(false);
      // resume where the flashcards left off (falls back to a fresh Session
      // if none was saved — e.g. practice launched directly)
      studySession = savedSession || new Session(studyCards, studyState || {});
      savedSession = null;
      studyFlipped = false;
      showNextCard();
    };
    $('studyProgress').textContent = 'practice complete';
    return;
  }
  $('studyProgress').textContent = `write ${practiceIdx + 1} of ${practiceQueue.length}`;
  wrap.innerHTML = `
    <div class="practice-wrap">
      <div class="practice-card">
        <div class="study-card-type">practice writing · from memory</div>
        <div class="study-card-front">${esc(card.front)}</div>
        <div class="practice-hook">skeleton: ${esc(skeletonOf(card.topic))}</div>
        <textarea class="lined-paper" id="practiceInput" rows="7"
          placeholder="write the full answer from memory — hook, definition, key points, steps, example, trap…">${esc(keepAnswer || '')}</textarea>
        <div class="practice-actions">
          <button class="study-btn" id="practiceSubmit">check my answer</button>
          <button class="study-btn" id="practiceSkip">skip</button>
        </div>
        <div id="practiceFeedback"></div>
      </div>
    </div>`;
  $('practiceInput').focus();
  $('practiceSubmit').onclick = () => submitPractice(card);
  $('practiceSkip').onclick = () => {
    practiceIdx += 1;
    showPracticeCard();
  };
}

async function submitPractice(card) {
  const answer = $('practiceInput').value.trim();
  const fb = $('practiceFeedback');
  if (!answer) {
    flash('write something first — even the skeleton earns marks', true);
    return;
  }
  const generation = studyGeneration;
  // one grade per attempt — stop both buttons from re-entering this path
  const submitBtn = $('practiceSubmit');
  const skipBtn = $('practiceSkip');
  submitBtn.disabled = true;
  skipBtn.disabled = true;
  fb.innerHTML = `<div class="study-back-text"><span class="spinner"></span> invigilator is reading…</div>`;
  // persist a practice grade state entry so the dashboard sees the writing
  const stateKey = `${card.id.replace(/#recall$/, '')}#write`;
  let grade = null;
  try {
    grade = await invoke('grade_written', {
      topicTitle: card.front,
      modelAnswer: modelAnswerOf(card),
      studentAnswer: answer,
    });
  } catch { /* offline / provider down → self-grade below */ }
  // a closed or replaced session must not be written into by a late reply
  if (generation !== studyGeneration || $('studyOverlay').hasAttribute('hidden')) return;

  if (grade) {
    const st = studyState?.[stateKey] || { seen: 0, missed: 0, lastSeen: 0 };
    st.seen += 1;
    st.lastSeen = Date.now();
    st.missed = grade.verdict === 'solid' ? 0 : (st.missed || 0) + 1;
    if (studyState) {
      studyState[stateKey] = st;
      saveStudyState();
    }
    fb.innerHTML = `
      <div class="practice-gaps">
        <div class="practice-verdict ${esc(grade.verdict)}">${esc(grade.verdict)} · ${grade.score}/10</div>
        ${grade.gaps.map((g) => `<div class="practice-gap">${safeRich(g)}</div>`).join('')}
        ${grade.polish.map((p) => `<div class="practice-gap">${safeRich(p)}</div>`).join('')}
        ${practiceDiffHtml(card, answer)}
        <div class="practice-actions" style="margin-top:14px">
          <button class="study-btn" id="practiceNext">next topic</button>
          <button class="study-btn" id="practiceRetry">rewrite</button>
        </div>
      </div>`;
    $('practiceNext').onclick = () => {
      practiceIdx += 1;
      showPracticeCard();
    };
    // rewrite keeps the attempt on the paper
    $('practiceRetry').onclick = () => showPracticeCard(answer);
    return;
  }

  // LLM unavailable — side-by-side with self-grading
  fb.innerHTML = `
    <div class="practice-gaps">
      <div class="practice-verdict partial">offline — grade yourself honestly</div>
      ${practiceDiffHtml(card, answer)}
      <div class="practice-actions" style="margin-top:14px">
        <button class="study-btn" id="selfSolid">nailed it</button>
        <button class="study-btn" id="selfPartial">half remembered</button>
        <button class="study-btn" id="selfMissed">missed it</button>
      </div>
    </div>`;
  const selfGrade = (verdict) => {
    const st = studyState?.[stateKey] || { seen: 0, missed: 0, lastSeen: 0 };
    st.seen += 1;
    st.lastSeen = Date.now();
    st.missed = verdict === 'solid' ? 0 : (st.missed || 0) + 1;
    if (studyState) {
      studyState[stateKey] = st;
      invoke('save_study_state', { state: studyState }).catch(() => {});
    }
    practiceIdx += 1;
    showPracticeCard();
  };
  $('selfSolid').onclick = () => selfGrade('solid');
  $('selfPartial').onclick = () => selfGrade('partial');
  $('selfMissed').onclick = () => selfGrade('missed');
}

// The model answer rendered read-only next to what the student wrote.
function practiceDiffHtml(card, answer) {
  return `
    <div class="practice-diff">
      <div class="practice-diff-col">
        <h4>you wrote</h4>
        <textarea class="lined-paper" readonly rows="6">${esc(answer)}</textarea>
      </div>
      <div class="practice-diff-col">
        <h4>the note's answer</h4>
        <div class="lined-paper" style="overflow-y:auto; min-height:160px">${topicHtml(card.topic)}</div>
      </div>
    </div>`;
}

// ---------- note editing ----------

function setEditMode(on, note, btn) {
  const view = $('chapterView');
  const targets = [
    ...view.querySelectorAll('.topic-para, .qa-a, .qa-q, .recap p, .summary'),
  ];
  targets.forEach((el) => {
    el.contentEditable = on ? 'true' : 'false';
    el.classList.toggle('editing', on);
  });
  btn.textContent = on ? 'save' : 'edit';
  btn.classList.toggle('btn-accent', on);
  if (!on) saveEdits(note);
}

async function saveEdits(note) {
  const view = $('chapterView');
  // rebuild bodies topic by topic from the DOM
  const topics = [...view.querySelectorAll('.topic')].map((sec, ti) => {
    const orig = note.topics?.[ti] || { title: '', body: [], diagrams: [], qa: [] };
    const body = [...sec.querySelectorAll('.topic-para')].map((p) => p.innerText.trim());
    const qa = [...sec.querySelectorAll('.qa-item')].map((qaEl) => ({
      q: qaEl.querySelector('.qa-q')?.innerText.trim() || '',
      a: qaEl.querySelector('.qa-a')?.innerText.trim() || '',
    }));
    return { ...orig, body, qa };
  });
  // Legacy notes keep Q&A at note level, outside any .topic — rebuild that too,
  // or those edits are silently dropped on save.
  const legacyQa = topics.length
    ? note.qa
    : [...view.querySelectorAll('.qa-item')].map((qaEl) => ({
        q: qaEl.querySelector('.qa-q')?.innerText.trim() || '',
        a: qaEl.querySelector('.qa-a')?.innerText.trim() || '',
      }));
  const summaryEl = view.querySelector('.summary');
  const recapEl = view.querySelector('.recap p');
  const edited = {
    ...note,
    // an emptied field is an intentional edit, so only fall back when absent
    summary: summaryEl ? summaryEl.innerText.trim() : note.summary,
    recap: recapEl ? recapEl.innerText.trim() : note.recap,
    qa: legacyQa,
    topics: topics.length ? topics : note.topics,
  };
  const generation = chapterGeneration;
  try {
    await invoke('save_note', { note: edited });
    flash('saved to disk');
    // re-read from disk: proves the round-trip and re-renders cleanly
    const fresh = await invoke('read_note', { subject: current.subject, file: current.file });
    if (generation !== chapterGeneration) return; // navigated away mid-save
    // take the filename from the library rather than recomputing the slug here
    await refreshLibrary();
    const entry = library.find(
      (e) => e.subject === fresh.meta.subject && e.title === fresh.meta.title,
    );
    current = {
      subject: fresh.meta.subject,
      file: entry ? entry.file : current.file,
      title: fresh.meta.title,
    };
    renderChapter(fresh);
    await buildSearchIndex();
  } catch (e) {
    flash(`save failed: ${e}`, true);
  }
}

// ---------- cheat-sheet export ----------

async function exportCheatSheet(subject) {
  const notes = [];
  for (const e of library.filter((x) => x.subject === subject).sort((a, b) => a.num.localeCompare(b.num))) {
    notes.push(await invoke('read_note', { subject: e.subject, file: e.file }));
  }
  if (!notes.length) return;
  const html = withLightDiagrams(buildCheatSheetHtml, subject, notes);
  const dest = await dialogSave({
    title: 'Export cheat sheet',
    defaultPath: `${subject}-cheat-sheet.html`,
    filters: [{ name: 'Styled HTML', extensions: ['html'] }],
  });
  if (!dest) return;
  try {
    await invoke('write_export', { dest, contents: html });
    flash(`cheat sheet saved — ${dest}`);
  } catch (e) {
    flash(`cheat sheet failed: ${e}`, true);
  }
}

function buildCheatSheetHtml(subject, notes) {
  const sections = notes
    .map((n) => {
      const cards = (n.topics || [])
        .map((t) => {
          const trap = trapOf(t);
          const skel = skeletonOf(t);
          const formula = (t.body || []).find((b) => /^Complexity[.:]/.test(String(b))) || '';
          return `
        <div class="cheat-topic">
          <div class="cheat-title">${esc(t.title)}</div>
          ${skel ? `<div class="cheat-skel">${safeRich(skel)}</div>` : ''}
          ${trap ? `<div class="cheat-trap">⚠ ${safeRich(trap)}</div>` : ''}
          ${formula ? `<div class="cheat-formula">${safeRich(formula)}</div>` : ''}
        </div>`;
        })
        .join('');
      return cards
        ? `<h2>${esc(n.meta.num)} · ${esc(n.meta.title)}</h2><div class="cheat-grid">${cards}</div>`
        : '';
    })
    .join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(subject)} — cheat sheet</title>
<style>
${CHEAT_CSS}
</style>
</head>
<body>
<div class="eyebrow">${esc(subject)} · cheat sheet — hooks, frames, traps</div>
${sections}
<div class="footer">printed from Quillpad — the margin is where the real thinking happens</div>
</body>
</html>`;
}

const CHEAT_CSS = `
  :root { --paper:#F3EADA; --ink:#362B1E; --ink-soft:#6C5D49;
    --rust:#BC5A32; --rust-soft:#E0A579; --line:rgba(54,43,30,0.14); }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { background: var(--paper); color: var(--ink);
    font-family: 'Source Serif 4', Georgia, serif; margin: 0; padding: 28px 36px; }
  .eyebrow { font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 10px;
    letter-spacing: 1.8px; text-transform: uppercase; color: var(--rust); margin-bottom: 14px; }
  h2 { font-family: Fraunces, Georgia, serif; font-style: italic; font-size: 15px;
    margin: 18px 0 8px; color: var(--rust); border-bottom: 1px dashed var(--rust-soft); padding-bottom: 4px; }
  .cheat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; }
  .cheat-topic { border: 1px dashed var(--line); border-radius: 4px; padding: 8px 11px; break-inside: avoid; }
  .cheat-title { font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 10.5px;
    text-transform: uppercase; letter-spacing: .8px; color: var(--ink); margin-bottom: 4px; }
  .cheat-skel { font-family: 'Caveat', cursive; font-size: 16px; color: var(--rust); line-height: 1.3; }
  .cheat-trap { font-size: 12.5px; color: var(--ink); line-height: 1.4; margin-top: 4px; }
  .cheat-formula { font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 10.5px; color: var(--ink-soft); margin-top: 4px; }
  .footer { margin-top: 26px; font-family: 'IBM Plex Mono', Consolas, monospace;
    font-size: 9.5px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink-soft); }
  @media print { .cheat-grid { gap: 8px 14px; } body { padding: 12px 18px; } }
`;

// ---------- mock exam (exam simulator) ----------

let examTimer = null;
let examPaper = null; // [{number, question, modelAnswer, src, kind, marks}]
let examDeadline = 0;
let examSubmitting = false; // guards double-submit (clock tick + button)
let examSubjectsPicked = new Set();
let examSetupToken = 0; // bumped on cancel — invalidates in-flight generation

// setup modal: subject chips + count/duration choices
function openExamSetup() {
  // clear any stale status from the previous setup session
  $('examSetupStatus').setAttribute('hidden', '');
  const subjects = [...new Set(allNotes.map((n) => n.meta.subject))].filter(Boolean);
  if (!subjects.length) {
    flash('import some chapters first — the paper is set from your notes', true);
    return;
  }
  examSubjectsPicked = new Set(subjects);
  $('examSubjects').innerHTML = subjects
    .map(
      (s) =>
        `<button class="exam-choice${examSubjectsPicked.has(s) ? ' on' : ''}" data-subject="${esc(s)}">${esc(s)}</button>`,
    )
    .join('');
  $('examSubjects')
    .querySelectorAll('.exam-choice')
    .forEach((chip) => {
      chip.onclick = () => {
        const s = chip.dataset.subject;
        if (examSubjectsPicked.has(s)) examSubjectsPicked.delete(s);
        else examSubjectsPicked.add(s);
        chip.classList.toggle('on', examSubjectsPicked.has(s));
      };
    });
  [['examCount', 10], ['examDuration', 1200]].forEach(([id, def]) => {
    $(id).querySelectorAll('.exam-choice').forEach((c) => {
      c.classList.toggle('on', +c.dataset.v === def);
      c.onclick = () => {
        $(id).querySelectorAll('.exam-choice').forEach((x) => x.classList.remove('on'));
        c.classList.add('on');
      };
    });
  });
  $('examSetupModal').removeAttribute('hidden');
}

$('examSetupCancel').onclick = () => {
  $('examSetupModal').setAttribute('hidden', '');
  // invalidate any in-flight paper generation so it can't start an exam
  // the student just cancelled out of
  examSetupToken++;
};

function examChoiceVal(id) {
  const on = $(id).querySelector('.exam-choice.on');
  return on ? +on.dataset.v : 10;
}

function examSetStatus(msg, spinning = true) {
  const el = $('examSetupStatus');
  el.removeAttribute('hidden');
  el.classList.remove('err');
  el.innerHTML = (spinning ? '<span class="spinner"></span>' : '') + esc(msg);
}

$('examSetupGo').onclick = async () => {
  const subjects = [...examSubjectsPicked];
  if (!subjects.length) {
    examSetStatus('pick at least one subject', false);
    return;
  }
  const count = examChoiceVal('examCount');
  const duration = examChoiceVal('examDuration');
  const token = ++examSetupToken; // any cancel re-opens with a fresh token
  $('examSetupGo').disabled = true;
  examSetStatus('assembling your paper…');
  try {
    // real questions from the picked subjects' notes first
    const notes = allNotes.filter((n) => subjects.includes(n.meta.subject));
    const real = realQuestions(notes);
    let generated = [];
    if (real.length < count) {
      examSetStatus(`writing ${count - real.length} more question${count - real.length === 1 ? '' : 's'} in exam style…`);
      const topicsText = notes
        .flatMap((n) =>
          (n.topics || []).map((t) => `${t.title}\n${(t.body || []).join('\n').slice(0, 1200)}`),
        )
        .join('\n\n')
        .slice(0, 60000);
      try {
        generated = await invoke('gen_written_questions', {
          subjects: subjects.join(' + '),
          topicsText,
          count: count - real.length,
        });
      } catch { /* offline: paper proceeds with real questions only */ }
    }
    if (token !== examSetupToken) return; // cancelled mid-generation
    const paper = assemblePaper({
      real,
      // Rust returns {question, model_answer} (serde snake_case) — normalize
      // to the paper's camelCase shape so grading + model-answer reveals work
      generated: generated.map((g) => ({
        q: g.question,
        modelAnswer: g.model_answer || g.modelAnswer || '',
        src: subjects.join(' + '),
      })),
      count,
      seed: Date.now() % 100000,
    });
    if (!paper.length) {
      examSetStatus('no questions could be set — check that your notes carry questions or topics', false);
      return;
    }
    $('examSetupModal').setAttribute('hidden', '');
    if (paper.length < count) {
      flash(`paper set with ${paper.length} of ${count} questions — the question writer is offline, your notes' own questions carried the paper`);
    }
    startExam(paper, duration, subjects.join(' + '));
  } catch (e) {
    examSetStatus(String(e).slice(0, 200), false);
  } finally {
    $('examSetupGo').disabled = false;
  }
};

function startExam(paper, durationSec, subjectsLabel) {
  examPaper = paper;
  examSubmitting = false;
  $('examSubmitBtn').disabled = false;
  const max = paper.reduce((n, q) => n + q.marks, 0);
  $('examHeadInfo').textContent = `${subjectsLabel} · ${paper.length} questions · ${max} marks`;
  $('examClock').textContent = clockOf(durationSec);
  $('examClock').classList.remove('warn');
  $('examBody').innerHTML = `
    <div class="exam-paper">
      ${paper
        .map(
          (q, i) => `
        <div class="exam-q" style="animation-delay:${Math.min(i * 60, 400)}ms">
          <div class="exam-q-head">
            <span class="exam-q-num">${q.number}.</span>
            <span class="exam-q-text">${safeRich(q.q)}</span>
            <span class="exam-q-marks">[5 marks]</span>
          </div>
          <textarea class="lined-paper exam-answer" data-qi="${i}" rows="6"
            placeholder="answer here — structure earns marks…"></textarea>
        </div>`,
        )
        .join('')}
    </div>`;
  $('examOverlay').removeAttribute('hidden');
  examDeadline = Date.now() + durationSec * 1000;
  clearInterval(examTimer);
  examTimer = setInterval(tickExamClock, 1000);
  document.addEventListener('keydown', examKeys);
  document.querySelector('.exam-answer')?.focus();
}

// Esc mid-exam: offer an abandon instead of trapping the student in the paper
function examKeys(e) {
  if (e.key !== 'Escape') return;
  // self-grade view is up — abandon there too
  if (selfGradeResolve) {
    e.preventDefault();
    showAbandonBar(() => {
      const done = selfGradeResolve;
      selfGradeResolve = null;
      examPaper = null; // marks the abandon; submitExam's null path cleans up
      done(null);
    });
    return;
  }
  if (!examPaper || examSubmitting) return;
  e.preventDefault();
  showAbandonBar(() => closeExam());
}

// In-app abandon confirm (window.confirm can be silently swallowed by the
// WebView2 host) — a rust-styled bar replacing the exam head actions.
let abandonBarOpen = false;
function showAbandonBar(onYes) {
  if (abandonBarOpen) return;
  const head = document.querySelector('.exam-head');
  if (!head) return; // no bar without a head — don't latch the flag
  abandonBarOpen = true;
  const bar = document.createElement('div');
  bar.className = 'abandon-bar';
  bar.innerHTML = `
    <span class="abandon-text">discard this exam?</span>
    <button class="study-btn" id="abandonYes">yes, discard</button>
    <button class="study-btn" id="abandonNo">keep writing</button>`;
  head.appendChild(bar);
  const close = () => {
    bar.remove();
    abandonBarOpen = false;
    document.removeEventListener('keydown', dismissAbandon, true);
  };
  const dismissAbandon = (ev) => {
    if (ev.key === 'Escape') {
      ev.stopImmediatePropagation();
      close();
    }
  };
  // a second Esc closes the bar without discarding (capture phase, so it
  // swallows the Escape before examKeys could re-trigger anything)
  document.addEventListener('keydown', dismissAbandon, true);
  bar.querySelector('#abandonYes').onclick = () => {
    close();
    onYes();
  };
  bar.querySelector('#abandonNo').onclick = close;
}

function closeExam() {
  clearInterval(examTimer);
  examTimer = null;
  examPaper = null;
  examSubmitting = false;
  document.removeEventListener('keydown', examKeys);
  $('examSubmitBtn').disabled = false;
  $('examOverlay').setAttribute('hidden', '');
  showDashboard();
}

function tickExamClock() {
  const left = Math.max(0, Math.ceil((examDeadline - Date.now()) / 1000));
  const clock = $('examClock');
  clock.textContent = clockOf(left);
  clock.classList.toggle('warn', left <= 120);
  // test the real deadline, not the rounded display value
  if (Date.now() >= examDeadline) {
    clearInterval(examTimer);
    submitExam(true);
  }
}

$('examSubmitBtn').onclick = () => submitExam(false);

function collectAnswers() {
  return (examPaper || []).map((q, i) => {
    const ta = document.querySelector(`.exam-answer[data-qi="${i}"]`);
    return ta ? ta.value.trim() : '';
  });
}

async function submitExam(auto) {
  const paper = examPaper;
  if (!paper || examSubmitting) return;
  clearInterval(examTimer);
  const answers = collectAnswers();
  const anyAnswer = answers.some((a) => a.length > 0);
  if (!auto && !anyAnswer) {
    // nothing written and not a timeout — keep the paper running
    flash('nothing written — the exam is still running', true);
    examTimer = setInterval(tickExamClock, 1000);
    return;
  }
  examSubmitting = true;
  $('examSubmitBtn').disabled = true;
  // paper is in the evaluator's hands — Esc no longer means abandon
  document.removeEventListener('keydown', examKeys);

  // grading view while the evaluator reads
  $('examClock').textContent = auto ? '00:00 — time' : clockOf(Math.round((examDeadline - Date.now()) / 1000));
  $('examBody').innerHTML = `
    <div class="exam-result">
      <div class="exam-result-head">
        <div class="study-card-type">evaluating your paper…</div>
        <div class="study-back-text"><span class="spinner"></span> the evaluator is reading ${answers.filter(Boolean).length} answer${answers.filter(Boolean).length === 1 ? '' : 's'}…</div>
      </div>
    </div>`;

  let qresults = null;
  try {
    qresults = await invoke('grade_exam', {
      paperJson: JSON.stringify(
        paper.map((q) => ({ number: q.number, question: q.q, model_answer: q.modelAnswer || '' })),
      ),
      answers,
    });
  } catch { /* offline → self-grade below */ }

  // an empty or partial result is not a valid grading: accepting it would
  // record a zero the student never earned, so fall through to self-grading
  if (!Array.isArray(qresults) || qresults.length < paper.length) qresults = null;

  let attempt;
  if (qresults) {
    // if the grader numbered questions from 0 (or drifted), none of its
    // numbers match the paper — fall back to positional order
    const paperNumbers = new Set(paper.map((q) => q.number));
    const aligned = qresults.some((r) => paperNumbers.has(r.number))
      ? qresults
      : paper.map((q, i) => ({ number: q.number, earned: qresults[i]?.earned ?? 0, feedback: qresults[i]?.feedback || '' }));
    attempt = scoreAttempt(paper, aligned);
  } else {
    // self-grade fallback: checkbox-style marks per question
    const self = await selfGradeExam(paper, answers);
    if (!self) {
      // abandoned via Esc during self-grading — close without recording
      examPaper = null;
      examSubmitting = false;
      document.removeEventListener('keydown', examKeys);
      $('examSubmitBtn').disabled = false;
      $('examOverlay').setAttribute('hidden', '');
      flash('exam abandoned');
      return;
    }
    attempt = self;
  }

  // record the attempt (newest first)
  const record = {
    subjects: $('examHeadInfo').textContent.split(' · ')[0],
    qCount: paper.length,
    earned: attempt.earned,
    max: attempt.max,
    pct: attempt.pct,
    gradedAt: attempt.gradedAt,
    selfGraded: !qresults,
  };
  examHistory = [record, ...examHistory].slice(0, 20);
  invoke('save_exam_history', { history: examHistory }).catch((e) =>
    flash(`exam not recorded: ${e}`, true),
  );
  renderExamResult(paper, attempt, answers, !!qresults);
}

// Offline fallback: let the student award marks per question against the model
// answers, then submit.
let selfGradeResolve = null; // set while the self-grade view is open

function selfGradeExam(paper, answers) {
  return new Promise((resolve) => {
    selfGradeResolve = resolve;
    // Esc is an abandon again while this view is up
    document.addEventListener('keydown', examKeys);
    $('examBody').innerHTML = `
      <div class="exam-result">
        <div class="exam-result-head">
          <div class="study-card-type">evaluator offline — grade yourself</div>
          <div class="exam-result-line">award marks honestly, against each model answer</div>
        </div>
        ${paper
          .map(
            (q, i) => `
        <div class="exam-result-q">
          <div class="exam-q-head">
            <span class="exam-q-num">${q.number}.</span>
            <span class="exam-q-text">${safeRich(q.q)}</span>
          </div>
          <div class="exam-model-answer">${(q.modelAnswer || '(no model answer in the notes)').split('\n').map((l) => `<p>${safeRich(l)}</p>`).join('')}</div>
          <div class="self-grade-row">
            <span class="self-grade-label">your answer: ${answers[i]?.trim() ? `${answers[i].trim().split(/\s+/).length} words` : 'blank'} ·</span>
            ${[0, 1, 2, 3, 4, 5]
              .map((m) => `<button class="exam-choice self-mark" data-qi="${i}" data-m="${m}">${m}</button>`)
              .join('')}
          </div>
        </div>`,
          )
          .join('')}
        <div class="exam-result-actions">
          <button class="dash-btn" id="selfGradeDone">submit self-grades</button>
        </div>
      </div>`;
    const marks = new Array(paper.length).fill(null);
    $('examBody').querySelectorAll('.self-mark').forEach((btn) => {
      btn.onclick = () => {
        const qi = +btn.dataset.qi;
        marks[qi] = +btn.dataset.m;
        btn.closest('.self-grade-row').querySelectorAll('.self-mark').forEach((b) => b.classList.remove('on'));
        btn.classList.add('on');
      };
    });
    $('selfGradeDone').onclick = () => {
      if (marks.some((m) => m === null)) {
        flash('award marks on every question first', true);
        return;
      }
      selfGradeResolve = null;
      resolve(
        scoreAttempt(
          paper,
          marks.map((m, i) => ({ number: paper[i].number, earned: m, feedback: 'self-graded' })),
        ),
      );
    };
  });
}

function renderExamResult(paper, attempt, answers, llmGraded) {
  const v = verdictOf(attempt.pct);
  $('examHeadInfo').textContent = `result · ${v.band}${llmGraded ? '' : ' · self-graded'}`;
  $('examClock').textContent = `${attempt.earned}/${attempt.max}`;
  $('examClock').classList.remove('warn');
  $('examBody').innerHTML = `
    <div class="exam-result">
      <div class="exam-result-head">
        <div class="exam-result-score">${attempt.pct}<small>%</small></div>
        <div class="exam-result-band">${esc(v.band)}</div>
        <div class="exam-result-line">${esc(v.line)}</div>
        <div class="exam-result-line">${attempt.earned} of ${attempt.max} marks${llmGraded ? '' : ' — self-graded'}</div>
      </div>
      ${attempt.questions
        .map(
          (q, i) => `
        <div class="exam-result-q">
          <div class="exam-q-head">
            <span class="exam-q-num">${q.number}.</span>
            <span class="exam-q-text">${safeRich(q.q)}</span>
            <span class="exam-q-marks">${q.earned}/${q.marks}</span>
          </div>
          <div class="exam-grade-row">
            <span class="exam-grade-mark">${q.earned}/${q.marks}</span>
            <span class="exam-grade-feedback">${safeRich(q.feedback || '')}</span>
          </div>
          <button class="exam-model-toggle" data-q="${i}">show model answer</button>
          <div class="exam-model-answer" data-answer="${i}" hidden>
            ${(paper[i].modelAnswer || '(no model answer in the notes)').split('\n').map((l) => `<p>${safeRich(l)}</p>`).join('')}
          </div>
        </div>`,
        )
        .join('')}
      <div class="exam-result-actions">
        <button class="dash-btn" id="examDone">back to readiness</button>
        <button class="dash-btn ghost" id="examAgain">another paper</button>
      </div>
    </div>`;
  $('examBody').querySelectorAll('.exam-model-toggle').forEach((btn) => {
    btn.onclick = () => {
      const ans = $('examBody').querySelector(`[data-answer="${btn.dataset.q}"]`);
      const show = ans.hasAttribute('hidden');
      ans.toggleAttribute('hidden', !show);
      btn.textContent = show ? 'hide model answer' : 'show model answer';
    };
  });
  $('examDone').onclick = () => {
    closeExam();
  };
  $('examAgain').onclick = () => {
    closeExam();
    openExamSetup();
  };
}

// ---------- cover page ----------

// the full-featured quill rides the writing line on the cover
const COVER_QUILL = `
<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 700 200 Q 620 480 330 580" stroke-width="54"/>
    <path d="M 647 336 Q 557 196 462 181" stroke-width="34"/>
    <path d="M 618 389 Q 528 249 433 234" stroke-width="30"/>
    <path d="M 585 440 Q 495 300 400 285" stroke-width="26"/>
  </g>
  <path d="M 330 580 A 120 120 0 1 1 226 640 Q 185 690 245 748" fill="none"
    stroke="currentColor" stroke-width="42" stroke-linecap="round"/>
  <path d="M 415 785 Q 500 815 585 815" fill="none"
    stroke="#BC5A32" stroke-width="42" stroke-linecap="round"/>
</svg>`;

function dismissCover() {
  const cover = $('coverPage');
  if (!cover || cover.classList.contains('gone')) return;
  cover.classList.add('gone');
  // after the fade, fully remove from layout
  setTimeout(() => cover.setAttribute('hidden', ''), 520);
}

function renderQuillMarks() {
  const accent = midnight ? MIDNIGHT_DIAGRAM.rust : LIGHT_DIAGRAM.rust;
  $('coverMark').innerHTML = quillMarkFull();
  $('brandMark').innerHTML = quillMark('qpQ', accent);
}

function showCover() {
  const cover = $('coverPage');
  if (!cover) return;
  renderQuillMarks();
  $('coverQuill').innerHTML = COVER_QUILL;
  cover.addEventListener('click', dismissCover, { once: true });
}

async function boot() {
  showCover();
  // restore persisted theme before first render
  try {
    const s = await invoke('get_settings');
    if (s.theme === 'midnight') applyTheme(true, { persist: false });
  } catch { /* default light */ }
  const dir = await invoke('resolve_notes_dir');
  $('notesDir').textContent = dir;
  await refreshLibrary();
  await buildSearchIndex();
  try {
    examHistory = await invoke('load_exam_history');
  } catch { /* no history yet */ }
  showDashboard();
  await maybeShowWelcome({
    onFolderChanged: async () => {
      $('notesDir').textContent = await invoke('resolve_notes_dir');
      current = null;
      await refreshLibrary();
      await buildSearchIndex();
      showDashboard();
    },
  });
}

boot();
