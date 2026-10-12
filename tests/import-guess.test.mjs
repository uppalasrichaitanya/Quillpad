// Prefill the import wizard from a chapter file's name.
import { guessChapterMeta } from '../src/import-guess.js';

let fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) fail++;
};
const subjects = ['Biology', 'Chemistry', 'Computer Networks'];

eq('leading number', guessChapterMeta('C:\\notes\\04-cell-structure-function.pdf', subjects),
  { subject: '', num: '04', title: 'Cell Structure Function' });
eq('"Chapter 4 - Title"', guessChapterMeta('Chapter 4 - The Cell.pdf', subjects),
  { subject: '', num: '04', title: 'The Cell' });
eq('subject + ch number', guessChapterMeta('/home/me/Biology_Ch07_Genetics_Basics.docx', subjects),
  { subject: 'Biology', num: '07', title: 'Genetics Basics' });
eq('multi-word subject, any case', guessChapterMeta('computer networks unit 3 transport layer.pptx', subjects),
  { subject: 'Computer Networks', num: '03', title: 'Transport Layer' });
eq('keeps existing capitals and acronyms', guessChapterMeta('ch12 DNA Replication and PCR.pdf', subjects),
  { subject: '', num: '12', title: 'DNA Replication and PCR' });
eq('no number at all', guessChapterMeta('periodic-trends.pdf', subjects),
  { subject: '', num: '', title: 'Periodic Trends' });
eq('does not read a year as a chapter', guessChapterMeta('2024 exam revision notes.pdf', subjects),
  { subject: '', num: '', title: '2024 Exam Revision Notes' });

if (fail) process.exit(1);
console.log('all import-guess tests passed');
