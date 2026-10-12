// Test the readiness engine (pure logic, no DOM).
import {
  masteryBySubject,
  overallMastery,
  weakTopics,
  dueCards,
  buildDueDeck,
  dueSummary,
  subjectOf,
  topicTitleOf,
  withWriteCards,
} from '../src/readiness.js';

// deck shape mirrors buildDeck output (cards.js) — ids start with subject
const cards = [
  { id: 'DAA/01/0#recall', type: 'recall', subject: 'DAA', front: 'Greedy Method' },
  { id: 'DAA/01/0#trap', type: 'trap', subject: 'DAA', front: 'What is the classic mistake in “Greedy Method”?' },
  { id: 'DAA/02/1#recall', type: 'recall', subject: 'DAA', front: 'Backtracking' },
  { id: 'CN/01/0#recall', type: 'recall', subject: 'CN', front: 'OSI Model' },
  { id: 'CN/01/1#qa', type: 'qa', subject: 'CN', front: 'Why layering?' },
  { id: 'ML/92/0#recall', type: 'recall', subject: 'ML', front: 'Bagging' },
];

let fail = 0;
const check = (name, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`);
  if (!cond) fail++;
};

// topicTitleOf: recall → front, trap → parsed from the quoted front
check('topicTitleOf recall', topicTitleOf(cards[0]) === 'Greedy Method');
check('topicTitleOf trap parses quoted topic', topicTitleOf(cards[1]) === 'Greedy Method');

const state = {
  'DAA/01/0#recall': { seen: 2, missed: 0, lastSeen: Date.now() },
  'DAA/01/0#trap': { seen: 1, missed: 1, lastSeen: Date.now() },
  'DAA/02/1#recall': { seen: 0, missed: 0, lastSeen: 0 },
  'CN/01/0#recall': { seen: 3, missed: 0, lastSeen: Date.now() - 10 * 24 * 60 * 60 * 1000 }, // stale
  'CN/01/1#qa': { seen: 1, missed: 2, lastSeen: Date.now() },
};

// mastery: DAA 1/3, CN 1/2, ML 0/1 → sorted CN(50) > DAA(33) > ML(0)
const m = masteryBySubject(cards, state);
check('mastery three subjects', m.length === 3);
check('mastery CN 50%', m.find((x) => x.subject === 'CN').pct === 50);
check('mastery DAA 33%', m.find((x) => x.subject === 'DAA').pct === 33);
check('mastery sorted desc', m[0].subject === 'CN' && m[2].subject === 'ML');

// overall: 2 mastered of 6 = 33%
const o = overallMastery(cards, state);
check('overall pct 33', o.pct === 33 && o.mastered === 2 && o.total === 6);
check('overall empty deck', overallMastery([], {}) .pct === 0);

// weak: trap(Greedy, miss 1) + qa(Why layering?, miss 2) + unseen Backtracking + unseen Bagging
const weak = weakTopics(cards, state);
check('weak excludes mastered', !weak.some((w) => w.title === 'OSI Model'));
check('weak ranks by misses first', weak[0].title === 'Why layering?' && weak[0].misses === 2);
check('weak dedupes trap+recall same topic', !weak.some((w) => w.title === 'Greedy Method' && w.unseen > 0));
check('weak Greedy keeps the miss', weak.find((w) => w.title === 'Greedy Method').misses === 1);
check('weak includes unseen topics', weak.some((w) => w.title === 'Backtracking' && w.unseen === 1));
check('weak respects limit', weakTopics(cards, state, 2).length === 2);

// due: weak first (qa + trap), then new (Backtracking, Bagging), then stale (OSI)
const due = dueCards(cards, state);
check('due count = weak2+new2+stale1', due.length === 5);
check('due weak first', due[0].id === 'CN/01/1#qa' && due[1].id === 'DAA/01/0#trap');
check('due stale last', due[4].id === 'CN/01/0#recall');
check('due omits fresh mastered', !due.some((c) => c.id === 'DAA/01/0#recall'));

check('dueDeck caps at 40', buildDueDeck(Array.from({ length: 60 }, (_, i) => cards[i % cards.length]), {}).length === 40);

const sum = dueSummary(cards, state);
check('summary counts weak2 new2 stale1', sum.weak === 2 && sum.new === 2 && sum.stale === 1);

// withWriteCards: materializes #write state keys as pseudo-cards
const writeState = { ...state, 'DAA/01/0#write': { seen: 1, missed: 0, lastSeen: Date.now() } };
const withCards = withWriteCards(cards, writeState);
check('write cards appended', withCards.length === cards.length + 1);
const writeCard = withCards.find((c) => c.id === 'DAA/01/0#write');
check('write card reuses base subject + topic', writeCard?.subject === 'DAA' && writeCard?.front === 'Greedy Method');
check('write card counts toward mastery', overallMastery(withCards, writeState).total === cards.length + 1);
check('original deck untouched', cards.length === 6);

console.log(fail ? `\n${fail} FAILED` : '\nall readiness tests passed');
process.exit(fail ? 1 : 0);
