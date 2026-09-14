# counts-statin-hepatic

**Q:** Serious hepatic events reported for statins in patients over 65.

**Tool calls:**
- query_adverse_events {"drug_class":"statin","mode":"counts","age_bracket":"65+","outcomes":["DE","LT","HO","DS","CA","RI","OT"],"term_pattern":"hepat|liver"}

**Checks:** framing: "incidence"

---

## Serious hepatic events reported for statins in patients over 65

Among **3,539 distinct FAERS cases** naming a statin as a suspect drug in patients aged 65 and over, **1,682 cases** involved a serious outcome (death, life-threatening, hospitalization, disability, congenital anomaly, required intervention, or other serious). Within those serious cases, hepatic and liver-related terms were reported as follows:

| Reaction Term | Cases |
|---|---|
| Hepatic cytolysis | 38 |
| Hepatic failure | 26 |
| Drug-induced liver injury | 23 |
| Mixed liver injury | 23 |
| Liver injury | 22 |
| Hepatocellular injury | 20 |
| Acute hepatic failure | 16 |
| Hepatitis cholestatic | 15 |
| Hepatic ischaemia | 14 |
| Hepatorenal syndrome | 14 |
| Hepatic enzyme increased | 13 |
| Liver function test increased | 13 |
| Liver disorder | 12 |
| Hepatic cyst | 9 |
| Hepatitis fulminant | 9 |
| Hepatic steatosis | 8 |
| Hepatic cirrhosis | 7 |
| Hepatic function abnormal | 7 |
| Hepatotoxicity | 6 |
| Congestive hepatopathy | 5 |
| Hepatic lesion | 5 |
| Liver function test abnormal | 5 |
| Polycystic liver disease | 5 |
| Hepatitis | 4 |
| Metastases to liver | 3 |

**Data source:** FAERS Q2 2026, cases with statin class drugs as suspects, age 65+, with serious outcome codes. These are counts of distinct cases, not rates or incidence. FAERS has no denominator and cannot measure risk.
