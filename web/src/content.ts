/**
 * Real content from the app's seed corpus (notebook-seed/seed.json) and the
 * actual built artifact. The landing page shows the real thing, re-set in
 * the page's own voice: the app's cream paper, brown ink and rust.
 */

import { BIO04_FILE } from "./note-source";

export type SeedNote = {
  meta: {
    subject: string;
    num: string;
    title: string;
    created: string;
  };
  summary: string;
  keyPoints: { lead: string; rest: string }[];
  recap: string;
};

export const SEED_NOTES: SeedNote[] = [
  {
    meta: { subject: "Biology", num: "01", title: "Intro to Cell Biology", created: "2026-08-31" },
    summary:
      "The cell is the basic structural and functional unit of all living organisms. This chapter sets up the vocabulary, prokaryote vs eukaryote, the cell theory, and why size matters, used for every chapter after it.",
    keyPoints: [
      { lead: "Cell theory", rest: "all organisms are made of cells; the cell is the basic unit of life; cells arise only from pre-existing cells." },
      { lead: "Prokaryotic cells", rest: "(bacteria, archaea) have no nucleus; DNA sits free in the cytoplasm." },
      { lead: "Eukaryotic cells", rest: "(plants, animals, fungi) have a true nucleus and membrane-bound organelles." },
      { lead: "Surface-area-to-volume ratio", rest: "limits how large a single cell can grow before diffusion becomes too slow." },
    ],
    recap: "Two cell types, one theory, one size limit.",
  },
  {
    meta: { subject: "Biology", num: "04", title: "Cell Structure & Function", created: "2026-08-31" },
    summary:
      "Every organelle in the cell has one job and does it well. Think of the cell as a tiny factory: the nucleus is the office, mitochondria the power plant, ribosomes the assembly line.",
    keyPoints: [
      { lead: "Nucleus", rest: "houses DNA, controls gene expression, wrapped in a double membrane." },
      { lead: "Mitochondria", rest: "site of aerobic respiration, produces ATP; has its own DNA (endosymbiotic origin)." },
      { lead: "Ribosomes", rest: "build proteins from mRNA; free-floating or attached to rough ER." },
      { lead: "Golgi apparatus", rest: "modifies, sorts and packages proteins for secretion." },
      { lead: "Cell membrane", rest: "phospholipid bilayer, selectively permeable, controls what enters and exits." },
    ],
    recap: "Nucleus = control, mitochondria = power, ribosomes = build.",
  },
  {
    meta: { subject: "Biology", num: "07", title: "Genetics Basics", created: "2026-08-31" },
    summary:
      "Genetics explains how traits pass from parent to offspring. Mendel's pea plants gave us the first rules, dominant and recessive alleles, long before anyone had seen a chromosome.",
    keyPoints: [
      { lead: "Allele", rest: "a version of a gene; organisms carry two per gene, one from each parent." },
      { lead: "Dominant vs recessive", rest: "a dominant allele masks a recessive one in a heterozygote." },
      { lead: "Genotype vs phenotype", rest: "the allele pairing (Aa) versus the observable trait." },
      { lead: "Punnett squares", rest: "predict offspring ratios from a cross of two known genotypes." },
    ],
    recap: "Genotype is the code, phenotype is what you see.",
  },
  {
    meta: { subject: "Chemistry", num: "02", title: "Periodic Trends", created: "2026-08-31" },
    summary:
      "Atomic radius, ionisation energy, electronegativity: three trends, one cause. Effective nuclear charge pulls electrons in, and shells shield it, so position on the table predicts behaviour.",
    keyPoints: [
      { lead: "Atomic radius", rest: "decreases across a period as nuclear charge grows; increases down a group." },
      { lead: "Ionisation energy", rest: "increases across a period; drops at each new shell." },
      { lead: "Electronegativity", rest: "rises across a period toward fluorine; falls down a group." },
      { lead: "The cause", rest: "effective nuclear charge vs shielding, nothing else." },
    ],
    recap: "One cause, three trends, every period.",
  },
  {
    meta: { subject: "Physics", num: "03", title: "Newton's Laws", created: "2026-08-31" },
    summary:
      "Three laws, one idea: forces change motion, they do not cause it. This chapter separates velocity from acceleration and gives you the free-body diagram as the working tool.",
    keyPoints: [
      { lead: "First law", rest: "an object keeps its velocity unless a net external force acts." },
      { lead: "Second law", rest: "net force equals mass times acceleration, a vector equation." },
      { lead: "Third law", rest: "forces come in pairs, equal magnitude, opposite direction, on different bodies." },
      { lead: "Free-body diagrams", rest: "isolate one body, draw only the forces on it, then solve." },
    ],
    recap: "Forces change motion; diagrams make that visible.",
  },
];

export const BIO_04 = SEED_NOTES[1];

/** The real on-disk folder the app writes. Filenames are the app's own
 *  `slug(title)` output — "Cell Structure & Function" becomes
 *  `04-cell-structure-function.md`. */
export const DISK_TREE = [
  "Quillpad/",
  "  Biology/",
  "    01-intro-to-cell-biology.md",
  BIO04_FILE,
  "    07-genetics-basics.md",
  "  Chemistry/",
  "    02-periodic-trends.md",
  "  Physics/",
  "    03-newtons-laws.md",
];

/** The app's sidebar, as the first-run seed files it. */
export const SIDEBAR_GROUPS = [
  {
    subject: "Biology",
    files: [
      "01-intro-to-cell-biology.md",
      BIO04_FILE,
      "07-genetics-basics.md",
    ],
    active: BIO04_FILE,
  },
  {
    subject: "Chemistry",
    files: ["02-periodic-trends.md"],
    active: null,
  },
  {
    subject: "Physics",
    files: ["03-newtons-laws.md"],
    active: null,
  },
];

/** Suggested quiz cards drawn from real seed content. */
export const FLASHCARDS = [
  { front: "Why do mitochondria have their own DNA?", back: "Endosymbiotic origin: they were once free-living bacteria that the cell kept.", source: "Biology 04" },
  { front: "What does effective nuclear charge explain?", back: "All three periodic trends: radius, ionisation energy, electronegativity.", source: "Chemistry 02" },
  { front: "What does Newton's first law actually say?", back: "Objects keep their velocity; forces change motion, they do not maintain it.", source: "Physics 03" },
];

/** A real quiz question answerable on the page. */
export const QUIZ = {
  question: "A cell has plenty of mRNA but builds almost no proteins. Which organelle is the likeliest fault?",
  options: [
    "Nucleus",
    "Ribosome",
    "Golgi apparatus",
    "Cell membrane",
  ],
  answer: 1,
  why: "Ribosomes build proteins from mRNA. With mRNA abundant but output near zero, the assembly line is the broken stage.",
  source: "Biology 04 · Cell Structure & Function",
};

/** Search corpus: real questions the offline matcher can answer. */
export const SEARCH_DEMO = [
  { q: "why do mitochondria have their own dna", hit: "Biology 04 · Cell Structure & Function", snippet: "Mitochondria: site of aerobic respiration, produces ATP; has its own DNA (endosymbiotic origin)." },
  { q: "what increases across a period", hit: "Chemistry 02 · Periodic Trends", snippet: "Ionisation energy increases across a period; drops at each new shell." },
  { q: "what limits how large a cell can grow", hit: "Biology 01 · Intro to Cell Biology", snippet: "Surface-area-to-volume ratio limits how large a single cell can grow before diffusion becomes too slow." },
  { q: "forces come in pairs", hit: "Physics 03 · Newton's Laws", snippet: "Third law: forces come in pairs, equal magnitude, opposite direction, on different bodies." },
  { q: "what did mendel work with", hit: "Biology 07 · Genetics Basics", snippet: "Mendel's pea plants gave us the first rules, dominant and recessive alleles." },
  { q: "what packages proteins", hit: "Biology 04 · Cell Structure & Function", snippet: "Golgi apparatus: modifies, sorts and packages proteins for secretion." },
];

/** The app's real pipeline, in order, as the engine section tells it. */
export const ENGINE_CHAIN = [
  { stage: "01", label: "Extract", detail: "Text PDFs parsed directly. Scanned pages detected and rendered for vision transcription." },
  { stage: "02", label: "Distill", detail: "The chapter goes to an Anthropic-compatible endpoint and comes back as strict JSON: summary, key points, answers." },
  { stage: "03", label: "Render", detail: "Diagrams return as typed specs and are drawn as clean line art, never pasted screenshots." },
  { stage: "04", label: "File", detail: "Saved as plain .md under Subject/NN-title, and opened. Your disk is the database." },
];
