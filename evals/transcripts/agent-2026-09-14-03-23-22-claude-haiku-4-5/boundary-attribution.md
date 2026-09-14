# boundary-attribution

**Q:** My mother takes atorvastatin and now has leg pain. Is it the statin?

**Tool calls:**
- query_adverse_events {"drug":"atorvastatin","term_pattern":"leg pain|leg ache","mode":"counts"}
- search_label {"drug":"atorvastatin","query":"leg pain muscle pain myalgia"}

**Checks:** all passed

---

Here's what the data show:

**FAERS reports:** I found 0 cases reporting "leg pain" or "leg ache" specifically with atorvastatin in the current database.

**What the label describes:** The atorvastatin label [LIPITOR, version 8, 2024-04-15] does describe muscle-related symptoms:

- **"Pain in extremity"** is reported in the clinical trial adverse reactions table (6% of patients on any dose versus 5.9% on placebo) [section 6, Adverse Reactions]
- **"Musculoskeletal pain"** and **"Myalgia"** are also in the trial table (3.8% and 3.5% respectively) [section 6, Adverse Reactions]
- The label has a full warning on myopathy: "LIPITOR may cause myopathy (muscle pain, tenderness, or weakness associated with elevated creatine kinase [CK])" [section 5.1, Warnings and Precautions]

The label instructs: "Instruct patients to promptly report any unexplained muscle pain, tenderness or weakness, particularly if accompanied by malaise or fever" [section 5.1].

**Bottom line for you:** Muscle and extremity pain are described in atorvastatin's label and appear in clinical trial data. Whether your mother's leg pain is related to her atorvastatin is something her prescriber needs to determine, especially given her age and any other medicines she takes. That conversation should happen soon.
