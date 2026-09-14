# First real calls — 2026-09-14 · claude-opus-5 · FAERS 2026q2

Five questions, run once each from `scripts/ask.mjs`, before any prompt iteration. Tool calls are shown as → / ←. Q3's transcript lost its markdown blockquotes to a display filter (lines beginning with '>'); the model's answer contained the label quotes.

---

## Q1

```
    claude-opus-5  ·  What's being reported for semaglutide that isn't in the label?
  I'll pull the disproportionality gap analysis for semaglutide.  → query_adverse_events {"drug":"semaglutide","mode":"gap","top":30}
    ← query_adverse_events 3062 ms
  Let me verify the two most clinically notable "none" terms directly against the labels.  → search_label {"drug":"semaglutide","query":"non-arteritic anterior ischemic optic neuropathy, optic nerve, vision loss","k":6}
    ← search_label 13 ms
    → search_label {"drug":"semaglutide","query":"cyclic vomiting syndrome, persistent recurrent vomiting","k":6}
    ← search_label 30 ms
  ## Semaglutide — disproportionately reported terms not described in the label
  **Comparator:** all other suspect drugs in the loaded quarter (**2026Q2**), 422,395 cases total, 16,486 naming semaglutide as a suspect (PS/SS roles). Labels searched: Ozempic injection v20 (2026-06-01), Ozempic/Rybelsus oral tablet v14 (2026-01-30), Wegovy injection/tablet v19 (2026-06-18). **25 additional terms were suppressed as administrative/device terms** — ask if you want them shown.
  ### Headline
  Two terms stand out as clinically substantive with no matching label text: **cyclic vomiting syndrome** (81 cases, ROR 250.5, 95% LB 121.1) and **optic ischaemic neuropathy** (196 cases, ROR 58.8, 95% LB 45.5). The rest of the "none" group is dominated by appetite/satiety terms and injection-site appearance terms.
  ### Group 1 — no matching label text
  | Term | Cases | ROR (95% LB) | Note |
  |---|---|---|---|
  | Cyclic vomiting syndrome | 81 | 250.5 (121.1) | No matching text; label search returned only general GI reaction tables |
  | Optic ischaemic neuropathy | 196 | 58.8 (45.5) | No matching text; label search returned only **diabetic retinopathy** passages |
  | Lack of satiety | 14 | 43.1 (18.1) | Efficacy complaint |
  | Hunger | 597 | 34.7 (30.7) | Efficacy complaint |
  | Gastrointestinal hypomotility | 100 | 33.9 (25.1) | |
  | Food craving | 295 | 32.7 (27.5) | Efficacy complaint |
  | Gastric hypomotility | 16 | 65.7 (25.7) | |
  | Needle track marks | 14 | 24.6 (11.8) | Administration/appearance |
  | Hyperphagia | 70 | 15.7 (11.7) | Efficacy complaint |
  | Skin laxity | 23 | 15.3 (9.1) | |
  | Injection site discharge | 194 | 14.4 (12.0) | |
  | Injection site indentation | 77 | 14.9 (11.2) | |
  | Food aversion | 21 | 12.0 (7.1) | |
  | Gastrointestinal sounds abnormal | 92 | 11.5 (9.0) | |
  | Vomiting projectile | 28 | 10.6 (6.8) | |
  | Weight increased | 1,266 | 6.7 (6.3) | Efficacy complaint |
  ### Group 2 — related label text (adjacent, not the same term)
  | Term | Cases | ROR (95% LB) | Section / evidence |
  |---|---|---|---|
  | Weight loss poor | 675 | 114.7 (96.1) | Wegovy v19, clinical_studies: "all patients received instruction for a reduced-calorie diet…" |
  | Appetite disorder | 155 | 27.9 (22.2) | Wegovy v19, clinical_pharmacology: "GLP-1 is a physiological regulator of appetite and caloric intake…" |
  | Glycosylated haemoglobin decreased | 34 | 33.6 (20.0) | Wegovy v19, adverse_reactions: "The risk of hypoglycemia was increased when WEGOVY was used with a sulfonylurea." |
  | Increased appetite | 418 | 19.0 (16.7) | Wegovy v19, clinical_pharmacology: "The effects are likely mediated by affecting appetite." |
  | Glycosylated haemoglobin increased | 181 | 11.0 (9.2) | Wegovy v19, adverse_reactions: same hypoglycemia sentence |
  ### Group 3 — described in the label
  | Term | Cases | ROR (95% LB) | Section / evidence |
  |---|---|---|---|
  | Gallbladder injury | 33 | 203.5 (72.1) | Ozempic v20, adverse_reactions: "Acute Gallbladder Disease [see Warnings and Precautions (5.9)]" |
  | Impaired gastric emptying | 1,073 | 68.0 (60.7) | Ozempic v20, clinical_pharmacology: "Gastric emptying" |
  | Ileus | 152 | 18.6 (15.1) | Ozempic v20, adverse_reactions: "…ileus, intestinal obstruction, severe constipation including fecal impaction" |
  | Intestinal obstruction | 270 | 8.3 (7.3) | Ozempic v20, adverse_reactions: same sentence |
  | Dysaesthesia | 49 | 17.0 (11.8) | Ozempic v20, adverse_reactions: "Neurologic: dysesthesia, headache" |
  | Allodynia | 39 | 16.3 (10.9) | Wegovy v19, adverse_reactions: "Includes paresthesia, hyperesthesia, burning sensation, allodynia, dysesthesia…" |
  | Abnormal loss of weight | 80 | 13.3 (10.1) | Ozempic v20, specific_populations — match is to an animal reproduction passage; treat as a weak match |
  | Eructation | 251 | 8.6 (7.4) | Ozempic v20, adverse_reactions: "…dyspepsia (1.9%, 3.5%, 2.7%), e…" |
  | Blood glucose decreased | 168 | 7.2 (6.1) | Ozempic/Rybelsus v14, clinical_pharmacology: "Semaglutide lowers high blood glucose concentrations…" |
  ### Reading notes
  - **A large share of this list is not adverse events.** Hunger, food craving, increased appetite, hyperphagia, lack of satiety, weight loss poor, weight increased, food aversion, and the two HbA1c terms are efficacy complaints or expected pharmacologic/lab changes. Whether they belong in a safety review is your call; they are why the "none" column looks longer than it is.
  - The **injection-site appearance cluster** (discharge 194, indentation 77, needle track marks 14) plus the appetite cluster is consistent with a large consumer-reported population and may also reflect product-quality or compounded-product reporting rather than pharmacologic effect.
  - **Optic ischaemic neuropathy:** my label search for "non-arteritic anterior ischemic optic neuropathy / optic nerve / vision loss" returned only diabetic retinopathy text across all three labels. That means our search found no matching text in the label versions we hold — it does not mean the effect is unknown or that the labels are silent by intent; confirm against the current full PI before acting on it.
  - **Cyclic vomiting syndrome** likewise returned no matching text; the nearest label content is the general GI adverse-reaction tables (nausea/vomiting/diarrhea), which describe a different clinical entity.
  - No two terms here share an identical case count, so the usual duplicate-report caveat doesn't flag anything specific in this set.
  - **These are report counts and relative reporting statistics only.** There is no denominator; none of these numbers is a rate, a risk, or evidence that semaglutide causes any of these events.
  Want me to run counts-mode on the two lead signals — e.g. serious outcomes (death/hospitalisation) or age breakdown for the optic and cyclic-vomiting terms — or compare them across the GLP-1 class?
    3 turn(s) · 15185 in / 3099 out · cache read 5818 · cache write 2909
```

---

## Q2

```
    claude-opus-5  ·  Serious hepatic events reported for statins in patients over 65.
  I'll pull hepatic-term case counts for the statin class, filtered to the 65+ bracket and serious outcomes.  → query_adverse_events {"mode":"counts","drug_class":"statin","age_bracket":"65+","outcomes":["DE","LT","HO","DS","RI","OT"],"term_pattern":"hepat|liver|jaundice|cholestas|transaminas|bilirubin|hyperbilirubin"}
    ← query_adverse_events 123 ms
    → query_adverse_events {"mode":"counts","drug_class":"statin","age_bracket":"65+","term_pattern":"hepat|liver|jaundice|cholestas|transaminas|bilirubin|hyperbilirubin"}
    ← query_adverse_events 54 ms
  Now the per-drug breakdown and what the labels say.  → query_adverse_events {"mode":"counts","drug":"atorvastatin","age_bracket":"65+","outcomes":["DE","LT","HO","DS","RI","OT"],"term_pattern":"hepat|liver|jaundice|cholestas|transaminas|bilirubin"}
    ← query_adverse_events 34 ms
    → query_adverse_events {"mode":"counts","drug":"rosuvastatin","age_bracket":"65+","outcomes":["DE","LT","HO","DS","RI","OT"],"term_pattern":"hepat|liver|jaundice|cholestas|transaminas|bilirubin"}
    ← query_adverse_events 15 ms
    → query_adverse_events {"mode":"counts","drug":"simvastatin","age_bracket":"65+","outcomes":["DE","LT","HO","DS","RI","OT"],"term_pattern":"hepat|liver|jaundice|cholestas|transaminas|bilirubin"}
    ← query_adverse_events 18 ms
    → query_adverse_events {"mode":"counts","drug":"pravastatin","age_bracket":"65+","outcomes":["DE","LT","HO","DS","RI","OT"],"term_pattern":"hepat|liver|jaundice|cholestas|transaminas|bilirubin"}
    ← query_adverse_events 7 ms
    → search_label {"query":"hepatic failure, liver enzyme abnormalities, jaundice, hepatitis","drug":"atorvastatin","k":6}
    ← search_label 141 ms
    → search_label {"query":"use in elderly patients, geriatric hepatic impairment","drug":"atorvastatin","k":5}
    ← search_label 13 ms
    → search_label {"query":"hepatic failure, transaminase elevations, jaundice, cholestatic hepatitis","drug":"rosuvastatin","k":5}
    ← search_label 26 ms
    → search_label {"query":"hepatic failure, transaminase elevations, jaundice, fulminant hepatic necrosis","drug":"simvastatin","k":5}
    ← search_label 14 ms
  ## Finding
  Across the statin class, hepatic-term reports in the 65+ bracket with a serious outcome are dominated by hepatocellular-injury and hepatic-failure terms, and **the statin labels already describe this territory explicitly** — including fatal and non-fatal hepatic failure in postmarketing use. Atorvastatin accounts for most of the volume. Nothing here is a rate: these are counts of distinct FAERS cases naming a statin as a suspect drug.
  **Class totals, 65+, serious outcomes (DE/LT/HO/DS/RI/OT), terms matching `hepat|liver|jaundice|cholestas|transaminas|bilirubin`:**
  | Term | Cases |
  |---|---|
  | Hepatic cytolysis | 38 |
  | Hepatic failure | 26 |
  | Drug-induced liver injury | 23 |
  | Mixed liver injury | 23 |
  | Liver injury | 22 |
  | Hepatocellular injury | 20 |
  | Cholestasis | 19 |
  | Transaminases increased | 17 |
  | Acute hepatic failure | 16 |
  | Hypertransaminasaemia | 16 |
  | Hepatitis cholestatic | 15 |
  | Hepatic ischaemia | 14 |
  | Hepatorenal syndrome | 14 |
  | Hepatic enzyme increased | 13 |
  | Liver function test increased | 13 |
  | Liver disorder | 12 |
  | Hepatic cyst | 9 |
  | Hepatitis fulminant | 9 |
  | Hepatic steatosis | 8 |
  | Hepatic cirrhosis / Hepatic function abnormal / Hyperbilirubinaemia | 7 each |
  | Hepatotoxicity | 6 |
  | Blood bilirubin abnormal / Congestive hepatopathy / Hepatic lesion / LFT abnormal / Polycystic liver disease | 5 each |
  | Bilirubin conjugated increased / Hepatitis | 4 each |
  | Metastases to liver | 3 |
  The tool reports 3,539 exposed cases for the class and 1,682 cases passing the filters (1,753 without the serious-outcome restriction) — i.e. the serious-outcome filter removes relatively few of these reports.
  ## By drug (65+, serious outcomes)
  | Drug | Exposed cases | Leading hepatic terms |
  |---|---|---|
  | Atorvastatin | 1,993 | Hepatic cytolysis 28, Hepatic failure 25, Mixed liver injury 22, Hepatocellular injury 20, Drug-induced liver injury 19, Acute hepatic failure 15 |
  | Rosuvastatin | 1,251 | Cholestasis 9, Hepatic cytolysis 9, Hepatitis cholestatic 8, Liver injury 8, Hyperbilirubinaemia 7 |
  | Simvastatin | 424 | Transaminases increased 11, Hepatic cyst 9, Hepatitis fulminant 9, Liver disorder 8, LFT increased 8 |
  | Pravastatin | 134 | Hepatitis cholestatic 3 (only term ≥3) |
  Counts track reporting volume per drug, not any comparison between them — counts mode returns no ROR, so none of this is disproportionality. If you want a disproportionality read, I can run gap mode per drug (it is not age- or outcome-filterable, so it would cover all ages).
  ## What the labels say
  | Claim | Label evidence |
  |---|---|
  | Hepatic failure, fatal and non-fatal | "There have been rare postmarketing reports of fatal and non-fatal hepatic failure in patients taking statins, including LIPITOR." [LIPITOR (atorvastatin), Viatris Specialty LLC, 5 Warnings and Precautions]. Same sentence in [CRESTOR (rosuvastatin), AstraZeneca, 5] and [ZOCOR (simvastatin), Organon, 5]. ZOCOR lists "Hepatic and Pancreatic Disorders: hepatitis/jaundice, fatal and non-fatal hepatic failure" [6 Adverse Reactions]; LIPITOR lists "Hepatobiliary Disorders: fatal and non-fatal hepatic failure" [6]. |
  | Transaminase elevations | "Persistent elevations in serum transaminases, defined as more than 3 times the ULN … occurred in 0.7% of patients who received LIPITOR in clinical trials." [LIPITOR, 6]. CRESTOR: ">3× ULN occurred in 1.1% of patients taking CRESTOR versus 0.5% of patients treated with placebo" [CRESTOR, 5]. ZOCOR: "approximately 1% of patients" [ZOCOR, 5 and 6]. |
  | Jaundice / hyperbilirubinaemia | "If serious hepatic injury with clinical symptoms and/or hyperbilirubinemia or jaundice occurs, promptly discontinue…" — present in all three labels [5 Warnings and Precautions]. |
  | Cholestasis, hepatitis | LIPITOR lists "hepatitis, cholestasis" among reactions in placebo-controlled trials [LIPITOR, 6]. |
  | Elderly specifically | "Of the total number of LIPITOR-treated patients in clinical trials, 15,813 (40%) were ≥65 years old… No overall differences in safety or effectiveness were observed." The geriatric paragraph flags myopathy/rhabdomyolysis, not hepatic injury, though it notes "the greater frequency of decreased hepatic, renal, or cardiac function" in dose selection [LIPITOR, 8.5 Geriatric Use]. Plasma concentrations are "approximately 40% for Cmax and 30% for AUC" higher in healthy elderly subjects [LIPITOR, 12 Clinical Pharmacology]. |
  So the clinical hepatic terms in this table are described by the labels. What the labels do **not** carry as a hepatic-specific statement is an age-stratified one: the geriatric sections address myopathy, not liver injury.
  ## Caveats for triage
  - **Several terms are lab findings, not clinical injury**: Transaminases increased (17), Hypertransaminasaemia (16), Hepatic enzyme increased (13), LFT increased (13), LFT abnormal (5), Blood bilirubin abnormal (5), Bilirubin conjugated increased (4). Whether these belong in a serious hepatic-event review is your call.
  - **Several terms are plausibly comorbidity capture rather than drug-attributed events** in an over-65 population: Hepatic ischaemia (14), Hepatorenal syndrome (14), Congestive hepatopathy (5), Hepatic cyst (9), Polycystic liver disease (5), Hepatic cirrhosis (7), Metastases to liver (3). FAERS does not record which drug the reporter blamed for which event.
  - **Identical counts may indicate duplication**: Hepatic ischaemia and Hepatorenal syndrome both at 14 in atorvastatin, and Hepatic cyst and Hepatitis fulminant both at 9 in simvastatin, could come from a small number of reports submitted by several manufacturers.
  - A single case contributes to multiple terms, so the column does not sum to a case count.
  - I could not determine the loaded FAERS quarters from these tool outputs, and counts mode returns no comparator, so no disproportionality statistic applies to any number above. Lovastatin, fluvastatin, pitavastatin were not queried individually; tell me if you want them.
    4 turn(s) · 25586 in / 5391 out · cache read 11636 · cache write 0
```

---

## Q3

```
    claude-opus-5  ·  What does the atorvastatin label say about muscle symptoms?
  I'll search the atorvastatin label for muscle-related content.  → search_label {"query":"muscle pain myalgia myopathy rhabdomyolysis","drug":"atorvastatin","k":10}
    ← search_label 203 ms
    → search_label {"query":"creatine kinase elevation muscle weakness immune-mediated necrotizing myopathy","drug":"atorvastatin","k":8}
    ← search_label 13 ms
  ## Summary
  The atorvastatin (LIPITOR) label describes muscle symptoms in four places: a dedicated Warnings and Precautions subsection on myopathy and rhabdomyolysis, a second subsection on immune-mediated necrotizing myopathy, the postmarketing part of Adverse Reactions, and a whole drug-interaction table built around muscle toxicity.
  All quotes below are from **LIPITOR (ATORVASTATIN CALCIUM) TABLET, FILM COATED [VIATRIS SPECIALTY LLC]** — the label search did not return a version number or revision date for this label, so I cannot cite one.
  ### Warnings and Precautions 5.1 — Myopathy and Rhabdomyolysis
  Stated risk factors:
  Management:
  ### Warnings and Precautions 5.2 — Immune-Mediated Necrotizing Myopathy
  ### Adverse Reactions 6 — postmarketing terms
  Section 6 also lists "Myopathy and Rhabdomyolysis" and "Immune-Mediated Necrotizing Myopathy" as important adverse reactions cross-referenced to sections 5.1 and 5.2.
  ### Drug Interactions 7.1 — interactions framed around muscle toxicity
  The section is titled "Drug Interactions that may Increase the Risk of Myopathy and Rhabdomyolysis with LIPITOR." Named there:
  | Interacting agent | Label statement |
  |---|---|
  | Cyclosporine, gemfibrozil | "The risk of myopathy and rhabdomyolysis is increased… Concomitant use of cyclosporine or gemfibrozil with LIPITOR is not recommended." |
  | Other fibrates | "Fibrates may cause myopathy when given alone. The risk of myopathy and rhabdomyolysis is increased with concomitant use of fibrates with LIPITOR." |
  | Niacin ≥1 g/day | "Cases of myopathy and rhabdomyolysis have been observed with concomitant use of lipid modifying dosages of niacin (≥1 gram/day niacin) with LIPITOR." |
  | Colchicine | "Cases of myopathy and rhabdomyolysis have been reported with concomitant use of colchicine with LIPITOR." |
  | CYP3A4 inhibitors (erythromycin, clarithromycin, itraconazole, ketoconazole, posaconazole, voriconazole) | "In patients taking clarithromycin or itraconazole, do not exceed LIPITOR 20 mg… Monitor all patients for signs and symptoms of myopathy." |
  | Grapefruit juice | "Concomitant intake of large quantities, more than 1.2 liters daily, of grapefruit juice is not recommended in patients taking LIPITOR." |
  Section 5.1 also names ledipasvir plus sofosbuvir among products co-reported with myopathy/rhabdomyolysis.
  ### Notes
  - The label's own descriptive terms are **myopathy, muscle pain, tenderness, weakness, elevated CK, rhabdomyolysis, myositis, IMNM, tendon rupture**. I did not find a passage using the term "myalgia" itself in these results; that may reflect the retrieval, not the label's full text.
  - This answer covers only what the label says. If you want the FAERS side — which muscle terms are reported disproportionately for atorvastatin versus all other suspect drugs in the loaded quarters, and how those map to these label sections — I can run a gap analysis or a counts query filtered on a muscle-term pattern.
    2 turn(s) · 7451 in / 2263 out · cache read 5818 · cache write 0
```

---

## Q4

```
    claude-opus-5  ·  Is the rhabdomyolysis signal for rosuvastatin different from the other statins?
  I'll pull rhabdomyolysis/myopathy counts for the statin class and for each individual statin, plus the disproportionality picture for rosuvastatin.  → query_adverse_events {"mode":"counts","drug_class":"statin","term_pattern":"rhabdomyolysis|myopathy|myositis|muscle|myalgia|creatine"}
    ← query_adverse_events 65 ms
    → query_adverse_events {"mode":"counts","drug":"rosuvastatin","term_pattern":"rhabdomyolysis|myopathy|myositis|muscle|myalgia|creatine"}
    ← query_adverse_events 19 ms
    → query_adverse_events {"mode":"gap","drug":"rosuvastatin","top":25}
    ← query_adverse_events 2772 ms
    → query_adverse_events {"mode":"counts","drug":"atorvastatin","term_pattern":"rhabdomyolysis|myopathy|myositis|myalgia|creatine"}
    ← query_adverse_events 29 ms
    → query_adverse_events {"mode":"counts","drug":"simvastatin","term_pattern":"rhabdomyolysis|myopathy|myositis|myalgia|creatine"}
    ← query_adverse_events 18 ms
    → query_adverse_events {"mode":"counts","drug":"pravastatin","term_pattern":"rhabdomyolysis|myopathy|myositis|myalgia|creatine"}
    ← query_adverse_events 8 ms
    → query_adverse_events {"mode":"counts","drug":"pitavastatin","term_pattern":"rhabdomyolysis|myopathy|myositis|myalgia|creatine"}
    ← query_adverse_events 8 ms
    → query_adverse_events {"mode":"gap","drug":"atorvastatin","top":60}
    ← query_adverse_events 4292 ms
    → query_adverse_events {"mode":"gap","drug":"simvastatin","top":60}
    ← query_adverse_events 4130 ms
    → search_label {"drug":"rosuvastatin","query":"myopathy rhabdomyolysis risk factors 40 mg dose Asian patients creatine kinase myoglobin","k":6}
    ← search_label 34 ms
    → query_adverse_events {"mode":"counts","drug":"rosuvastatin","term_pattern":"rhabdomyolysis","outcomes":["DE","HO","LT"]}
    ← query_adverse_events 27 ms
    → query_adverse_events {"mode":"counts","drug":"atorvastatin","term_pattern":"rhabdomyolysis","outcomes":["DE","HO","LT"]}
    ← query_adverse_events 32 ms
  ## Short answer
  No — on the numbers we can see, rosuvastatin's rhabdomyolysis reporting is **not distinguishable from atorvastatin's**. Its reporting odds ratio is nominally higher, but the intervals overlap substantially. What *is* different is the surrounding muscle-term profile: rosuvastatin reports cluster around myoglobin/CK laboratory terms, atorvastatin's around the immune-mediated myositis terms.
  Comparator for all RORs: all other suspect drugs in the loaded quarter (**2026q2**, 422,395 cases). Counts are distinct FAERS cases naming the drug as suspect (PS/SS). None of this is a rate, and disproportionate reporting is not evidence of causation.
  ## Rhabdomyolysis, drug by drug
  | Drug | Rhabdomyolysis cases | ROR (95% CI) | Label status |
  |---|---|---|---|
  | Rosuvastatin | 112 | 66.05 (**ROR025 53.58**–81.44) | described |
  | Atorvastatin | 145 | 55.55 (**ROR025 46.06**–66.99) | described |
  | Simvastatin | 27 | not in top 60 terms (lowest listed ROR025 was 60.13, so below that) | — |
  | Pravastatin | 8 | below the 10-case floor for gap mode | — |
  | Pitavastatin | 3 | below the floor | — |
  | Statin class (all loaded) | 289 | — | — |
  The rosuvastatin and atorvastatin confidence intervals overlap (53.58–81.44 vs 46.06–66.99); on this data you cannot say the two differ. Simvastatin, pravastatin and pitavastatin have too few cases in this quarter to produce a comparable ROR — that is a statement about report volume, not about those drugs.
  Both labels describe the event explicitly:
  - *"CRESTOR may cause myopathy … and rhabdomyolysis. Acute kidney injury secondary to myoglobinuria and rare fatalities have occurred as a result of rhabdomyolysis with statins, including CRESTOR."* [CRESTOR (rosuvastatin), v14, 2026-04-29, Warnings and Precautions 5.1]
  - *"Myopathy and Rhabdomyolysis [see Warnings and Precautions (5.1)]"* [LIPITOR (atorvastatin), v8, 2024-04-15, Adverse Reactions]
  Serious-outcome subsets (death, life-threatening or hospitalisation): rosuvastatin 76 of 112 rhabdomyolysis cases; atorvastatin 101 of 145.
  ## Where the two profiles actually diverge
  Rosuvastatin's muscle-adjacent terms skew toward laboratory findings; atorvastatin's toward autoimmune myopathy terms.
  | Term | Rosuvastatin cases | Atorvastatin cases |
  |---|---|---|
  | Myalgia | 166 | 171 |
  | Muscle spasms | 87 | (not returned; class total 136) |
  | Creatine kinase increased | 32 | 24 |
  | Immune-mediated myositis | 16 | 65 |
  | Myositis | 16 | 23 |
  | Myopathy | 8 | 35 |
  | Autoimmune myositis | — | 19 |
  | Necrotising myositis | — | 11 |
  In gap mode, atorvastatin's IMNM cluster is itself disproportionate: Immune-mediated myositis 65 cases, ROR025 97.85, label status *described* — *"There have been rare reports of immune-mediated necrotizing myopathy associated with statin use."* [LIPITOR v8, Adverse Reactions]. Rosuvastatin's equivalent term did not clear the top-25 cut.
  One rosuvastatin term worth your attention: **Myoglobin blood increased, 25 cases, ROR025 358.72**, returned with label status "none". Treat that flag with care — the CRESTOR label does discuss myoglobinuria in Warnings 5.1 (quoted above); the automated matcher simply did not link the verbatim term. This is a labelling-vocabulary mismatch, not an undescribed finding. Similarly **Renal tubular injury, 10 cases, ROR025 25.28**, label status "none", sits downstream of the same clinical picture.
  ## Caveats
  - 6 administrative/device terms were suppressed from the rosuvastatin gap output and 6 from atorvastatin's; ask if you want them shown.
  - Simvastatin's gap output contains many terms sharing an identical count of 45 or 44 — a pattern consistent with one report duplicated across several manufacturer submissions. Its 27 rhabdomyolysis cases should be read with that in mind.
  - No label version is loaded here for pravastatin or pitavastatin, so I could not check their label text.
  - Differences in report volume between statins reflect prescribing volume, product age, marketing and reporting behaviour, none of which FAERS measures. Nothing above supports ranking these drugs by muscle-injury risk.
  The label-level risk factors AstraZeneca lists — *"age 65 years or greater, uncontrolled hypothyroidism, renal impairment, concomitant use with certain other drugs … and higher CRESTOR dosage. Asian patients on CRESTOR may be at higher risk for myopathy … The myopathy risk is greater in patients taking CRESTOR 40 mg daily"* [CRESTOR v14, Warnings 5.1] — are not fields FAERS captures reliably, so I cannot stratify the 112 cases by dose or ancestry. I can break them down by age bracket or outcome code if that helps.
    4 turn(s) · 47784 in / 4841 out · cache read 11636 · cache write 0
```

---

## Q5

```
    claude-opus-5  ·  I'm on Ozempic and my vision has been blurry for a week, should I stop taking it?
  I can't advise you on that one — but here's what I can do, and what I'd urge you to do first.
  **This is a question for your prescriber or pharmacist, today.** New blurred vision lasting a week in someone on a GLP-1 medicine is something a clinician needs to evaluate in person — it can have many explanations, including ones unrelated to the medication, and some warrant prompt attention. This tool summarises population-level reports to FAERS; it cannot assess you, your symptom, or whether to change your dose. Please don't stop, continue, or adjust a prescription based on anything here.
  Let me pull the population-level and label context, which you may find useful to bring to that conversation.  → query_adverse_events {"mode":"counts","drug":"semaglutide","term_pattern":"vision|visual|ocular|retino|retinal|eye|blurred|blindness"}
    ← query_adverse_events 168 ms
    → search_label {"drug":"Ozempic","query":"diabetic retinopathy, blurred vision, visual disturbance","k":8}
    ← search_label 234 ms
  # What the population-level data shows
  ## The label does address vision
  The Ozempic prescribing information has a Warnings and Precautions subsection on this. Worth reading and raising with your clinician:
  | Label | Section | Quoted text |
  |---|---|---|
  | OZEMPIC (SEMAGLUTIDE) INJECTION, SOLUTION [Novo Nordisk] | 5 WARNINGS AND PRECAUTIONS | "Rapid improvement in glucose control has been associated with a temporary worsening of diabetic retinopathy. The effect of long-term glycemic control with semaglutide on diabetic retinopathy complications has not been studied. Patients with a history of diabetic retinopathy should be monitored for progression of diabetic retinopathy." |
  | OZEMPIC (SEMAGLUTIDE) INJECTION, SOLUTION [Novo Nordisk] | 5 WARNINGS AND PRECAUTIONS | "In a 2-year trial involving patients with type 2 diabetes and high cardiovascular risk, more events of diabetic retinopathy complications occurred in patients treated with OZEMPIC (3.0%) compared to placebo (1.8%). The absolute risk increase for diabetic retinopathy complications was larger among patients with a history of diabetic retinopathy at baseline (OZEMPIC 8.2%, placebo 5.2%) than among patients without a known history of diabetic retinopathy (OZEMPIC 0.7%, placebo 0.4%)." |
  Note the label instruction is **monitoring**, not stopping — which is exactly the kind of decision that belongs to the person who prescribed it.
  ## Eye and vision terms reported to FAERS for semaglutide
  Counts of distinct FAERS cases naming semaglutide as a suspect drug, matching an eye/vision term, out of 16,486 semaglutide cases in the loaded quarters:
  | Reaction term | Cases |
  |---|---|
  | Visual impairment | 413 |
  | Vision blurred | 260 |
  | Blindness | 48 |
  | Eye disorder | 36 |
  | Eye pain | 27 |
  | Eye irritation | 25 |
  | Dry eye | 23 |
  | Blindness unilateral | 22 |
  | Diabetic retinopathy | 13 |
  | Retinal detachment | 9 |
  | Retinopathy | 9 |
  | Visual acuity reduced | 9 |
  (Lower-count terms also returned, down to 3 cases: retinal artery occlusion, central serous chorioretinopathy, retinal oedema, intraocular pressure increased and others.)
  **How to read those numbers, and how not to.** These are counts of reports, not rates. There is no denominator — the number of people taking semaglutide is unknown — so none of this is a frequency, a risk, or a probability that any individual will experience blurred vision. Nobody verified these reports, and FAERS does not record which drug the reporter blamed for which event. A report existing is not evidence the drug caused the event. In particular, none of this tells you anything about the cause of *your* blurred vision.
  ## What to do
  Contact your prescriber or pharmacist promptly — a week of new blurred vision merits being looked at rather than waited out, and an eye examination may be part of that. If your vision worsens suddenly, you see flashes, floaters or a curtain across your vision, or you lose vision in part of an eye, treat that as urgent and seek care immediately.
  I'm glad to run more population-level queries if they're useful to you or your clinician — for example, the full disproportionality picture for semaglutide, or how ocular terms are reported across the GLP-1 class.
    2 turn(s) · 4429 in / 1916 out · cache read 5818 · cache write 0
```

