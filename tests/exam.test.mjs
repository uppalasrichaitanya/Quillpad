// Test the mock-exam engine (pure logic, no DOM).
import {
  realQuestions,
  shuffle,
  assemblePaper,
  totalMarks,
  clampGrade,
  scoreAttempt,
  verdictOf,
  clockOf,
  QUESTION_MARKS,
} from '../src/exam.js';

const notes = [
  {
    meta: { subject: 'CN', num: '01', title: 'Intro & OSI' },
    qa: [{ q: 'legacy tcp q', a: 'legacy tcp a' }],
    topics: [
      {
        title: 'OSI',
        body: [],
        diagrams: [],
        qa: [
          { q: 'Compare OSI and TCP/IP.', a: '7 layers vs 4; …' },
          { q: 'Why layering?', a: 'modularity; …' },
        ],
      },
      { title: 'DLL', body: [], diagrams: [], qa: [{ q: 'Design a DLL?', a: 'framing, error, flow' }] },
    ],
  },
  {
    meta: { subject: 'DAA', num: '01', title: 'Greedy' },
    qa: [],
    topics: [{ title: 'Greedy', body: [], diagrams: [], qa: [{ q: 'State the greedy choice property.', a: 'optimal substructure + greedy choice' }] }],
  },
];

let fail = 0;
const check = (name, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`);
  if (!cond) fail++;
};

// realQuestions: topic.qa before legacy top-level qa, all subjects swept
const rq = realQuestions(notes);
check('collects 5 real questions', rq.length === 5);
check('topic qa first', rq[0].q === 'Compare OSI and TCP/IP.');
check('legacy qa comes last of its note', rq[3].q === 'legacy tcp q');
check('src carries subject', rq[4].src.startsWith('DAA'));
check('all marked real', rq.every((q) => q.kind === 'real'));

// shuffle: deterministic, same seed → same order, different seeds differ (usually)
const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], 42);
const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8], 42);
const c = shuffle([1, 2, 3, 4, 5, 6, 7, 8], 7);
check('shuffle deterministic by seed', JSON.stringify(a) === JSON.stringify(b));
check('shuffle permutes (same multiset)', [...a].sort().join(',') === '1,2,3,4,5,6,7,8');
check('different seed differs', JSON.stringify(a) !== JSON.stringify(c));
check('shuffle does not mutate input', (() => { const inp = [1, 2]; shuffle(inp, 1); return inp[0] === 1 && inp[1] === 2; })());

// assemblePaper: fills to count with generated, numbers 1..n, flat marks
const gen = [
  { q: 'g1', modelAnswer: 'ga1', src: 'CN' },
  { q: 'g2', modelAnswer: 'ga2', src: 'CN' },
];
const paper = assemblePaper({ real: rq, generated: gen, count: 6, seed: 3 });
check('paper has 6 questions', paper.length === 6);
check('numbered 1..6', paper.map((q) => q.number).join(',') === '1,2,3,4,5,6');
check('flat 5 marks each', paper.every((q) => q.marks === QUESTION_MARKS));
check('total marks 30', totalMarks(paper) === 30);
check('real questions come first, generated fill', paper.filter((q) => q.kind === 'real').length === 5);
check('one generated question fills to 6', paper.filter((q) => q.kind === 'generated').length === 1);
check('truncates when pool exceeds count', assemblePaper({ real: rq, generated: gen, count: 3, seed: 1 }).length === 3);
check('count 0 → empty', assemblePaper({ real: rq, generated: gen, count: 0, seed: 1 }).length === 0);
check('empty inputs safe', assemblePaper({ real: [], generated: [], count: 5, seed: 1 }).length === 0);

// clampGrade
check('clamp over', clampGrade({ earned: 9, marks: 5 }) === 5);
check('clamp under', clampGrade({ earned: -2, marks: 5 }) === 0);
check('clamp NaN → 0', clampGrade({ earned: NaN, marks: 5 }) === 0);
check('clamp default marks', clampGrade({ earned: 3 }) === 3);

// scoreAttempt: aligned by number, missing → 0, feedback preserved
const attempt = scoreAttempt(paper, [
  { number: 1, earned: 5, feedback: 'full frame — good' },
  { number: 2, earned: 3, feedback: 'missing step 3' },
  // 3: skipped → 0
  { number: 4, earned: 4.6, feedback: 'trap avoided' },
  { number: 5, earned: 5, feedback: '' },
  { number: 6, earned: 0, feedback: 'blank' },
]);
check('earned sums clamped (5+3+0+5+5+0)', attempt.earned === 18);
check('max is 30', attempt.max === 30);
check('pct 60', attempt.pct === 60);
check('4.6 rounds to 5', attempt.questions[3].earned === 5);
check('skipped question zeroed', attempt.questions[2].earned === 0);
check('feedback kept', attempt.questions[1].feedback === 'missing step 3');
check('gradedAt stamped', typeof attempt.gradedAt === 'number');
check('empty paper scores zero', scoreAttempt([], []).max === 0);

// verdict bands
check('80 → distinction', verdictOf(80).band === 'distinction');
check('79 → solid pass', verdictOf(79).band === 'solid pass');
check('40 → borderline', verdictOf(40).band === 'borderline');
check('10 → needs work', verdictOf(10).band === 'needs work');
check('0 → blank', verdictOf(0).band === 'blank');

// clock formatting
check('clock 0', clockOf(0) === '00:00');
check('clock 65', clockOf(65) === '01:05');
check('clock 600', clockOf(600) === '10:00');
check('clock clamps negatives', clockOf(-5) === '00:00');

console.log(fail ? `\n${fail} FAILED` : '\nall exam tests passed');
process.exit(fail ? 1 : 0);
