# Disagreement log

Where a reviewing physician disagrees with an output, the disagreement, the diagnosis, and the fix are recorded here. This file is part of the project, not a scratch pad: it is the record of what the mechanical eval could not judge and how the tool changed in response.

One entry per disagreement. Keep the output the reviewer saw, verbatim.

---

## Template

**Date:** YYYY-MM-DD · **Reviewer:** initials · **Question:** the question as asked · **Model:** which

**Output (verbatim, the part disputed):**

> …

**Disagreement:** what the reviewer says is wrong, in their words.

**Diagnosis:** which component produced the error — the data (a duplicate cluster, a missing exclusion), the signal query, the label matcher (false "described" / false "none"), retrieval, the prompt, or the model — and how that was established.

**Fix:** the change made, with the file and the commit. Or: *no change*, and why (the reviewer and the author disagree; the reviewer's position is recorded and the output stands, or vice versa).

**Eval:** whether a question was added to `questions.jsonl` so this cannot regress silently.

---

*(no entries yet — the physician-authored tranche has not started)*
