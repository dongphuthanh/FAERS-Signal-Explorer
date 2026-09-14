# gap-brand

**Q:** Give me the signal overview for Ozempic.

**Tool calls:**
- query_adverse_events {"drug":"Ozempic","mode":"gap"}

**Checks:** all passed

---

## Signal Overview: Ozempic (Semaglutide)

**Data source:** FAERS reports from 2025Q3–2026Q2; 38,318 distinct cases naming semaglutide products as suspects, versus 1,529,453 cases on all other suspect drugs.

The top 25 disproportionately reported terms are below, grouped by label status. Three semaglutide product labels are available: Ozempic (injection, versions 14 and 20), Rybelsus (oral), and Wegovy (versions 19).

### **Terms with No Matching Label Text** (37 additional administrative/device terms excluded)

| Term | Cases | ROR (95% CI) | Evidence |
|------|-------|-------------|----------|
| Cyclic vomiting syndrome | 375 | 545.81 (369.3–806.7) | No matching label text |
| Optic ischaemic neuropathy | 645 | 105.48 (91.0–122.3) | No matching label text |
| Gastrointestinal hypomotility | 491 | 51.6 (45.1–59.1) | No matching label text |
| Gastric hypomotility | 81 | 55.41 (39.5–77.8) | No matching label text |
| Heart sounds | 10 | 129.75 (35.7–471.5) | No matching label text |
| Skin pressure mark | 22 | 61.19 (31.3–119.6) | No matching label text |
| Food craving | 509 | 32.84 (29.2–37.0) | No matching label text |
| Hunger | 1,074 | 29.67 (27.4–32.1) | No matching label text |
| Injection site streaking | 22 | 42.83 (23.4–78.5) | No matching label text |
| Lack of satiety | 27 | 35.05 (20.8–59.0) | No matching label text |
| Stressed eating | 12 | 35.93 (16.4–78.8) | No matching label text |
| Skin laxity | 49 | 21.21 (15.0–30.1) | No matching label text |
| Facial wasting | 13 | 28.11 (13.8–57.4) | No matching label text |
| Hyperphagia | 126 | 15.18 (12.4–18.7) | No matching label text |
| Early satiety | 57 | 15.98 (11.7–21.8) | No matching label text |

### **Terms Described in Label**

| Term | Cases | ROR (95% CI) | Label Status & Evidence |
|------|-------|-------------|--------|
| Gallbladder injury | 138 | 149.71 (103.7–216.1) | [Ozempic Injection v20, Adverse Reactions]: "Acute Gallbladder Disease" |
| Impaired gastric emptying | 3,101 | 82.59 (77.7–87.8) | [Ozempic Injection v20, Clinical Pharmacology]: "Gastric emptying" |
| Ileus | 532 | 27.76 (24.8–31.0) | [Ozempic Injection v20, Adverse Reactions]: "ileus, intestinal obstruction, severe constipation including fecal impaction" |
| Abnormal loss of weight | 177 | 15.87 (13.3–18.9) | [Ozempic Injection v20, Specific Populations]: Referenced in animal studies |

### **Terms Related to Label**

| Term | Cases | ROR (95% CI) | Label Status & Evidence |
|------|-------|-------------|--------|
| Weight loss poor | 1,114 | 173.03 (151.1–198.2) | [Wegovy v19, Clinical Studies]: "all patients received instruction for a reduced-calorie diet... and increased physical activity counseling" *(note: this is an efficacy/counseling statement, not an adverse reaction)* |
| Glycosylated haemoglobin decreased | 86 | 33.21 (24.9–44.3) | [Wegovy v19, Adverse Reactions]: "The risk of hypoglycemia was increased when WEGOVY was used with a sulfonylurea" |
| Increased appetite | 843 | 19.1 (17.6–20.8) | [Wegovy v19, Clinical Pharmacology]: "The effects are likely mediated by affecting appetite" |
| Medullary thyroid cancer | 21 | 29.2 (16.6–51.4) | [Wegovy v19, Boxed Warning]: "It is unknown whether WEGOVY causes thyroid C-cell tumors, including medullary thyroid carcinoma (MTC)" |
| Appetite disorder | 227 | 18.43 (15.7–21.6) | [Wegovy v19, Clinical Pharmacology]: "GLP-1 is a physiological regulator of appetite... and the GLP-1 receptor is present in several areas of the brain involved in appetite regulation" |
| Allodynia | 92 | 22.01 (17.1–28.4) | [Wegovy v19, Adverse Reactions]: "Includes paresthesia, hyperesthesia, burning sensation, allodynia, dysesthesia..." |

**Key findings:**
- **Cyclic vomiting syndrome** (375 cases, ROR 545.81) is the highest disproportionately reported term with no matching label text.
- **Optic ischaemic neuropathy** (645 cases, ROR 105.48) is substantially reported with no matching label text.
- Several appetite-related terms ("Hunger", "Food craving", "Increased appetite", "Lack of satiety") reflect the drug's intended mechanism but are reported disproportionately; note that "Weight loss poor" and efficacy complaints are efficacy-related reports, not adverse events in the traditional sense.
- Terms related to gastrointestinal effects (impaired gastric emptying, ileus, gastric hypomotility) dominate, reflecting the drug's pharmacology.
