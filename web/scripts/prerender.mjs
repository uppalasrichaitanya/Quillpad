// Inline the server-rendered page into dist/index.html so the first paint
// doesn't wait for JavaScript. Runs after `vite build` and the SSR build.
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const dist = new URL("../dist/", import.meta.url);
const ssr = new URL("../dist-ssr/entry-server.js", import.meta.url);
const { render } = await import(pathToFileURL(ssr.pathname.replace(/^\/(\w:)/, "$1")).href);

const file = new URL("index.html", dist);
let html = readFileSync(file, "utf8");

// Inline the stylesheet: one less render-blocking request before first paint.
html = html.replace(/<link rel="stylesheet"[^>]*href="\/(assets\/[^"]+\.css)"[^>]*>/, (_, href) => {
  const css = readFileSync(new URL(href, dist), "utf8");
  return `<style>${css}</style>`;
});
if (!html.includes('<div id="root"></div>')) throw new Error("prerender: #root placeholder not found");
writeFileSync(file, html.replace('<div id="root"></div>', `<div id="root">${render()}</div>`));
rmSync(new URL("../dist-ssr/", import.meta.url), { recursive: true, force: true });
console.log("prerender: dist/index.html now ships the rendered page");
