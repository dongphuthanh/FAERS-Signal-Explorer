# gap-tirzepatide

**Q:** What is being reported for tirzepatide that its label does not describe?

**Tool calls:**
- query_adverse_events {"drug":"tirzepatide","mode":"gap"}

**Checks:** missing: /other suspect drugs|comparator/

---

## Disproportionately reported terms for tirzepatide

Data from Q2 2026 (19,433 distinct cases naming tirzepatide as a suspect). The label versions searched are MOUNJARO and ZEPBOUND versions 40, effective August 2026.

### Terms with no matching label text:

| Term | Cases | ROR (95% CI) |
|------|-------|------------|
| Therapeutic response changed | 367 | 38.76 (32.61–46.08) |
| Gastrointestinal hypomotility | 65 | 12.52 (9.2–17.03) |
| Allodynia | 37 | 12.6 (8.37–18.96) |
| Food craving | 163 | 9.51 (7.9–11.45) |
| Injection site coldness | 11 | 17.56 (7.86–39.19) |
| Hunger | 263 | 7.14 (6.2–8.22) |
| Skin laxity | 18 | 8.89 (5.12–15.45) |
| Feeding disorder | 193 | 5.87 (5.0–6.9) |
| Depression suicidal | 15 | 8.41 (4.62–15.33) |

### Terms the label describes or relates to:

| Term | Cases | ROR (95% CI) | Label Status | Section | Evidence |
|------|-------|------------|--------------|---------|----------|
| Injection site hypersensitivity | 78 | 28.49 (20.24–40.09) | Described | Adverse Reactions | "Injection Site Reactions" [MOUNJARO v40] |
| Drug titration issue | 51 | 48.19 (29.23–79.47) | Related | Clinical Pharmacology | "The impact of tirzepatide on gastric emptying was greatest after a single dose of 5 mg and diminished after subsequent doses." [MOUNJARO v40] |
| Incorrect product dosage form administered | 34 | 44.14 (24.36–79.98) | Related | Adverse Reactions | "Injection Site Reactions" [ZEPBOUND v40] |
| Extra dose administered | 619 | 21.49 (19.2–24.05) | Related | Adverse Reactions | "Injection Site Reactions" [ZEPBOUND v40] |
| Eructation | 461 | 18.73 (16.51–21.25) | Described | Adverse Reactions | Gastrointestinal adverse reactions table [MOUNJARO v40] |
| Obstructive pancreatitis | 25 | 25.95 (14.41–46.73) | Described | Adverse Reactions | "acute pancreatitis, hemorrhagic and necrotizing pancreatitis sometimes resulting in death, ileus, intestinal obstruction, severe constipation including fecal impaction" [MOUNJARO v40] |
| Injection site injury | 83 | 13.71 (10.39–18.1) | Described | Adverse Reactions | Injection site reactions pool data [ZEPBOUND v40] |
| Lipase increased | 39 | 9.0 (6.18–13.11) | Described | Adverse Reactions | "Amylase and Lipase Increase" [MOUNJARO v40] |
| Impaired gastric emptying | 346 | 6.38 (5.65–7.2) | Described | Clinical Pharmacology | "MOUNJARO delays gastric emptying and thereby has the potential to impact the absorption of concomitantly administered oral medications" [MOUNJARO v40] |
| Constipation | 1,307 | 5.63 (5.29–5.99) | Described | Adverse Reactions | Adverse reactions table [MOUNJARO v40] |
| Increased appetite | 217 | 6.01 (5.16–6.99) | Described | Clinical Pharmacology | "The effects are likely mediated by affecting appetite." [ZEPBOUND v40] |
| Injection site rash | 210 | 5.74 (4.92–6.69) | Described | Adverse Reactions | Injection site reactions footnote [ZEPBOUND v40] |
| Injection site pruritus | 347 | 5.47 (4.86–6.16) | Described | Adverse Reactions | Injection site reactions footnote [ZEPBOUND v40] |
| Papillary thyroid cancer | 11 | 9.92 (4.84–20.36) | Related | Boxed Warning | "WARNING: RISK OF THYROID C-CELL TUMORS" [MOUNJARO v40] |
| Dyspepsia | 456 | 4.82 (4.35–5.35) | Described | Adverse Reactions | Adverse reactions table [MOUNJARO v40] |
| Gallbladder injury | 11 | 8.78 (4.34–17.77) | Described | Adverse Reactions | "Acute Gallbladder Disease" [MOUNJARO v40] |

**Notes:** 
- "Therapeutic response changed" is the most disproportionately reported term with 367 cases and an ROR of 38.76, but no matching label text was found. This likely reflects efficacy complaints—the drug not working as expected—which FAERS captures but which may fall outside traditional adverse event review.
- "Hunger" and "Feeding disorder" are efficacy-related terms (unexpectedly increased appetite or eating behavior changes).
- 19 additional administrative or device terms were suppressed from this output.
