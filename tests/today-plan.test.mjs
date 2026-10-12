// The dashboard's "today" headline and main action, from the study state.
import { todayPlan } from '../src/readiness.js';

let fail = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) fail++;
};

const empty = todayPlan({ total: 0, seen: 0, due: 0, weak: 0, fresh: 0, stale: 0 });
check('empty notebook asks for a first chapter', empty.action === 'import' && /first chapter/i.test(empty.title), empty.title);

const fresh = todayPlan({ total: 20, seen: 0, due: 20, weak: 0, fresh: 20, stale: 0 });
check('new user gets a friendly start, not a weak pile', fresh.action === 'study' && /20 new cards/.test(fresh.title) && !/weak/i.test(fresh.title + fresh.cta), `${fresh.title} / ${fresh.cta}`);
check('new user sees a time estimate', /about 10 min/.test(fresh.sub), fresh.sub);
check('readiness is hidden until something is studied', fresh.showReadiness === false);

const weak = todayPlan({ total: 20, seen: 12, due: 9, weak: 4, fresh: 3, stale: 2 });
check('missed cards come first', weak.action === 'study' && /9 cards/.test(weak.title), weak.title);
check('the reason is spelled out', /4 you missed/.test(weak.sub) && /3 new/.test(weak.sub) && /2 due for a refresh/.test(weak.sub), weak.sub);
check('readiness shows once studying has begun', weak.showReadiness === true);

const one = todayPlan({ total: 20, seen: 19, due: 1, weak: 1, fresh: 0, stale: 0 });
check('singular reads naturally', /1 card\b/.test(one.title) && !/1 cards/.test(one.title), one.title);

const clear = todayPlan({ total: 20, seen: 20, due: 0, weak: 0, fresh: 0, stale: 0 });
check('caught up suggests an exam', clear.action === 'exam' && /up to date/i.test(clear.title), clear.title);

if (fail) process.exit(1);
console.log('all today-plan tests passed');
