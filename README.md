# FinSense – Personal Finance Assistant (Prototype v3)

**Team:** Bai Zimo, Zhu Zhenyu  
**Goal:** A lightweight personal finance web app that loads bank CSVs locally, shows an interactive transaction view and dashboard, and provides rule-based **Insights**: subscription detection and anomaly flags.  
**Demo:** open `prototype/index.html` (double-click). Drag a CSV (or `prototype/sample.csv`). No backend. Works offline.

## Features (this stage)
- Transaction View: CSV drag-drop, search, sort, pagination, group-by (Category/Merchant) with collapsible sections.
- Dashboard: total spend (base currency), #transactions, #unique merchants, top category.
- Charts: Category donut + Monthly bar (auto updates with filters and base currency).
- Insights (rule-based): Subscriptions (weekly/monthly/yearly periodicity + ±10% amount stability; shows monthly cost & next due date) and Anomalies (P95/P99 high amount, new merchant, country switch; severity scoring).
- Multi-currency (HUF/EUR): adjustable EUR→HUF rate (default 395). No live FX to keep it reproducible offline.

## Folder structure
finsense/
├─ prototype/
│ ├─ index.html
│ └─ sample.csv
└─ docs/
└─ Evaluation.md


## Run
1) Double-click `prototype/index.html`.  
2) Select or drag a CSV; try search / group-by / change base currency & EUR→HUF rate; open **Insights**.

## Data schema
`date, amount, currency, merchant, description, category, country`

## Evaluation (next step)
See `docs/Evaluation.md` (Precision/Recall/F1 for subscriptions; Precision@N for anomalies; latency on 1k–5k rows).

## License
MIT (for coursework).
