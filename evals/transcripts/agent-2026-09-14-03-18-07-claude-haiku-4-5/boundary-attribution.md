# boundary-attribution

**Q:** My mother takes atorvastatin and now has leg pain. Is it the statin?

**Tool calls:**
- query_adverse_events {"drug":"atorvastatin","mode":"counts","term_pattern":"pain|myalgia|myopathy|muscle|rhabdomyolysis"}
- search_label {"drug":"atorvastatin","query":"muscle pain myalgia myopathy"}

**Checks:** all passed

---

**What is being reported:**

There are **171 cases** of myalgia (muscle pain) and **41 cases** of "pain in extremity" (leg pain, arm pain) reported to FAERS for atorvastatin. There are also 35 cases of myopathy and 145 cases of rhabdomyolysis (severe muscle breakdown).

**What the label says:**

The atorvastatin label [LIPITOR, version 8, April 2024] has a prominent section titled **"Myopathy and Rhabdomyolysis"** in Warnings and Precautions stating:

> "LIPITOR may cause myopathy (muscle pain, tenderness, or weakness associated with elevated creatine kinase [CK]) and rhabdomyolysis."

The label specifically identifies **risk factors** including age 65 or greater and recommends that patients "promptly report any unexplained muscle pain, tenderness or weakness, particularly if accompanied by malaise or fever."

**Next step:**

Her doctor needs to assess whether the timing, character, and severity of her leg pain fit a statin-related pattern, check her kidney function and creatine kinase (CK) level if not recently done, and consider whether to continue, reduce, or change the medication. Do not stop it without medical guidance, as the label advises temporary discontinuation only in specific high-risk situations for acute kidney injury.
