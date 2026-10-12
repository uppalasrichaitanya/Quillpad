// Quillpad flashcard engine — pure, offline, testable (no DOM in buildDeck/grade).
// Card types from the structured note data:
//   recall — front: topic title; back: the full topic frame
//   trap   — front: "the classic mistake in <topic>?"; back: the Trap line
//   qa     — from topic.qa pairs (and legacy note.qa)
// Grading: simple Leitner-ish requeue — missed cards requeue once before the
// deck ends; state keyed per-card for persistence across sessions.

export function topicHasFrameBody(topic) {
  return (topic.body || []).some((b) => typeof b === 'string' && b.length);
}

// extract the skeleton line (body[0], <em>-wrapped) if present
export function skeletonOf(topic) {
  const first = (topic.body || [])[0] || '';
  return String(first).replace(/<\/?em>/g, '').trim();
}

// extract the "Trap." line from the body blocks
export function trapOf(topic) {
  for (const b of topic.body || []) {
    const m = String(b).match(/Trap[.:]\s*([\s\S]+)/);
    if (m) return m[1].trim();
  }
  return '';
}

// Turn a key point into a prompt about its term. Points read
// "<strong>Term</strong> — explanation" (or "Term: explanation"); those
// without a bold term become a finish-the-thought prompt on their opening.
export function keyPointPrompt(kp) {
  const text = String(kp);
  const bold = text.match(/^\s*<strong>(.+?)<\/strong>\s*(?:[—–:-]\s*)?/);
  if (bold) {
    const term = bold[1].replace(/<[^>]*>/g, '').trim();
    return { label: term, front: `${term} — explain it in one line` };
  }
  const plain = text.replace(/<[^>]*>/g, '').trim();
  const words = plain.split(/\s+/);
  const opening = words.slice(0, Math.min(3, Math.max(1, words.length - 1))).join(' ');
  return { label: opening, front: `Finish the thought: “${opening} …”` };
}

// Build a deck from one note (topic-flow notes yield the richest decks;
// legacy flat notes still yield qa + key-point cards).
export function buildDeck(note) {
  const cards = [];
  const meta = note.meta || {};
  const src = `${meta.subject || ''}/${meta.num || ''} ${meta.title || ''}`.trim();

  for (const [ti, topic] of (note.topics || []).entries()) {
    if (!topic || !topic.title) continue;
    if (topicHasFrameBody(topic)) {
      cards.push({
        id: `${meta.subject}/${meta.num}/${ti}#recall`,
        type: 'recall',
        src,
        subject: meta.subject || '',
        front: topic.title,
        // back is rendered by the caller via topicHtml — store the topic ref
        topic,
      });
    }
    const trap = trapOf(topic);
    if (trap) {
      cards.push({
        id: `${meta.subject}/${meta.num}/${ti}#trap`,
        type: 'trap',
        src,
        subject: meta.subject || '',
        front: `What is the classic mistake in “${topic.title}”?`,
        back: trap,
      });
    }
    for (const [qi, qa] of (topic.qa || []).entries()) {
      if (!qa || !qa.q) continue;
      cards.push({
        id: `${meta.subject}/${meta.num}/${ti}/${qi}#qa`,
        type: 'qa',
        src,
        subject: meta.subject || '',
        front: qa.q,
        back: qa.a,
      });
    }
  }

  // legacy flat key points + top-level qa (topic-flow notes may still carry
  // top-level qa from older drafts — always include them)
  if (!(note.topics || []).length) {
    for (const [ki, kp] of (note.key_points || []).entries()) {
      cards.push({
        id: `${meta.subject}/${meta.num}/kp${ki}`,
        type: 'keypoint',
        src,
        subject: meta.subject || '',
        ...keyPointPrompt(kp),
        back: kp,
      });
    }
  }
  for (const [qi, qa] of (note.qa || []).entries()) {
    if (!qa || !qa.q) continue;
    cards.push({
      id: `${meta.subject}/${meta.num}/legacy${qi}`,
      type: 'qa',
      src,
      subject: meta.subject || '',
      front: qa.q,
      back: qa.a,
    });
  }

  return cards;
}

// Merge decks from several notes (subject-level study), skipping dups by id.
export function mergeDecks(decks) {
  const seen = new Set();
  const out = [];
  for (const d of decks) {
    for (const c of d || []) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        out.push(c);
      }
    }
  }
  return out;
}

// Session runner: consumption order with missed-requeue.
// state = { [cardId]: { seen, missed, lastSeen } } — updated in place.
export class Session {
  constructor(cards, state = {}) {
    this.queue = cards.filter((c) => !state[c.id]?.missed);
    this.requeue = cards.filter((c) => !!state[c.id]?.missed);
    this.total = cards.length;
    this.done = 0;
    this.missedThisSession = 0;
    this.state = state;
    this.current = null;
  }

  next() {
    if (!this.queue.length && !this.requeue.length) return null;
    // drain the main queue first, then the missed requeue
    this.current = this.queue.length ? this.queue.shift() : this.requeue.shift();
    return this.current;
  }

  grade(gotIt) {
    const c = this.current;
    if (!c) return;
    this.done += 1;
    const st = this.state[c.id] || { seen: 0, missed: 0, lastSeen: 0 };
    st.seen += 1;
    st.lastSeen = Date.now();
    if (gotIt) {
      st.missed = 0;
    } else {
      st.missed += 1;
      this.missedThisSession += 1;
      this.requeue.push(c);
    }
    this.state[c.id] = st;
    this.current = null;
  }

  // how far through everything (including requeued)
  get progress() {
    const remaining = this.queue.length + this.requeue.length + (this.current ? 1 : 0);
    return { done: this.done, remaining, total: this.total + this.missedThisSession };
  }
}
