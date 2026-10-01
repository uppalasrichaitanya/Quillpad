// Quillpad mock-exam engine — pure, offline, testable (no DOM).
// Question assembly + scoring. The LLM only fills gaps: real questions from
// the notes (the supplied important questions + topic qa) always come first,
// LLM-generated ones top the paper up to the requested count.

// A written question on the exam paper.
// origin: "real" (from a note's qa) | "generated" (LLM-written from topics)
export const QUESTION_MARKS = 5;

// Collect real written questions from notes: topic.qa first (topic-flow notes
// carry the supplied important questions there), then legacy top-level qa.
export function realQuestions(notes) {
  const out = [];
  for (const note of notes || []) {
    const src = `${note.meta?.subject || ''} · ${note.meta?.num || ''} ${note.meta?.title || ''}`.trim();
    for (const topic of note.topics || []) {
      for (const qa of topic.qa || []) {
        if (qa?.q) out.push({ q: qa.q, modelAnswer: qa.a || '', src, kind: 'real' });
      }
    }
    for (const qa of note.qa || []) {
      if (qa?.q) out.push({ q: qa.q, modelAnswer: qa.a || '', src, kind: 'real' });
    }
  }
  return out;
}

// Deterministic shuffle (mulberry32) so a paper can be reproduced from a seed.
export function shuffle(list, seed) {
  const arr = [...list];
  let t = seed >>> 0;
  const rand = () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Assemble the paper: real questions shuffled in, then generated ones fill
// up to `count`. Marks are flat 5 per question (JNTUH-style).
export function assemblePaper({ real, generated, count, seed }) {
  const pool = [
    ...shuffle(real || [], seed ?? 1),
    ...(generated || []).map((g) => ({ ...g, kind: 'generated' })),
  ];
  return pool.slice(0, Math.max(0, count || 0)).map((p, i) => ({
    ...p,
    number: i + 1,
    marks: QUESTION_MARKS,
  }));
}

// Total marks on the paper.
export function totalMarks(paper) {
  return (paper || []).reduce((n, q) => n + (q.marks || 0), 0);
}

// One question's grade. Self-grades (offline fallback) arrive as
// { earned } directly; the grader clamps into [0, marks].
export function clampGrade({ earned, marks }) {
  const m = marks ?? QUESTION_MARKS;
  return Math.max(0, Math.min(m, Math.round(Number(earned) || 0)));
}

// Fold per-question results into the attempt record. `qresults` is
// [{ number, earned, feedback }] aligned by paper order (missing → 0).
export function scoreAttempt(paper, qresults) {
  const byNumber = new Map((qresults || []).map((r) => [r.number, r]));
  let earned = 0;
  const questions = (paper || []).map((q) => {
    const r = byNumber.get(q.number) || {};
    const e = clampGrade({ earned: r.earned, marks: q.marks });
    earned += e;
    return { number: q.number, q: q.q, src: q.src || '', kind: q.kind, marks: q.marks, earned: e, feedback: r.feedback || '' };
  });
  const max = totalMarks(paper);
  return {
    earned,
    max,
    pct: max ? Math.round((earned / max) * 100) : 0,
    questions,
    gradedAt: Date.now(),
  };
}

// An attempt's verdict band, for the result card headline.
export function verdictOf(pct) {
  if (pct >= 80) return { band: 'distinction', line: 'exam-ready — reproduce this on paper and you walk out smiling' };
  if (pct >= 60) return { band: 'solid pass', line: 'the frame is there — polish the gaps below before exam day' };
  if (pct >= 40) return { band: 'borderline', line: 'half the marks are hiding in the weak topics — drill those next' };
  if (pct > 0) return { band: 'needs work', line: 'rebuild from the hooks: skeleton first, then details' };
  return { band: 'blank', line: 'write something — even the skeleton earns partial marks' };
}

// Seconds → "mm:ss" for the countdown readout.
export function clockOf(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
