# class-rhabdo

**Q:** Is the rhabdomyolysis signal for rosuvastatin different from the other statins?

**Tool calls:**
- query_adverse_events {"drug":"rosuvastatin","mode":"counts","term_pattern":"rhabdomyolysis|myopathy"}
- query_adverse_events {"drug_class":"statin","mode":"counts","term_pattern":"rhabdomyolysis|myopathy"}
- query_adverse_events {"drug":"rosuvastatin","mode":"gap","top":60}
- query_adverse_events {"drug":"atorvastatin","mode":"gap","top":60}
- query_adverse_events {"drug":"simvastatin","mode":"gap","top":60}
- query_adverse_events {"drug":"pravastatin","mode":"gap","top":60}

**Checks:** all passed

---

## Rhabdomyolysis Reporting for Rosuvastatin vs. Other Statins

The rhabdomyolysis signal for rosuvastatin is **not markedly different** from other major statins, but rosuvastatin shows a slightly lower reporting disproportionality than atorvastatin.

### Counts (distinct FAERS cases):

- **Rosuvastatin**: 112 rhabdomyolysis cases
- **All statins combined**: 289 rhabdomyolysis cases
- **Atorvastatin**: 145 rhabdomyolysis cases
- **Simvastatin**: Data not provided in top terms (below minimum case threshold)
- **Pravastatin**: Data not provided in top terms (below minimum case threshold)

### Disproportionality (Reporting Odds Ratio with 95% CI):

| Drug | ROR025 | ROR | Interpretation |
|------|--------|-----|---|
| **Rosuvastatin** | 53.58 | 66.05 | Reported disproportionately versus all other suspect drugs |
| **Atorvastatin** | 46.06 | 55.55 | Reported disproportionately versus all other suspect drugs |

The 95% confidence intervals overlap substantially (53.58–81.44 for rosuvastatin; 46.06–66.99 for atorvastatin), indicating the reporting signals are statistically compatible. Atorvastatin has numerically more cases but a slightly lower ROR.

### Label Status:

Both rosuvastatin and atorvastatin have rhabdomyolysis clearly **described in their labels**:

- **[CRESTOR label, Adverse Reactions section]**: "Myopathy and Rhabdomyolysis [see Warnings and Precautions (5.1)]"
- **[LIPITOR label, Adverse Reactions section]**: "• Myopathy and Rhabdomyolysis [see Warnings and Precautions (5.1)]"

**Bottom line**: The rhabdomyolysis reporting for rosuvastatin is consistent with that of atorvastatin—both show strong disproportionate reporting, both have it in their labels. There is no evidence in these FAERS data of a distinctly different rhabdomyolysis signal for rosuvastatin compared to other major statins.
