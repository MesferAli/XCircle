# NX-EAB: Executive Agentic Benchmark

## Kaggle "Measuring AGI: Cognitive Abilities" Hackathon Submission

**Author:** Mesfer AlOtaibi | XCircle Technology Company (xcircle.sa)
**Patent:** Saudi AI Context Middleware Platform (SA 1020259266)

## Tracks

### Social Cognition (Primary)
**File:** `nx_eab_social_cognition.py`

4 tasks testing culturally-embedded communication decoding:
- **S1** — Stakeholder Sentiment Decoding (4 Saudi business scenarios)
- **S2** — Organizational Power Structure Inference
- **S3** — Strategic Code-Switching in Bilingual Negotiation
- **S4** — Cultural Protocol Navigation

### Executive Functions (Secondary)
**File:** `nx_eab_executive_functions.py`

4 tasks testing dynamic decision-making under constraint changes:
- **E1** — Dynamic Budget Reallocation Under Constraint Shock
- **E2** — Regulatory Compliance Pivot (FATOORA+ Protocol)
- **E3** — Zero-Day Protocol Application (NX-VERIFY-7)
- **E4** — Personnel Crisis with Competing Constraints

## How to Submit

1. Go to https://www.kaggle.com/benchmarks/tasks/new
2. Copy the contents of the desired track file into the notebook
3. Run all cells

## Scoring

- **Deterministic:** `assert_contains_regex` for exact numerical answers (E3)
- **Judge-based:** `assess_response_with_judge` with detailed rubrics
- **Hybrid:** Both deterministic + judge for maximum rigor

## Thesis

Current LLMs fail at:
1. **Social Cognition:** Decoding high-context cultural communication (Saudi/MENA)
2. **Executive Functions:** Maintaining coherent plans when constraints change mid-execution
