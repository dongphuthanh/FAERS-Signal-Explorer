# gap-brand

**Q:** Give me the signal overview for Ozempic.

**Tool calls:**
- query_adverse_events {"drug":"Ozempic","mode":"gap","top":25}

**Checks:** all passed

---

## Signal Overview for Ozempic (semaglutide)

**Data source:** FAERS Q2 2026; 16,486 distinct cases naming semaglutide as a suspect drug versus 422,395 other drugs.

### Key Findings

**Most disproportionately reported — not described by the label:**

1. **Cyclic vomiting syndrome** — 81 cases, ROR 250.5 (95% CI 121.1–518.1). No matching label text.
2. **Optic ischaemic neuropathy** — 196 cases, ROR 58.8 (95% CI 45.5–76.1). No matching label text.
3. **Gastric hypomotility** — 16 cases, ROR 65.7 (95% CI 25.7–168.0). No matching label text.
4. **Gastrointestinal hypomotility** — 100 cases, ROR 33.9 (95% CI 25.1–45.9). No matching label text.
5. **Injection site discharge** — 194 cases, ROR 14.4 (95% CI 12.0–17.2). No matching label text.
6. **Injection site indentation** — 77 cases, ROR 14.9 (95% CI 11.2–19.7). No matching label text.
7. **Hyperphagia** — 70 cases, ROR 15.7 (95% CI 11.7–21.2). No matching label text.
8. **Skin laxity** — 23 cases, ROR 15.3 (95% CI 9.1–25.8). No matching label text.
9. **Gastrointestinal sounds abnormal** — 92 cases, ROR 11.5 (95% CI 9.0–14.7). No matching label text.

**Disproportionately reported and label-described:**

- **Impaired gastric emptying** — 1,073 cases, ROR 68.0 (95% CI 60.7–76.3) [OZEMPIC injection label, clinical pharmacology]
- **Ileus** — 152 cases, ROR 18.6 (95% CI 15.1–23.0) [OZEMPIC injection label, adverse reactions: "ileus, intestinal obstruction, severe constipation including fecal impaction"]
- **Eructation** — 251 cases, ROR 8.6 (95% CI 7.4–9.9) [OZEMPIC injection label, adverse reactions]
- **Dysaesthesia** — 49 cases, ROR 17.0 (95% CI 11.8–24.5) [OZEMPIC injection label, adverse reactions]
- **Allodynia** — 39 cases, ROR 16.3 (95% CI 10.9–24.5) [WEGOVY label, adverse reactions]
- **Gallbladder injury** — 33 cases, ROR 203.5 (95% CI 72.1–574.6) [OZEMPIC injection label, adverse reactions]

**Efficacy and appetite-related terms** (expected effects, not adverse events):
- **Weight loss poor** — 675 cases, related to label [WEGOVY label, clinical studies]
- **Hunger** — 597 cases, not described; **Increased appetite** — 418 cases, related to label; **Appetite disorder** — 155 cases, related to label [WEGOVY label, clinical pharmacology: "GLP-1 is a physiological regulator of appetite"]
- **Food craving** — 295 cases; **Lack of satiety** — 14 cases. No matching label text.

**Lab changes:**
- **Glycosylated haemoglobin decreased** and **increased** — 34 and 181 cases respectively; both related to label [WEGOVY label, adverse reactions]

---

**Note:** 25 administrative/device terms were suppressed from this list. The ROR comparator is all other suspect drugs in the loaded quarters. Several terms with identical case counts (e.g., appetite-related reports, injection site terms) may originate from duplicated reports. Whether appetite-related reports and lab changes belong in a safety review is your assessment.
