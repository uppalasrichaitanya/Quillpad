// Real content from the app's first-run seed notes (notebook-seed/seed.json).
// Regenerate rather than hand-edit if the seed changes.

export type SeedNote = {
  subject: string;
  num: string;
  title: string;
  file: string;
  summary: string;
  points: { lead: string; rest: string }[];
  recap: string;
};

export const SEED_NOTES: SeedNote[] = [
  {
    "subject": "Biology",
    "num": "01",
    "title": "Intro to Cell Biology",
    "file": "01-intro-to-cell-biology.md",
    "summary": "The cell is the basic structural and functional unit of all living organisms. This chapter sets up the vocabulary — prokaryote vs eukaryote, the cell theory, and why size matters — used for every chapter after it.",
    "points": [
      {
        "lead": "Cell theory",
        "rest": "all organisms are made of cells; the cell is the basic unit of life; cells arise only from pre-existing cells."
      },
      {
        "lead": "Prokaryotic",
        "rest": "cells (bacteria, archaea) have no nucleus — DNA sits free in the cytoplasm."
      },
      {
        "lead": "Eukaryotic",
        "rest": "cells (plants, animals, fungi) have a true nucleus and membrane-bound organelles."
      },
      {
        "lead": "",
        "rest": "Surface-area-to-volume ratio limits how large a single cell can grow before diffusion becomes too slow."
      }
    ],
    "recap": "Two cell types, one theory, one size limit — everything else in this unit builds on this page."
  },
  {
    "subject": "Biology",
    "num": "04",
    "title": "Cell Structure & Function",
    "file": "04-cell-structure-function.md",
    "summary": "Every organelle in the cell has one job and does it well. Think of the cell as a tiny factory — the nucleus is the office, mitochondria the power plant, ribosomes the assembly line.",
    "points": [
      {
        "lead": "Nucleus",
        "rest": "houses DNA, controls gene expression, wrapped in a double membrane (nuclear envelope)."
      },
      {
        "lead": "Mitochondria",
        "rest": "site of aerobic respiration, produces ATP; has its own DNA (endosymbiotic origin)."
      },
      {
        "lead": "Ribosomes",
        "rest": "build proteins from mRNA; free-floating or attached to rough ER."
      },
      {
        "lead": "Golgi apparatus",
        "rest": "modifies, sorts and packages proteins for secretion."
      },
      {
        "lead": "Cell membrane",
        "rest": "phospholipid bilayer, selectively permeable, controls what enters/exits."
      }
    ],
    "recap": "Nucleus = control, mitochondria = power, ribosomes = build, Golgi = ship, membrane = gatekeeper."
  },
  {
    "subject": "Biology",
    "num": "07",
    "title": "Genetics Basics",
    "file": "07-genetics-basics.md",
    "summary": "Genetics explains how traits pass from parent to offspring. Mendel's pea plants gave us the first rules — dominant and recessive alleles — long before anyone had seen a chromosome.",
    "points": [
      {
        "lead": "Allele",
        "rest": "a version of a gene; organisms carry two per gene (one from each parent)."
      },
      {
        "lead": "Dominant vs recessive",
        "rest": "a dominant allele masks a recessive one in a heterozygote."
      },
      {
        "lead": "Genotype",
        "rest": "is the allele pairing (e.g. Aa); phenotype is the observable trait."
      },
      {
        "lead": "Punnett squares",
        "rest": "predict offspring ratios from a cross of two known genotypes."
      }
    ],
    "recap": "Genotype is the code, phenotype is what you see — Punnett squares just do the arithmetic between them."
  },
  {
    "subject": "Chemistry",
    "num": "02",
    "title": "Periodic Trends",
    "file": "02-periodic-trends.md",
    "summary": "Move across or down the periodic table and properties shift in predictable directions — because you're really just changing how tightly the nucleus holds its electrons.",
    "points": [
      {
        "lead": "Atomic radius",
        "rest": "decreases across a period (more nuclear pull), increases down a group (new shells)."
      },
      {
        "lead": "Ionisation energy",
        "rest": "increases across a period, decreases down a group."
      },
      {
        "lead": "Electronegativity",
        "rest": "highest top-right of the table (excluding noble gases), lowest bottom-left."
      },
      {
        "lead": "Metallic character",
        "rest": "increases down and to the left; nonmetals cluster top-right."
      }
    ],
    "recap": "Across a period: smaller, harder to ionise, more electronegative. Down a group: the opposite."
  },
  {
    "subject": "Physics",
    "num": "03",
    "title": "Newton's Laws",
    "file": "03-newtons-laws.md",
    "summary": "Three short statements that describe almost every everyday motion you'll ever see — from a dropped pencil to a rocket launch.",
    "points": [
      {
        "lead": "1st law (inertia)",
        "rest": "an object at rest stays at rest, in motion stays in motion, unless acted on by a net force."
      },
      {
        "lead": "2nd law",
        "rest": "F = ma. Acceleration is directly proportional to net force, inversely proportional to mass."
      },
      {
        "lead": "3rd law",
        "rest": "for every action there is an equal and opposite reaction."
      }
    ],
    "recap": "No force, no change (1st). Force causes acceleration (2nd). Forces come in pairs (3rd)."
  }
];
