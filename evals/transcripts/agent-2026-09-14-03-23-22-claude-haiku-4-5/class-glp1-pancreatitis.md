# class-glp1-pancreatitis

**Q:** Compare pancreatitis reporting across the GLP-1 drugs.

**Tool calls:**
- query_adverse_events {"drug":"semaglutide","mode":"counts","term_pattern":"pancreatitis"}
- query_adverse_events {"drug":"tirzepatide","mode":"counts","term_pattern":"pancreatitis"}
- query_adverse_events {"drug":"dulaglutide","mode":"counts","term_pattern":"pancreatitis"}
- query_adverse_events {"drug":"liraglutide","mode":"counts","term_pattern":"pancreatitis"}
- query_adverse_events {"drug":"ozempic","mode":"counts","term_pattern":"pancreatitis"}
- query_adverse_events {"drug":"mounjaro","mode":"counts","term_pattern":"pancreatitis"}

**Checks:** all passed

---

## Pancreatitis Reporting Across GLP-1 Drugs (2026q2)

**Semaglutide and tirzepatide account for the majority of pancreatitis reports.** The two newer, widely-used GLP-1 drugs dominate the signal despite similar denominator sizes, whereas older agents report far fewer cases.

| Drug | Total "Pancreatitis" | Acute | Necrotizing | Obstructive | Other Subtypes | Total Cases Reported |
|------|-----|-------|-----------|------------|---------|------|
| **Semaglutide** | 156 | 36 | 15 | 4 | 8 | 16,486 |
| **Tirzepatide** | 156 | 38 | 11 | 25 | 16 | 19,433 |
| **Dulaglutide** | 8 | 5 | — | — | — | 1,281 |
| **Liraglutide** | 5 | — | — | — | — | 454 |

**Key observations:**

- **Semaglutide** and **tirzepatide** each named "Pancreatitis" in 156 cases—substantially more than older GLP-1 drugs—despite being in the FAERS database for fewer years than liraglutide.
- **Tirzepatide** has more obstructive pancreatitis reports (25 cases) than semaglutide (4 cases).
- **Dulaglutide** and **liraglutide** report far fewer pancreatitis cases overall, though the drugs also have much smaller total case counts in the database, so absolute numbers are not directly comparable without rates (which FAERS cannot provide).

Whether these differences reflect true signal differences, differential reporting, or differences in prescribing volume across indications cannot be determined from FAERS counts alone.
