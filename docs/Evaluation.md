# Evaluation Template

## 1. Datasets
- Rows and split (e.g., 2,000 total; train/dev/test = 60/20/20)
- Label definitions for subscriptions / anomalies

## 2. Metrics & Results
### 2.1 Subscriptions
- Precision:
- Recall:
- F1:
- Notes: periodicity tolerance (7±1 / 30±3 / 365±15), amount stability ±10%

### 2.2 Anomalies
- Precision@N (N = 10 / 20 / 50):
- Breakdown by reason: high_amount / new_merchant / country_switch
- Thresholds: P95/P99; night time 00:00–05:00 (if used)

### 2.3 Performance
- UI latency 1k rows: 
- UI latency 5k rows: 

## 3. Known limitations & next steps
- Merchant normalization, irregular recurring payments, multi-currency per-row FX, etc.
