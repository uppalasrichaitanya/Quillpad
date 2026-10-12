// Quillpad exam-readiness engine — pure, offline, testable (no DOM).
// Consumes the same card deck + grading state the flashcard system already
// produces (buildDeck + study-state.json), and derives study-planner views:
//   mastery  — per-subject % of cards the student has nailed
//   weak     — topics ranked by miss count (then never-seen)
//   due      — spaced repetition queue: new / weak / stale cards
// Card ids are "<subject>/<num>/<...>#<kind>" so subject comes free.

export function subjectOf(card) {
  return String(card.subject || (card.id ? card.id.split('/')[0] : '') || '');
}

export function topicTitleOf(card) {
  if (card.type === 'trap') {
    const m = String(card.front || '').match(/in\s+“(.+)”\?$/);
    if (m) return m[1];
  }
  if (card.label) return card.label;
  return card.type === 'recall' ? card.front : card.topic?.title || card.front || '';
}

function stateOf(state, id) {
  return state?.[id] || { seen: 0, missed: 0, lastSeen: 0 };
}

// A card counts as mastered when it has been seen at least once and is not
// currently carrying a miss (the Session grade() resets missed on success).
export function isMastered(st) {
  return (st.seen || 0) > 0 && (st.missed || 0) === 0;
}

// Per-subject mastery: { subject, mastered, total, pct }
export function masteryBySubject(cards, state) {
  const by = new Map();
  for (const c of cards || []) {
    const s = subjectOf(c);
    if (!s) continue;
    if (!by.has(s)) by.set(s, { subject: s, mastered: 0, total: 0 });
    const e = by.get(s);
    e.total += 1;
    if (isMastered(stateOf(state, c.id))) e.mastered += 1;
  }
  return [...by.values()]
    .map((e) => ({ ...e, pct: e.total ? Math.round((e.mastered / e.total) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct || a.subject.localeCompare(b.subject));
}

// Overall readiness: the single number the dashboard headline shows.
export function overallMastery(cards, state) {
  const list = cards || [];
  if (!list.length) return { pct: 0, mastered: 0, total: 0 };
  const mastered = list.filter((c) => isMastered(stateOf(state, c.id))).length;
  return { pct: Math.round((mastered / list.length) * 100), mastered, total: list.length };
}

// Weak topics ranked for revision: currently-missed first (by miss count),
// then seen-but-shaky (missed>0 historically? we only keep current), then
// never-seen. Deduped by subject+topic — trap and recall cards on the same
// topic collapse into one row with a hit count.
export function weakTopics(cards, state, limit = 6) {
  const rows = new Map(); // key: subject|title
  for (const c of cards || []) {
    const title = topicTitleOf(c);
    if (!title) continue;
    const subject = subjectOf(c);
    const key = `${subject}|${title}`;
    const st = stateOf(state, c.id);
    const miss = st.missed || 0;
    const seen = st.seen || 0;
    if (miss === 0 && seen > 0) continue; // solid — not weak
    const row = rows.get(key) || { subject, title, misses: 0, unseen: 0 };
    row.misses += miss;
    if (seen === 0) row.unseen += 1;
    rows.set(key, row);
  }
  return [...rows.values()]
    .sort((a, b) => b.misses - a.misses || b.unseen - a.unseen || a.title.localeCompare(b.title))
    .slice(0, limit);
}

// Spaced-repetition due pile for "today": missed cards first, then never-seen,
// then stale (seen but not reviewed in > staleDays days). Ordered so the
// student meets the weakest material earliest.
export function dueCards(cards, state, now = Date.now(), staleDays = 3) {
  const staleMs = staleDays * 24 * 60 * 60 * 1000;
  const scored = [];
  for (const c of cards || []) {
    const st = stateOf(state, c.id);
    if ((st.missed || 0) > 0) scored.push({ card: c, rank: 0, why: 'weak' });
    else if ((st.seen || 0) === 0) scored.push({ card: c, rank: 1, why: 'new' });
    else if (now - (st.lastSeen || 0) > staleMs) scored.push({ card: c, rank: 2, why: 'stale' });
  }
  scored.sort((a, b) => a.rank - b.rank || subjectOf(a.card).localeCompare(subjectOf(b.card)));
  return scored.map((s) => s.card);
}

// The "study the weak pile" deck: everything due, capped so a session stays
// a session (~40 cards ≈ a focused half hour).
export function buildDueDeck(cards, state, now, cap = 40) {
  return dueCards(cards, state, now).slice(0, cap);
}

// Practice-writing grades persist under "<base-id>#write" keys (base =
// recall-card id with its "#recall" suffix removed). These are not real
// cards, so materialize them as pseudo-cards for the dashboard: one per
// written topic, carrying the base card's metadata when present.
export function withWriteCards(cards, state) {
  const out = [...(cards || [])];
  for (const [id, st] of Object.entries(state || {})) {
    if (!id.endsWith('#write')) continue;
    const base = id.slice(0, -'#write'.length);
    // base is "<subject>/<num>/<ti>" — the recall card is that + "#recall"
    const baseCard = out.find((c) => c.id === `${base}#recall`);
    out.push({
      id,
      type: 'write',
      subject: baseCard?.subject || base.split('/')[0] || '',
      front: baseCard?.front || '',
      st,
    });
  }
  return out;
}

// Count-only summary for the dashboard sub-headline ("12 weak · 8 new · 4 stale").
export function dueSummary(cards, state, now = Date.now()) {
  const out = { weak: 0, new: 0, stale: 0 };
  const staleMs = 3 * 24 * 60 * 60 * 1000;
  for (const c of cards || []) {
    const st = stateOf(state, c.id);
    if ((st.missed || 0) > 0) out.weak += 1;
    else if ((st.seen || 0) === 0) out.new += 1;
    else if (now - (st.lastSeen || 0) > staleMs) out.stale += 1;
  }
  return out;
}

// What the dashboard leads with today. Input counts come from the deck and
// study state: total cards, cards ever seen, the due deck size, and its
// make-up (weak = missed before, fresh = never seen, stale = not seen lately).
// Returns the headline, the reason, the main button and whether a readiness
// percentage means anything yet (it doesn't before any studying).
export function todayPlan({ total, seen, due, weak, fresh, stale }) {
  const cards = (n) => `${n} card${n === 1 ? '' : 's'}`;
  const minutes = (n) => `about ${Math.max(1, Math.ceil(n / 2))} min`;
  if (!total) {
    return {
      action: 'import',
      title: 'Import your first chapter',
      sub: 'Drop in a chapter PDF and Quillpad turns it into a note, flashcards and exam questions.',
      cta: 'import a chapter',
      showReadiness: false,
    };
  }
  if (!seen) {
    return {
      action: 'study',
      title: `Start with ${fresh} new cards`,
      sub: `${minutes(due)} — you’ll see what you already know, and Quillpad will remember the rest.`,
      cta: 'start studying',
      showReadiness: false,
    };
  }
  if (due) {
    const parts = [];
    if (weak) parts.push(`${weak} you missed`);
    if (fresh) parts.push(`${fresh} new`);
    if (stale) parts.push(`${stale} due for a refresh`);
    return {
      action: 'study',
      title: `Revise ${cards(due)} today`,
      sub: `${parts.join(', ')} — ${minutes(due)}.`,
      cta: 'revise now',
      showReadiness: true,
    };
  }
  return {
    action: 'exam',
    title: 'You’re up to date',
    sub: 'Nothing is due. Test yourself with a timed mock exam.',
    cta: 'take a mock exam',
    showReadiness: true,
  };
}
