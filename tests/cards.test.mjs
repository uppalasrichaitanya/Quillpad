// Test the flashcard deck builder + session grading (pure logic, no DOM).
import { buildDeck, mergeDecks, Session, skeletonOf, trapOf } from '../src/cards.js';

const note = {
  meta: { subject: 'ML', num: '92', title: 'Unit 3' },
  summary: 's',
  key_points: [],
  diagrams: [],
  qa: [{ q: 'legacy q', a: 'legacy a' }],
  recap: 'r',
  topics: [
    {
      title: 'Bagging',
      body: [
        '<em>Hook: Bootstrap Sample Aggregate Vote -> variance</em>',
        'Intuition: jellybeans.',
        'Definition: bootstrap aggregating.',
        'Trap. forgetting the weighted average loses the final mark.',
      ],
      diagrams: [],
      qa: [{ q: 'Why bagging?', a: 'variance reduction' }],
    },
    {
      title: 'No-body topic',
      body: [],
      diagrams: [],
      qa: [],
    },
  ],
};

let fail = 0;
const check = (name, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`);
  if (!cond) fail++;
};

const deck = buildDeck(note);
check('deck size: recall+trap+qa from topic + legacy qa = 4', deck.length === 4);
check('recall card exists with topic ref', deck.some((c) => c.type === 'recall' && c.topic?.title === 'Bagging'));
check('trap card front references topic', deck.some((c) => c.type === 'trap' && c.front.includes('Bagging')));
check('topic qa card', deck.some((c) => c.type === 'qa' && c.front === 'Why bagging?'));
check('empty-body topic yields no recall card', !deck.some((c) => c.topic?.title === 'No-body topic'));

check('skeletonOf strips em tags', skeletonOf(note.topics[0]).startsWith('Hook: Bootstrap'));
check('trapOf extracts after Trap.', trapOf(note.topics[0]).includes('weighted average'));

const merged = mergeDecks([deck, deck]);
check('mergeDecks dedupes by id', merged.length === deck.length);

// session: grade flow with requeue — miss the FIRST card only, get rest right
const s = new Session(deck, {});
const order = [];
let card;
while ((card = s.next())) {
  const isFirst = order.length === 0;
  s.grade(!isFirst); // first card: missed (false), everything else: got it
  order.push(card.front);
}
check('session drains queue then requeue (n + 1 misses)', order.length === deck.length + 1);
check('missed card requeued at end', order[order.length - 1] === order[0]);
// the requeued card was graded correct on its second pass: missed resets to 0,
// seen counts 2 — that's the intended Leitner reset
const missedState = Object.values(s.state).find((st) => st.seen === 2);
check('state records the double-seen card', !!missedState && missedState.missed === 0);

// persistence shape: second session with the state sees the missed-first order
const s2 = new Session(deck, s.state);
check('resumed session still has all cards', s2.queue.length + s2.requeue.length === deck.length);

process.exit(fail ? 1 : 0);
