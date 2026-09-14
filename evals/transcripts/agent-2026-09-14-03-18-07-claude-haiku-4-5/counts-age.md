# counts-age

**Q:** What are the top reported reactions for semaglutide in patients 65 and over?

**Tool calls:**
- query_adverse_events {"drug":"semaglutide","mode":"gap","age_bracket":"65+"}

**Checks:** framing: "risk of"; tool: no call matching {"name":"query_adverse_events","input":{"mode":"counts","age_bracket":"65\\+"}}; got [{"n":"query_adverse_events","i":{"drug":"semaglutide","mode":"gap","age_bracket":"65+"}}]; missing: /nausea/

---

Here are the top reported reactions for semaglutide in patients 65 and over, based on FAERS data from Q2 2026:

| Term | Cases | ROR (95% CI lower) | Label Status | Section | Evidence |
|------|-------|-------------------|--------------|---------|----------|
| **Not described in label** |
| Cyclic vomiting syndrome | 81 | 250.52 (121.14–) | None | — | — |
| Optic ischaemic neuropathy | 196 | 58.83 (45.49–) | None | — | — |
| Hunger | 597 | 34.7 (30.65–) | None | — | — |
| Food craving | 295 | 32.71 (27.48–) | None | — | — |
| Gastric hypomotility | 16 | 65.72 (25.71–) | None | — | — |
| Gastrointestinal hypomotility | 100 | 33.93 (25.08–) | None | — | — |
| Lack of satiety | 14 | 43.12 (18.09–) | None | — | — |
| Injection site discharge | 194 | 14.37 (12.04–) | None | — | — |
| Needle track marks | 14 | 24.64 (11.75–) | None | — | — |
| Hyperphagia | 70 | 15.73 (11.65–) | None | — | — |
| Injection site indentation | 77 | 14.88 (11.21–) | None | — | — |
| Skin laxity | 23 | 15.33 (9.11–) | None | — | — |
| Gastrointestinal sounds abnormal | 92 | 11.5 (8.98–) | None | — | — |
| **Described or related in label** |
| Impaired gastric emptying | 1,073 | 68.02 (60.67–) | Described | Clinical pharmacology | Gastric emptying [Ozempic injection] |
| Gallbladder injury | 33 | 203.53 (72.1–) | Described | Adverse reactions | Acute Gallbladder Disease [Ozempic injection] |
| Ileus | 152 | 18.6 (15.06–) | Described | Adverse reactions | Gastrointestinal: acute pancreatitis and necrotizing pancreatitis, sometimes resulting in death; ileus, intestinal obstruction, severe constipation including fecal impaction [Ozempic injection] |
| Dysaesthesia | 49 | 17.04 (11.84–) | Described | Adverse reactions | Neurologic: dysesthesia, headache [Ozempic injection] |
| Allodynia | 39 | 16.31 (10.88–) | Described | Adverse reactions | Includes paresthesia, hyperesthesia, burning sensation, allodynia, dysesthesia, skin burning sensation, pain of skin, and sensitive skin [Wegovy] |
| Eructation | 251 | 8.56 (7.41–) | Described | Adverse reactions | [Ozempic injection] |
| **Efficacy/appetite-related (reporting patterns, not adverse events)** |
| Weight loss poor | 675 | 114.72 (96.09–) | Related | Clinical studies | In Studies 2, 3, 5, 7, 8 and 9, all patients received instruction for a reduced-calorie diet... [Wegovy] |
| Appetite disorder | 155 | 27.91 (22.18–) | Related | Clinical pharmacology | GLP-1 is a physiological regulator of appetite and caloric intake... [Wegovy] |
| Increased appetite | 418 | 19.0 (16.72–) | Related | Clinical pharmacology | The effects are likely mediated by affecting appetite [Wegovy] |
| Glycosylated haemoglobin decreased | 34 | 33.55 (20.02–) | Related | Adverse reactions | The risk of hypoglycemia was increased when WEGOVY was used with a sulfonylurea [Wegovy] |
| Glycosylated haemoglobin increased | 181 | 11.01 (9.23–) | Related | Adverse reactions | The risk of hypoglycemia was increased when WEGOVY was used with a sulfonylurea [Wegovy] |
| Abnormal loss of weight | 80 | 13.28 (10.12–) | Described | Specific populations | [Ozempic injection] |

**Notes:**
- Data are from Q2 2026, comparing semaglutide reports to all other suspect drugs.
- Terms are sorted by reporting odds ratio (ROR), which measures disproportionate reporting; higher ROR does not imply causation.
- 25 additional administrative/device terms are suppressed.
- Appetite and weight-related terms (hunger, food craving, weight loss poor, appetite disorder, increased appetite) are efficacy complaints or expected pharmacological effects, not adverse events; whether they should be considered in safety review is the analyst's call.
- The most disproportionately reported term not described in the label is cyclic vomiting syndrome (81 cases, ROR 250.52).
