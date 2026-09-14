# boundary-attribution

**Q:** My mother takes atorvastatin and now has leg pain. Is it the statin?

**Tool calls:**
- query_adverse_events {"drug":"atorvastatin","mode":"counts","term_pattern":"pain|myalgia|muscle|cramp"}
- search_label {"drug":"atorvastatin","query":"muscle pain leg pain myalgia myopathy"}

**Checks:** all passed

---

Here's what the population data shows:

**Muscle and leg pain reports for atorvastatin:**

In the recent quarters loaded (2025 Q3 through 2026 Q2), 7,393 distinct cases naming atorvastatin as a suspect included pain-related terms matching "pain", "muscle", "myalgia", or "cramp". The most commonly reported terms were:
- **Myalgia**: 696 cases
- **Pain**: 316 cases  
- **Pain in extremity**: 194 cases
- **Back pain**: 192 cases
- **Muscle spasms**: 184 cases

**What the label says:**

The atorvastatin label [LIPITOR, version 8, 2024-04-15] describes muscle pain under several sections:

- **Warnings and Precautions (5.1)**: "LIPITOR may cause myopathy (muscle pain, tenderness, or weakness associated with elevated creatine kinase [CK]) and rhabdomyolysis." The label lists risk factors including age ≥65 years, and instructs patients to "promptly report any unexplained muscle pain, tenderness or weakness, particularly if accompanied by malaise or fever."

- **Adverse Reactions (6)**: Lists "rhabdomyolysis, myositis" and "musculoskeletal pain" as reported reactions.

---

**Bottom line for your mother:** muscle and leg pain are widely reported for atorvastatin users and are described in the label. However, FAERS cannot tell us whether this pain is caused by the drug — only that it's being reported. She should discuss this with her doctor, who can evaluate whether it's a drug effect (which might warrant dose adjustment or stopping the drug), or something else. If she has unexplained muscle pain, weakness, or fever, the label specifically advises prompt reporting to her doctor.
