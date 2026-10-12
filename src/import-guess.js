// Prefill the import wizard from a chapter file's name: an existing subject
// mentioned in it, a chapter number ("04-…", "ch4", "Chapter 4 - …", "unit 3")
// and a tidy title. Pure, so it is unit-tested.

const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs']);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function titleCase(words) {
  return words
    .map((w, i) => {
      if (/[A-Z]/.test(w)) return w; // keep "DNA", "McGraw", "pH" as written
      if (i > 0 && SMALL.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

export function guessChapterMeta(path, subjects = []) {
  let rest = String(path)
    .split(/[\\/]/)
    .pop()
    .replace(/\.(pdf|docx|pptx)$/i, '');

  let subject = '';
  for (const s of [...subjects].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`(^|[\\s._-])${s.split(/\s+/).map(escapeRe).join('[\\s._-]+')}(?=$|[\\s._-])`, 'i');
    if (re.test(rest)) {
      subject = s;
      rest = rest.replace(re, ' ');
      break;
    }
  }

  let num = '';
  const labelled = rest.match(/(^|[\s._-])(?:chapter|chap|ch|unit|lesson|module)[\s._-]*(\d{1,3})(?=$|[\s._-])/i);
  if (labelled) {
    num = labelled[2];
    rest = rest.replace(labelled[0], ' ');
  } else {
    const leading = rest.match(/^\s*(\d{1,3})(?=[\s._-])/);
    if (leading) {
      num = leading[1];
      rest = rest.slice(leading[0].length);
    }
  }
  if (num) num = num.padStart(2, '0');

  const words = rest
    .replace(/[_.]+/g, ' ')
    .replace(/(^|\s)-+|-+(\s|$)/g, ' ') // separator dashes, not hyphenated words
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return { subject, num, title: titleCase(words) };
}
