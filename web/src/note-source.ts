/** Raw vs rendered: the real note as the app stores it on disk.
 *  Byte-for-byte what the app writes for the seeded Biology 04 chapter:
 *  title "Cell Structure & Function" slugs to `cell-structure-function`
 *  (the slug drops `&` rather than expanding it to "and"), and the diagram
 *  block matches the labelled-blob schema `note.rs` deserialises. */

export const BIO04_FILE = "04-cell-structure-function.md";

export const BIO04_RAW = `---
subject: Biology
num: 04
title: Cell Structure & Function
created: 2026-08-31
---

## Summary

Every organelle in the cell has one job and does it well. Think of the cell as a
tiny factory: the nucleus is the office, mitochondria the power plant, ribosomes
the assembly line.

## Key Points

- Nucleus: houses DNA, controls gene expression, double membrane.
- Mitochondria: aerobic respiration, produces ATP; own DNA (endosymbiotic origin).
- Ribosomes: build proteins from mRNA; free-floating or on rough ER.
- Golgi apparatus: modifies, sorts and packages proteins.
- Cell membrane: phospholipid bilayer, selectively permeable.

\`\`\`quill-diagram
{"type":"labelled-blob","data":{"caption":"fig. 4.1 — generalised animal cell, organelles labelled","outline":"generalised animal cell","parts":[{"label":"nucleus","kind":"oval","accent":true,"size":"large"},{"label":"mitochondria","kind":"oval","size":"small"},{"label":"ribosomes","kind":"dot","count":3},{"label":"rough ER","kind":"squiggle"},{"label":"membrane","kind":"edge"}]}}
\`\`\`

## Quick Recap

Nucleus = control, mitochondria = power, ribosomes = build.
`;
