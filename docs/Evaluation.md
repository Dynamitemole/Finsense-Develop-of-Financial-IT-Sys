# Evaluation

## 1. Datasets
- **docs/labeled_dataset.csv** — 220 synthetic transactions (2023-01→2023-08) with columns `date, amount, currency, merchant, description, category, country, label_subscription, label_anomaly, label_reason`.
- Ground truth:
  - Subscriptions (6 merchants): Netflix, Spotify, GymPass, CloudBackup, WeeklyGrocer, AnnualMagazine.
  - Anomalies (7 rows): LaptopWorld, LastMinuteTravel, OneTimeRoof, NewCountryCafe, FestivalTickets, and two CafeBreeze country-switch events.

## 2. Metrics & Results (via `node docs/eval.js`, base=HUF, EUR→HUF=395)
### 2.1 Subscriptions
- Precision: **1.00**
- Recall: **0.83**
- F1: **0.91**
- Notes: periodicity tolerance (7±1 / 30±3 / 365±15), amount stability ±10%; top-12 monthly-normalized cost ordering.

### 2.2 Anomalies
- Precision@10: **0.40**
- Precision@20: **0.20**
- Precision@50: **0.13**
- Reasons surfaced: high_amount (P95/P99), new_merchant, country_switch.

### 2.3 Performance
- Detection latency (subscriptions + anomalies): ~10 ms for 220 rows; **~12 ms @1.1k rows** and **~58 ms @5.5k rows** in Node (single-threaded).【9d0c76†L1-L4】
- UI remains client-side/offline; table pagination and charts reuse the same filtered array to stay responsive.

## 3. Known limitations & next steps
- Merchant/name normalization still naive; irregular but recurring payments may be missed.
- Multi-currency per-row FX assumptions are static; no weekend/market spread handling.
- Future: expand labeled set with real exports, add ROC-style sweeps for anomaly thresholds, and log user feedback (dismiss/whitelist) events for offline audit.
