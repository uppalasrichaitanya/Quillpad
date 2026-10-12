// Guard against calling another module's export without importing it — the
// bundler doesn't catch that, and it only fails at runtime (0.1 shipped with
// setDiagramTheme un-imported, which broke theme switching and exports).
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../src/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
const src = Object.fromEntries(files.map((f) => [f, readFileSync(new URL(f, dir), 'utf8')]));

const exportsOf = {};
for (const [f, s] of Object.entries(src)) {
  exportsOf[f] = [...s.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)/g)].map((m) => m[1]);
}

let fail = 0;
for (const [f, s] of Object.entries(src)) {
  const imported = new Set(
    [...s.matchAll(/import\s*\{([^}]+)\}\s*from/g)].flatMap((m) =>
      m[1].split(',').map((x) => x.trim().split(/\s+as\s+/).pop()),
    ),
  );
  const local = new Set([...s.matchAll(/(?:function|const|let|var|class)\s+(\w+)/g)].map((m) => m[1]));
  for (const [other, names] of Object.entries(exportsOf)) {
    if (other === f) continue;
    for (const name of names) {
      const called = new RegExp(`(?<![.\\w])${name}\\s*\\(`).test(s);
      if (called && !imported.has(name) && !local.has(name)) {
        console.log(`FAIL ${f} calls ${name}() from ${other} without importing it`);
        fail++;
      }
    }
  }
}
if (fail) process.exit(1);
console.log('all cross-module calls are imported');
