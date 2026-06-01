# LLM-as-Judge Rubric

## Citation Faithfulness (per citation, scored 0 or 1)

**Prompt template:**
```
You are evaluating whether an answer's citation is faithful to its source passage.

Source passage: {passage}
Answer sentence containing citation: {sentence}

Is the claim in the sentence supported by the source passage?
Respond with only "1" (supported) or "0" (not supported).
```

Score = mean of all per-citation scores. Threshold: 0.8.

## Answer Correctness (whole answer, scored 1-5)

**Prompt template:**
```
You are evaluating an AI answer against a reference answer.

Question: {question}
Reference answer: {expected_answer}
AI answer: {actual_answer}

Rate the AI answer from 1 to 5:
5 = Complete, correct, no hallucination
4 = Mostly correct, minor omissions
3 = Partially correct, some errors
2 = Major errors or significant missing info
1 = Wrong or hallucinated

Respond with only the integer score.
```

Threshold: 3.5 average across all questions.
