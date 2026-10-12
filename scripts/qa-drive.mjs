// Drive the real Quillpad exe over WebView2's DevTools port and check the
// fresh-user flows. Pair with scripts/qa-fresh-user.sh (start → this → restore).
//
//   node scripts/qa-drive.mjs first-run   # fresh profile, before any relaunch
//   node scripts/qa-drive.mjs relaunch    # after `qa-fresh-user.sh relaunch`
//
// Screenshots land in $QA_SHOTS (default: .superpowers/qa-shots).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const puppeteer = require('puppeteer-core');

const PORT = process.env.QA_PORT || '9223';
const SHOTS = process.env.QA_SHOTS || '.superpowers/qa-shots';
const phase = process.argv[2] || 'first-run';
mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      return await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null });
    } catch {
      await sleep(500);
    }
  }
  throw new Error(`no WebView2 DevTools on :${PORT} — is the app running via qa-fresh-user.sh?`);
}

const browser = await connect();
let page = null;
for (let i = 0; i < 40 && !page; i++) {
  const pages = await browser.pages();
  page = pages.find((p) => !p.url().startsWith('devtools')) || null;
  if (!page) await sleep(250);
}
if (!page) throw new Error('app page not found');

// the window can exist before the app's page has loaded
await page.waitForSelector('.app', { timeout: 30000 });

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));
// CSP violations raised before we attached are replayed by reloading once.
await page.evaluate(() => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) =>
    window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`),
  );
});
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('#coverPage', { timeout: 30000 });
await page.evaluate(() => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) =>
    window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`),
  );
});
await sleep(1500);

const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${phase}-${name}.png`) });
const visible = (sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el || el.hidden || el.closest('[hidden]')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  }, sel);
const text = (sel) => page.$eval(sel, (el) => el.textContent.trim()).catch(() => '');
const click = async (sel) => {
  await page.$eval(sel, (el) => el.click());
  await sleep(400);
};

// ---- cover ----
check('cover shows on launch', await visible('#coverPage'));
await shot('01-cover');
await click('#coverPage');
await sleep(700);
check('cover dismisses on click', !(await visible('#coverPage')));

if (phase === 'first-run') {
  // ---- welcome ----
  check('welcome shows on first run', await visible('#welcomeModal'));
  check('welcome shows the notes folder', (await text('#welcomeDir')).length > 3, await text('#welcomeDir'));
  await shot('02-welcome');
  await click('#welcomeTest');
  await sleep(500);
  check('welcome test with empty key asks for one', /paste a key/.test(await text('#welcomeKeyNote')), await text('#welcomeKeyNote'));
  await click('#welcomeSkip');
  await sleep(600);
  check('welcome skip closes it', !(await visible('#welcomeModal')));
}

if (phase === 'relaunch') {
  check('welcome does not show again', !(await visible('#welcomeModal')));
  check('midnight theme persisted', await page.evaluate(() => document.body.classList.contains('midnight')));
}

// ---- library ----
const chapters = await page.$$eval('.chapter-item', (els) => els.map((e) => e.textContent.trim()));
check('seed chapters listed', chapters.length >= 5, `${chapters.length} chapters`);
await shot('03-dashboard');

let diagramsOk = true;
for (let i = 0; i < chapters.length; i++) {
  await page.$$eval('.chapter-item', (els, n) => els[n].click(), i);
  await sleep(700);
  const title = await text('.chap-title');
  const svgs = await page.$$eval('#chapterView svg', (els) => els.length);
  if (!title) diagramsOk = false;
  if (i === 1) await shot('04-chapter');
  console.log(`      ${title || '(no title)'} — ${svgs} svg`);
}
check('every chapter opens with a title', diagramsOk);

// ---- offline ask ----
await page.click('#askInput', { clickCount: 3 });
await page.type('#askInput', 'mitochondria');
await sleep(900);
const res = await text('#results');
check('offline ask finds mitochondria → Biology', /biology/i.test(res), res.slice(0, 80));
await shot('05-ask');
await page.click('#askInput', { clickCount: 3 });
await page.keyboard.press('Backspace');

// ---- no-key gates ----
await click('#modeOnline');
check('online mode without key shows key prompt', await visible('#keyPrompt'));
check('mode stays offline', await page.$eval('#modeOffline', (e) => e.classList.contains('on')));
await shot('06-key-prompt');
await click('.key-prompt-close');
check('key prompt closes', !(await visible('#keyPrompt')));

await click('#importBtn');
check('import without key shows key prompt', await visible('#keyPrompt'));
check('import wizard stays closed', !(await visible('#importModal')));
await click('.key-prompt-open');
check('"add a key" opens settings', await visible('#settingsModal'));

// ---- settings ----
check('settings has no .env/provider wording', !/\.env|seekai|gorouter/i.test(await text('#settingsModal')));
await page.type('#llmKey', 'sk-ant-api03-not-a-real-key');
await click('#llmTest');
for (let i = 0; i < 40 && /checking/.test(await text('#llmKeyNote')); i++) await sleep(500);
const verdict = await text('#llmKeyNote');
check('bad key is rejected in plain English', /rejected|couldn't reach/.test(verdict), verdict);
await shot('07-settings-badkey');
await page.$eval('#llmKey', (e) => (e.value = ''));
await page.$eval('.settings-advanced', (e) => (e.open = true));
await page.$eval('#llmBaseUrl', (e) => (e.value = ''));
await page.type('#llmBaseUrl', 'https://api.anthropic.com/v1/');
await click('#settingsSave');
check('settings save closes the modal', !(await visible('#settingsModal')));
await click('#settingsBtn');
await sleep(500);
check('pasted /v1/ base URL normalizes to the default', (await page.$eval('#llmBaseUrl', (e) => e.value)) === '');
await click('#settingsClose');

// ---- flashcards ----
await page.$$eval('.chapter-item', (els) => els[1].click());
await sleep(600);
await page.$$eval('.export-btn', (els) => els.find((b) => b.dataset.act === 'study').click());
await sleep(700);
check('study overlay opens', await visible('#studyOverlay'));
await page.keyboard.press('Space');
await sleep(400);
await shot('08-flashcard');
await page.keyboard.press('1');
await sleep(400);
await click('#quizBtn');
check('quiz without key shows key prompt', await visible('#keyPrompt'));
await click('.key-prompt-close');
await page.keyboard.press('Escape');
await sleep(500);
check('study overlay closes on Esc', !(await visible('#studyOverlay')));

// ---- edit a note ----
const MARK = 'QA edit marker — written by qa-drive';
const openChapter = async (i) => {
  await page.$$eval('.chapter-item', (els, n) => els[n].click(), i);
  await sleep(700);
};
if (phase === 'first-run') {
  await openChapter(1);
  const editBtn = () => page.$$eval('.export-btn', (els) => els.find((b) => b.dataset.act === 'edit').click());
  await editBtn();
  await sleep(300);
  await page.$eval('.recap p', (el, m) => {
    el.textContent = m;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, MARK);
  await editBtn(); // the same button now reads "save"
  await sleep(900);
  await openChapter(0);
  await openChapter(1);
  check('edited recap is saved', (await text('.recap')).includes(MARK), (await text('.recap')).slice(0, 50));
}
if (phase === 'relaunch') {
  await openChapter(1);
  check('edited recap survives a restart', (await text('.recap')).includes(MARK), (await text('.recap')).slice(0, 50));
}

// ---- exports (the Save dialog is stubbed; the real export code runs) ----
if (phase === 'first-run') {
  const { mkdirSync, existsSync, readFileSync, rmSync } = await import('node:fs');
  const outDir = path.join(process.env.TEMP, 'quillpad-qa', 'exports');
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  // __TAURI_INTERNALS__ is frozen, so answer the dialog's IPC request instead:
  // Tauri IPC is a POST to http://ipc.localhost/<command>.
  await page.setRequestInterception(true);
  const onRequest = (req) => {
    const u = decodeURIComponent(req.url());
    if (req.method() === 'POST' && u.endsWith('/plugin:dialog|save')) {
      const name = JSON.parse(req.postData() || '{}').options?.defaultPath || 'export';
      return req.respond({
        status: 200,
        contentType: 'application/json',
        headers: { 'Tauri-Response': 'ok', 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Tauri-Response' },
        body: JSON.stringify(path.join(outDir, name)),
      });
    }
    return req.continue();
  };
  page.on('request', onRequest);
  await openChapter(1);
  const exportBtn = (sel) => page.$$eval('.export-btn', (els, s) => els.find((b) => b.matches(s)).click(), sel);
  await exportBtn('[data-fmt="md"]');
  await sleep(800);
  await exportBtn('[data-fmt="html"]');
  await sleep(800);
  await exportBtn('[data-act="cheat"]');
  await sleep(1200);
  const files = (await import('node:fs')).readdirSync(outDir);
  const md = files.find((f) => f.endsWith('.md'));
  const html = files.find((f) => f.endsWith('.html') && !f.includes('cheat'));
  const cheat = files.find((f) => f.includes('cheat'));
  check('markdown export writes the note', Boolean(md) && readFileSync(path.join(outDir, md), 'utf8').includes('Cell Structure'), md);
  check('styled HTML export includes the diagram', Boolean(html) && /<svg/.test(readFileSync(path.join(outDir, html), 'utf8')), html);
  check('cheat sheet export writes the subject', Boolean(cheat) && existsSync(path.join(outDir, cheat)), cheat);
  page.off('request', onRequest);
  await page.setRequestInterception(false);
}

// ---- theme ----
if (phase === 'first-run') {
  await click('#themeBtn');
  await sleep(500);
  check('midnight theme applies', await page.evaluate(() => document.body.classList.contains('midnight')));
  await page.$$eval('.chapter-item', (els) => els[1].click());
  await sleep(600);
  await shot('09-midnight');
}

// ---- min window size ----
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
check('no horizontal overflow', !overflow);

const csp = await page.evaluate(() => window.__csp);
check('no CSP violations', csp.length === 0, csp.slice(0, 3).join(' | '));
const realErrors = errors.filter((e) => !/favicon/i.test(e));
check('no console errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

browser.disconnect();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
