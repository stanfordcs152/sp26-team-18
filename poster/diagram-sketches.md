# Rough Sketches for Poster Diagrams

Here are rough sketches for the diagrams for the technical back-end portion of the poster.

---

## 1. Classification Layer

```
                              +---------------------+
                              |     AWS Rekognition  |
                              | (Vision/ML Layer)    |
                              | - Detects politician |
                              |   faces              |
                              +----------+----------+
                                         |
                    +--------------------+--------------------+
                    |                                         |
          +---------v----------+                  +-----------v---------+
          |      OpenAI        |                  |  Threshold Decider  |
          | (LLM for detection |                  | Threshold = 0.70    |
          | + AI generation    |                  | based on Recall/FP  |
          | score)             |                  | rate tradeoff       |
          +--------------------+                  +-----------+---------+
                                                              |
                                          +-------------------+------------------+
                                          |                                      |
                                 +--------v--------+                   +---------v-------+
                                 |   Score >= 0.70  |                   |   Score < 0.70  |
                                 |   "Likely AI"    |                   | "Likely Not AI" |
                                 +--------+--------+                   +---------+-------+
                                          |                                      |
                                 +--------v--------+                   +---------v-------+
                                 | Moderator Queue |                   | Successfully    |
                                 | (Quarantine)    |                   | Post            |
                                 +-----------------+                   +-----------------+
```

**Notes:**
- Threshold 0.70 keeps recall ≥ 0.85 (catches most deepfakes) while holding false-positive rate ≤ 0.05
- Rekognition handles "who is this"; OpenAI handles "is this real"
- Combined hybrid score routes to queue or public post

---

## 2. Moderator Queue / Moderator UI

```
  Flagged Post
      |
      v
+---------------------+
|   Moderator Queue   |
|  Priority Ranking:  |
|  [ CRITICAL ]       |  <-- AI classification label
|  [ HIGH     ]       |
|  [ MEDIUM   ]       |
+----------+----------+
           |
           v
+----------+----------+
|    Moderator UI     |
|                     |
|  Displays:          |
|  - Image            |
|  - AI Score         |  <-- combined AI-certainty score
|  - User History     |  <-- count of prior takedowns
|  - Self Tags        |  <-- user-provided labels
|                     |
|  Actions:           |
|  1) Approve to      |
|     Public          |
|  2) Take Down Post  |
+----------+----------+
           |
    +------+------+
    |             |
    v             v
TAKE DOWN     APPROVE TO
  POST          PUBLIC
    |             |
    v             v
- Account     - Image removed
  marked        from quarantine
- Image sent  - Visible to all
  to cache       (if public)
- Image       - Image removed
  removed        from mod queue
  from acct
- Image sent
  to cache
```

**Notes:**
- Posts are ranked critical/high/medium and pushed into queue in that order
- Moderator decisions feed back into routing (reviewed images are cached so duplicates skip re-classification)

---

## 3. Example 1 — Adversarial Case (Feedback Loop / Caching)

```
  Adversary uploads many images predicted to be classified as "critical"
  → Moderator gets flooded, is rushed reviewing them
  → Cache prevents re-classifying the same image twice

  Iteration 1                          Iteration 2
  ----------------------------         ----------------------------

  +--------------------------+         +--------------------------+
  | "Uploaded new Political  |         | "Uploaded same Political |
  |   AI Image"              |         |   AI Image again"        |
  +-----------+--------------+         +-----------+--------------+
              |                                    |
              v                                    v
  +-----------+--------------+         +-----------+--------------+
  | Check cache: image has   |         | Check cache: image HAS   |
  | NOT been classified      |         | been classified before   |  <-- CACHE HIT
  | before                   |         | (highlighted step)       |
  +-----------+--------------+         +-----------+--------------+
              |                                    |
              v                                    v
  +-----------+--------------+         +-----------+--------------+
  | Post sits in quarantine; |         | Image added to cache;    |
  | image waits in mod queue |         | moderator decides post   |
  +-----------+--------------+         | violates AI policy       |
              |                        +--------------------------+
              v
  +-----------+--------------+
  | Moderator decides post   |
  | violates AI policy       |
  +-----------+--------------+
              |
              v
  +-----------+--------------+
  | Image added to cache     |
  +--------------------------+
```

**Notes:**
- On re-upload of the same image, the cache check short-circuits classification and moderator review
- This directly counters the adversarial flooding strategy
- Cached decisions make moderator responses much faster on repeat uploads
