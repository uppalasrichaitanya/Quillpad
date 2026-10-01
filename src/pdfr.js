// PDF page rendering via pdf.js (bundled worker) — for scanned chapter PDFs,
// pages are rendered to JPEG and sent to the vision distiller.
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Read a local PDF in the Tauri webview: fetch via the convertFileSrc asset
 * protocol, or plain fetch when running under vite dev (browser).
 * Returns the raw bytes.
 */
async function readPdfBytes(path) {
  let url = path;
  try {
    const { convertFileSrc } = await import('@tauri-apps/api/core');
    url = convertFileSrc(path);
  } catch {
    // browser/dev fallback: plain path fetch
  }
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`could not read PDF (${resp.status})`);
  return await resp.arrayBuffer();
}

/**
 * Detect whether the PDF has extractable text (renders only page 1).
 * Office files (docx/pptx) skip pdf.js entirely — Rust extracts their text.
 * @returns {{hadText: boolean, total: number}}
 */
export async function probePdf(path) {
  const ext = (path.split('.').pop() || '').toLowerCase();
  if (ext === 'docx' || ext === 'pptx') {
    return { hadText: true, total: 0 };
  }
  const buf = await readPdfBytes(path);
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  try {
    const p1 = await doc.getPage(1);
    let textContent = '';
    try {
      textContent = (await p1.getTextContent()).items.map((i) => i.str).join(' ');
    } catch {
      textContent = '';
    }
    const hadText = textContent.trim().length > 120;
    const total = doc.numPages;
    return { hadText, total };
  } finally {
    // always release the worker/pages, even when a page read throws
    await doc.destroy();
  }
}

/**
 * Render every page of the PDF to a base64 JPEG (for scanned PDFs only —
 * probe first so text PDFs don't pay for images they don't need).
 * @returns {string[]} base64 JPEGs, one per page
 */
export async function renderPdfPages(path, { dpi = 100, onProgress } = {}) {
  const buf = await readPdfBytes(path);
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages = [];
  try {
    const total = doc.numPages;
    const scale = dpi / 72;
    for (let n = 1; n <= total; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      // jpeg quality .7: ~100-150 KB/page — enough for clean handwriting OCR
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      pages.push(dataUrl.slice(dataUrl.indexOf(',') + 1));
      page.cleanup();
      if (onProgress) onProgress(n, total);
    }
    return pages;
  } finally {
    // a failed render must not strand the document in the worker
    await doc.destroy();
  }
}
