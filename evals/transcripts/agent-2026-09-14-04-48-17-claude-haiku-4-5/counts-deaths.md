# counts-deaths

**Q:** How many deaths have been reported with dupilumab?

**Tool calls:**
- query_adverse_events {"drug":"dupilumab","mode":"counts","term_pattern":"death|died"}

**Checks:** tool: no call matching {"name":"query_adverse_events","input":{"mode":"counts","outcomes":"DE"}}; got [{"n":"query_adverse_events","i":{"drug":"dupilumab","mode":"counts","term_pattern":"death|died"}}]

---

Based on FAERS data from 2025Q3 through 2026Q2, there are **366 cases** naming dupilumab as a suspect where "Death" was reported as an adverse event term.

This is a count of distinct FAERS reports. It is not a rate or an indication of causation. FAERS has no denominator (the number of patients who took dupilumab is unknown), and reports are spontaneous, unverified submissions. A report naming a drug as a suspect does not mean the drug caused the event.
