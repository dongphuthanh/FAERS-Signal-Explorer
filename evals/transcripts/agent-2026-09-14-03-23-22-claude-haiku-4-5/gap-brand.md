# gap-brand

**Q:** Give me the signal overview for Ozempic.

**Tool calls:**
- query_adverse_events {"drug":"Ozempic","mode":"gap"}

**Checks:** all passed

---

## Signal Overview: Ozempic (semaglutide)

**Data:** 16,486 distinct cases naming Ozempic as a suspect drug reported to FAERS in 2026 Q2, versus 422,395 reports for all other suspect drugs.

### Key Findings

**Disproportionately reported terms with no matching label text:**

| Term | Cases | ROR (95% CI) | Label Status |
|------|-------|-------------|--------------|
| Cyclic vomiting syndrome | 81 | 250.52 (121.14–518.05) | None |
| Optic ischaemic neuropathy | 196 | 58.83 (45.49–76.08) | None |
| Hunger | 597 | 34.7 (30.65–39.29) | None |
| Food craving | 295 | 32.71 (27.48–38.92) | None |
| Gastric hypomotility | 16 | 65.72 (25.71–167.97) | None |
| Gastrointestinal hypomotility | 100 | 33.93 (25.08–45.9) | None |
| Lack of satiety | 14 | 43.12 (18.09–102.81) | None |
| Injection site discharge | 194 | 14.37 (12.04–17.16) | None |
| Needle track marks | 14 | 24.64 (11.75–51.7) | None |
| Injection site indentation | 77 | 14.88 (11.21–19.74) | None |
| Hyperphagia | 70 | 15.73 (11.65–21.24) | None |
| Skin laxity | 23 | 15.33 (9.11–25.79) | None |
| Gastrointestinal sounds abnormal | 92 | 11.5 (8.98–14.73) | None |

**Disproportionately reported terms the label describes:**

| Term | Cases | ROR (95% CI) | Label Section |
|------|-------|-------------|--------------|
| Impaired gastric emptying | 1,073 | 68.02 (60.67–76.27) | Clinical pharmacology |
| Gallbladder injury | 33 | 203.53 (72.1–574.58) | Adverse reactions |
| Ileus | 152 | 18.6 (15.06–22.96) | Adverse reactions |
| Dysaesthesia | 49 | 17.04 (11.84–24.53) | Adverse reactions |
| Allodynia | 39 | 16.31 (10.88–24.45) | Adverse reactions |
| Eructation | 251 | 8.56 (7.41–9.89) | Adverse reactions |

**Related to label (efficacy/mechanism, not safety adverse events):**

| Term | Cases | ROR (95% CI) | Note |
|------|-------|-------------|------|
| Weight loss poor | 675 | 114.72 (96.09–136.95) | Efficacy complaint |
| Hunger | — | — | Appetite regulation mechanism |
| Food craving | — | — | Appetite regulation mechanism |
| Appetite disorder | 155 | 27.91 (22.18–35.12) | Appetite regulation mechanism |
| Increased appetite | 418 | 19 (16.72–21.59) | Appetite regulation mechanism |
| Glycosylated haemoglobin decreased/increased | 34/181 | 33.55/11.01 | Glucose control |

### Notable Signals

The most striking signal is **cyclic vomiting syndrome** with 81 cases and an ROR of 250.52, which has no matching label text in the Ozempic prescribing information searched.

**Optic ischaemic neuropathy** (196 cases, ROR 58.83) is also disproportionately reported with no label description.

Several **gastrointestinal motility terms** are reported disproportionately—some described (impaired gastric emptying, ileus) and others not (gastric hypomotility, gastrointestinal hypomotility, lack of satiety).

**Injection site terms** (discharge, needle track marks, indentation) appear with modest RORs and no label description; these may reflect injection technique issues or patients' attention to injection sites.

Multiple **appetite-related reports** (hunger, food craving, hyperphagia) are disproportionately reported; the label describes appetite regulation as the drug's mechanism but these specific terms have no matching text.

**Note:** Terms like "Weight loss poor," "Hunger," "Food craving," "Increased appetite," and "Abnormal loss of weight" are efficacy complaints or expected pharmacological effects, not adverse events in the traditional sense.

29 administrative/device terms were suppressed from this view.
