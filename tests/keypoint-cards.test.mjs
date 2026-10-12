// Key-point notes (the seed chapters, and older drafts) must yield real
// flashcards — a prompt about the term, not "<chapter> — point 3" — and the
// weak-topics list must name the term.
import { buildDeck } from '../src/cards.js';
import { topicTitleOf } from '../src/readiness.js';

const note = {
  meta: { subject: 'Biology', num: '04', title: 'Cell Structure & Function' },
  summary: 's',
  key_points: [
    '<strong>Nucleus</strong> — houses DNA, controls gene expression.',
    '<strong>Mitochondria</strong>: site of aerobic respiration.',
    'Surface-area-to-volume ratio limits how large a single cell can grow.',
  ],
  topics: [],
  qa: [],
  diagrams: [],
  recap: 'r',
};

let fail = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) fail++;
};

const deck = buildDeck(note).filter((c) => c.type === 'keypoint');
const [nucleus, mito, plain] = deck;

check('no card says "point N"', deck.every((c) => !/point \d/.test(c.front)), deck.map((c) => c.front).join(' | '));
check('front asks about the term', /Nucleus/.test(nucleus.front) && !/houses DNA/.test(nucleus.front), nucleus.front);
check('back holds the explanation', /houses DNA/.test(nucleus.back));
check('colon-style leads work too', /Mitochondria/.test(mito.front) && !/aerobic/.test(mito.front), mito.front);
check('points without a bold term still get a real prompt', /Surface-area-to-volume/.test(plain.front) && !/single cell can grow/.test(plain.front), plain.front);
check('ids are unchanged (study progress carries over)', nucleus.id === 'Biology/04/kp0' && plain.id === 'Biology/04/kp2');
check('weak topics name the term', topicTitleOf(nucleus) === 'Nucleus', topicTitleOf(nucleus));

if (fail) process.exit(1);
console.log('all key-point card tests passed');
