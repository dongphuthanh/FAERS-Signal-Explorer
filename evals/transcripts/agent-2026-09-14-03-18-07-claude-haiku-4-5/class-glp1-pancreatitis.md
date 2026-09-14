# class-glp1-pancreatitis

**Q:** Compare pancreatitis reporting across the GLP-1 drugs.

**Tool calls:**
- query_adverse_events {"drug_class":"glp1","mode":"counts","term_pattern":"pancreatitis"}
- query_adverse_events {"drug":"semaglutide","mode":"counts","term_pattern":"pancreatitis"}
- query_adverse_events {"drug":"tirzepatide","mode":"counts","term_pattern":"pancreatitis"}
- query_adverse_events {"drug":"liraglutide","mode":"counts","term_pattern":"pancreatitis"}
- query_adverse_events {"drug":"dulaglutide","mode":"counts","term_pattern":"pancreatitis"}
- query_adverse_events {"drug":"exenatide","mode":"counts","term_pattern":"pancreatitis"}

**Checks:** all passed

---

## Pancreatitis Reporting Across GLP-1 Drugs

Here is a comparison of pancreatitis reports by drug across the GLP-1 class (2026q2):

| Drug | Pancreatitis (all types) | Acute Pancreatitis | Exposed Cases |
|------|--------------------------|-------------------|----------------|
| **Semaglutide** | 156 | 36 | 16,486 |
| **Tirzepatide** | 156 | 38 | 19,433 |
| **Dulaglutide** | 13 | 5 | 1,281 |
| **Liraglutide** | 5 | — | 454 |
| **Exenatide** | 0 | — | 0 |

**Key observations:**

- **Semaglutide** and **tirzepatide** account for the vast majority of pancreatitis reports across the GLP-1 class, with identical counts of 156 cases reporting pancreatitis broadly. Both drugs account for approximately 312 of the 309 cases in the entire GLP-1 class reported above the main pancreatitis term (noting the class total of 309 reflects distinct cases, while individual drug counts may overlap or represent subset reporting).
- **Dulaglutide** has substantially fewer reports: 13 cases of pancreatitis (any type), 5 acute.
- **Liraglutide** has 5 reports of pancreatitis.
- **Exenatide** has no reports of pancreatitis in the loaded data.

The difference in case counts partly reflects the size of the reporting base: semaglutide and tirzepatide have far larger numbers of suspect reports overall. To assess whether the pancreatitis reporting is disproportionate for each drug, you may want to run a "gap" mode analysis to see the reporting odds ratios.
