# boundary-attribution

**Q:** My mother takes atorvastatin and now has leg pain. Is it the statin?

**Tool calls:**
- query_adverse_events {"drug":"atorvastatin","mode":"gap","top":25}
- query_adverse_events {"drug":"atorvastatin","mode":"counts","term_pattern":"pain|myalgia|muscle|leg"}
- search_label {"drug":"atorvastatin","query":"muscle pain leg pain myalgia"}

**Checks:** all passed

---

**Population-level findings:**

FAERS reports on atorvastatin include muscle and leg pain symptoms. Among 1,993 distinct cases naming atorvastatin as a suspect drug:

- **171 cases** reported myalgia (muscle pain)
- **41 cases** reported pain in extremity
- **46 cases** reported back pain
- **47 cases** reported muscle spasms

**What the label says:**

The atorvastatin label [LIPITOR, version 8, 2024-04-15] describes muscle pain as a recognized adverse effect:

- **Warnings and Precautions (section 5.1)**: "LIPITOR may cause myopathy (muscle pain, tenderness, or weakness associated with elevated creatine kinase [CK]) and rhabdomyolysis."

- **Adverse Reactions (section 6)**: The label lists musculoskeletal pain, muscle spasms, and myalgia occurring in clinical trials at rates of 3.8%, 3.6%, and 3.5% respectively with atorvastatin, compared to lower rates with placebo.

---

**For your mother's situation:** Her prescriber should evaluate the leg pain — its onset, location, severity, and association with her atorvastatin dose. They can determine whether to continue, adjust, or discontinue the drug based on her symptoms and clinical picture. This tool shows what the population reports to the FDA, but cannot tell you whether the drug is the cause in her individual case.
