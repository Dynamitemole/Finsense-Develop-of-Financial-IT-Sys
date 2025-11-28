# FinSense – Personal Finance Assistant (Prototype v4)

**Team:** Bai Zimo, Zhu Zhenyu  
**Goal:** A lightweight personal finance web app that loads bank CSVs locally, shows an interactive transaction view and dashboard, and provides rule-based **Insights** with persistence: subscription detection, anomaly flags, user dismiss/whitelist, and CSV export.
**Demo:** open `prototype/index.html` (double-click). Drag a CSV (or `prototype/sample.csv`). No backend. Works offline.

## Features (this stage)
- Transaction View: CSV drag-drop, search, sort, pagination, group-by (Category/Merchant) with collapsible sections, **date/amount range filters**, and **category multi-select**.
- Dashboard: total spend (base currency), #transactions, #unique merchants, top category.
- Charts: Category donut + Monthly bar (auto updates with filters and base currency).
- Insights (rule-based) with feedback memory: Subscriptions (weekly/monthly/yearly periodicity + ±10% amount stability; shows monthly cost & next due date) and Anomalies (P95/P99 high amount, new merchant, country switch; severity scoring). Users can **dismiss or whitelist merchants** (persisted in localStorage).
- Export: one-click **CSV export of the currently filtered view** (with baseAmount column).
- Multi-currency (HUF/EUR): adjustable EUR→HUF rate (default 395). No live FX to keep it reproducible offline.

## Folder structure
finsense/
├─ prototype/
│ ├─ index.html
│ └─ sample.csv
└─ docs/
   ├─ Evaluation.md
   ├─ eval.js
   └─ labeled_dataset.csv


## Run
1) Double-click `prototype/index.html`.  
2) Select or drag a CSV; try search / group-by / change base currency & EUR→HUF rate; open **Insights**.

## Data schema
`date, amount, currency, merchant, description, category, country`

## Evaluation
See `docs/Evaluation.md` for the labeled mini-dataset (220 rows), metrics (subscriptions P/R/F1; anomalies Precision@N), and detection latency notes. Run `node docs/eval.js` to reproduce.

## License
MIT (for coursework).
