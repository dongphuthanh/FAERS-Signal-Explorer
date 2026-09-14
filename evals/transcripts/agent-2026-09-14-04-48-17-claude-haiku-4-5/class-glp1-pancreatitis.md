# class-glp1-pancreatitis

**Q:** Compare pancreatitis reporting across the GLP-1 drugs.

**Tool calls:**
- query_adverse_events {"drug_class":"glp1","mode":"counts","term_pattern":"pancreatitis"}
- query_adverse_events {"drug":"semaglutide","mode":"counts","term_pattern":"pancreatitis"}
- query_adverse_events {"drug":"tirzepatide","mode":"counts","term_pattern":"pancreatitis"}
- query_adverse_events {"drug":"liraglutide","mode":"counts","term_pattern":"pancreatitis"}
- query_adverse_events {"drug":"dulaglutide","mode":"counts","term_pattern":"pancreatitis"}
- query_adverse_events {"drug":"exenatide","mode":"counts","term_pattern":"pancreatitis"}
- query_adverse_events {"drug":"lixisenatide","mode":"counts","term_pattern":"pancreatitis"}

**Checks:** all passed

---

## Pancreatitis Reporting Across GLP-1 Drugs (2025 Q3 – 2026 Q2)

Pancreatitis reports across the GLP-1 class totaled **1,768 cases** (1,132 "Pancreatitis" + subtypes). Here's the breakdown by drug:

| Drug | Pancreatitis (all types) | Pancreatitis | Pancreatitis acute | Cases named as suspect |
|------|--------------------------|--------------|-------------------|----------------------|
| **Tirzepatide** | 962 | 592 | 202 | 71,343 |
| **Semaglutide** | 705 | 509 | 139 | 38,318 |
| **Dulaglutide** | 97 | 66 | 18 | 4,868 |
| **Liraglutide** | 45 | 41 | 4 | 2,177 |
| **Exenatide** | 4 | 4 | — | 514 |
| **Lixisenatide** | 0 | — | — | 0 |

**Key observations:**
- Tirzepatide and semaglutide account for the vast majority of pancreatitis reports (962 and 705 cases respectively).
- Tirzepatide has the largest report count overall (71,343 cases named as suspect), followed by semaglutide (38,318).
- Dulaglutide (4,868 suspect cases) and liraglutide (2,177 suspect cases) have substantially lower pancreatitis report counts, despite both being GLP-1 drugs with established use.
- The older GLP-1s (exenatide, lixisenatide) have minimal to no pancreatitis reports.

Remember: these are counts of distinct FAERS cases naming each drug as a suspect. They are not rates, do not account for differing exposure levels, and do not establish causation.
