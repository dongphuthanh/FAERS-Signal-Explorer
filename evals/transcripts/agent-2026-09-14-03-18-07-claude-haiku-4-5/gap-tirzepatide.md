# gap-tirzepatide

**Q:** What is being reported for tirzepatide that its label does not describe?

**Tool calls:**
- query_adverse_events {"drug":"tirzepatide","mode":"gap"}

**Checks:** missing: /other suspect drugs|comparator/; missing: /no matching/; cites_label: no section citation

---

Based on FAERS reports for tirzepatide (data from 2026q2), here are the disproportionately reported terms that the label does **not** describe:

| Term | Cases | ROR (95% CI lower) | Label Status |
|------|-------|------------------|--------------|
| **Intercepted product selection error** | 259 | 907.18 (403.76) | None |
| **Intercepted product dispensing error** | 68 | 88.43 (51.29) | None |
| **Therapeutic response changed** | 367 | 38.76 (32.61) | None |
| **Intercepted product prescribing error** | 52 | 37.28 (23.66) | None |
| **Incorrect product formulation administered** | 25 | 47.19 (23.22) | None |
| **Gastrointestinal hypomotility** | 65 | 12.52 (9.20) | None |
| **Allodynia** | 37 | 12.60 (8.37) | None |
| **Food craving** | 163 | 9.51 (7.90) | None |
| **Injection site coldness** | 11 | 17.56 (7.86) | None |
| **Hunger** | 263 | 7.14 (6.20) | None |
| **Skin laxity** | 18 | 8.89 (5.12) | None |
| **Off label use of device** | 21 | 8.38 (5.05) | None |
| **Feeding disorder** | 193 | 5.87 (5.00) | None |

**Key observations:**

1. **Administrative/device terms dominate the top findings.** The highest ROR terms—product selection errors, dispensing errors, prescribing errors—are administrative or handling issues, not clinical adverse events. These reflect post-market reporting patterns (how the drug was managed) rather than pharmacological effects. The tool suppressed 11 additional administrative/device terms.

2. **Efficacy complaints present.** "Therapeutic response changed," "Hunger," "Food craving," and "Feeding disorder" are efficacy-related reports, not adverse events in the traditional sense. Whether they belong in a safety review is your call as the analyst.

3. **Gastrointestinal hypomotility (65 cases, ROR 12.52)** stands out as a potentially clinically relevant unreported term. The label describes "impaired gastric emptying" but not the broader term hypomotility.

4. **Allodynia and skin laxity** are less common but reported disproportionately and not in the label.

The label versions examined are MOUNJARO and ZEPBOUND (version 40, dated August 2026).
