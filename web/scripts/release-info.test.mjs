// With no local exe, release-info must refuse to keep download facts that
// belong to a different version than the app's package.json.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const appVersion = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;
const stamped = readFileSync(new URL('../src/release.ts', import.meta.url), 'utf8').match(/"version": "([^"]+)"/)[1];
const r = spawnSync(process.execPath, [new URL('./release-info.mjs', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')], {
  env: { ...process.env, RELEASE_EXE: 'Z:/definitely/missing/quillpad.exe' },
  encoding: 'utf8',
});
const expectFail = stamped !== appVersion;
const ok = expectFail ? r.status !== 0 : r.status === 0;
console.log(`${ok ? 'PASS' : 'FAIL'}  stamped ${stamped} vs app ${appVersion}: exit ${r.status} (expected ${expectFail ? 'non-zero' : '0'})`);
process.exit(ok ? 0 : 1);
