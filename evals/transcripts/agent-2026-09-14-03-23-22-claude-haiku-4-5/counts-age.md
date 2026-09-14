# counts-age

**Q:** What are the top reported reactions for semaglutide in patients 65 and over?

**Tool calls:**
- query_adverse_events {"drug":"semaglutide","mode":"gap","age_bracket":"65+"}
- query_adverse_events {"drug":"semaglutide","mode":"counts","age_bracket":"65+"}

**Checks:** all passed

---

Based on FAERS reports in Q2 2026, the top reported reactions for semaglutide in patients aged 65 and over are:

| Reaction | Cases |
|----------|-------|
| Nausea | 563 |
| Vomiting | 354 |
| Constipation | 322 |
| Diarrhoea | 316 |
| Weight increased | 279 |
| Decreased appetite | 240 |
| Weight decreased | 189 |
| Dizziness | 171 |
| Abdominal pain upper | 151 |
| Drug ineffective | 149 |
| Fatigue | 142 |
| Weight loss poor | 142 |

These counts represent distinct FAERS cases naming semaglutide as a suspect drug in the 65+ age bracket. Note that "Drug ineffective" and "Weight loss poor" are efficacy complaints rather than adverse events—whether they belong in a safety review is your call. 

The gastrointestinal symptoms (nausea, vomiting, constipation, diarrhea) dominate the reports in this age group, along with weight-related terms and general symptoms of malaise.
