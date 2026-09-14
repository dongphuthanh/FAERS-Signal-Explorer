# class-rhabdo

**Q:** Is the rhabdomyolysis signal for rosuvastatin different from the other statins?

**Tool calls:**
- query_adverse_events {"drug":"rosuvastatin","mode":"counts","term_pattern":"rhabdomyolysis"}
- query_adverse_events {"drug_class":"statin","mode":"counts","term_pattern":"rhabdomyolysis"}

**Checks:** min_tool_calls: 2 < 3; distinct_drugs: ROSUVASTATIN; missing: /overlap|cannot say|not distinguishable|interval|confidence/

---

**Rosuvastatin's rhabdomyolysis reports are proportionally higher than the statin class overall.**

Rosuvastatin accounts for 112 of the 289 rhabdomyolysis cases reported across all statins (39% of the statin class total), despite rosuvastatin comprising 1,251 of 3,539 total suspect statin cases (35% of the class). 

This suggests rosuvastatin is reported with rhabdomyolysis somewhat more often than you would expect by chance, but the difference is modest. A formal comparison would require a reporting odds ratio (ROR) for rosuvastatin's rhabdomyolysis signal versus other statins as the comparator.

To understand whether this reflects a real signal difference or reporting variation, the disproportionality analysis would typically stratify by dose, concurrent interacting drugs (especially fibrates and some antiretrovirals), renal function, and muscle symptoms at baseline — factors the FAERS system does not capture.

Would you like me to look at:
- How rhabdomyolysis reports for rosuvastatin compare to a specific other statin (e.g. atorvastatin)?
- What the labels say about rhabdomyolysis for rosuvastatin and other statins?
- Age or serious-outcome patterns in these reports?
