const fs = require('fs');
const { performance } = require('perf_hooks');

function parseCSV(text) {
  const rows = [];
  let i = 0, cur = [], field = '', inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; cur.push(field); field = ''; if (cur.length > 1 || cur[0] !== '') rows.push(cur); cur = []; }
      else field += c;
    }
    i++;
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows;
}
function toObjects(rows) {
  if (!rows || !rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 1 && row[0] === '') continue;
    const o = {};
    for (let c = 0; c < headers.length; c++) o[headers[c]] = row[c] !== undefined ? row[c] : '';
    out.push(o);
  }
  return out;
}
const merchantKey = (name) => (name || 'unknown').toString().trim().toLowerCase();
const parseDate = (d) => { const t = Date.parse(d); return Number.isNaN(t) ? null : new Date(t); };
const daysBetween = (a, b) => Math.abs((b - a) / 86400000);
const nearestPeriod = (days) => { if (Math.abs(days - 7) <= 1) return 7; if (Math.abs(days - 30) <= 3) return 30; if (Math.abs(days - 365) <= 15) return 365; return null; };
const stdMean = (xs) => { if (!xs.length) return [0, 0]; const mean = xs.reduce((s, x) => s + x, 0) / xs.length; const v = xs.reduce((s, x) => s + (x - mean) * (x - mean), 0) / xs.length; return [Math.sqrt(v), mean]; };
const monthify = (amount, period) => { if (period === 7) return amount * (30 / 7); if (period === 30) return amount; if (period === 365) return amount / 12; return amount; };
const percentile = (arr, p) => { if (!arr.length) return 0; const a = [...arr].sort((x, y) => x - y); const idx = Math.floor((p / 100) * (a.length - 1)); return a[idx]; };
function computeBaseAmount(row, base, rate) { if (base === 'HUF') { if (row.currency === 'HUF') return row.amount; if (row.currency === 'EUR') return row.amount * rate; } else if (base === 'EUR') { if (row.currency === 'EUR') return row.amount; if (row.currency === 'HUF') return row.amount / rate; } return row.amount; }
function detectSubscriptions(rows, base) {
  const byM = {};
  rows.forEach(r => {
    const d = parseDate(r.date);
    if (!d) return;
    const key = merchantKey(r.merchant || 'Unknown');
    if (!byM[key]) byM[key] = [];
    byM[key].push({ d, amt: r.baseAmount || 0, raw: r });
  });
  const out = [];
  for (const k in byM) {
    const arr = byM[k].sort((a, b) => a.d - b.d);
    if (arr.length < 3) continue;
    const gaps = [];
    for (let i = 1; i < arr.length; i++) gaps.push(daysBetween(arr[i - 1].d, arr[i].d));
    const nearest = gaps.map(nearestPeriod).filter(Boolean);
    if (!nearest.length) continue;
    const count = { 7: 0, 30: 0, 365: 0 };
    nearest.forEach(p => count[p]++);
    const period = [7, 30, 365].reduce((best, p) => count[p] > count[best] ? p : best, 7);
    if (count[period] < 2) continue;
    const amts = arr.map(x => x.amt);
    const [std, mean] = stdMean(amts);
    const stable = (mean > 0) ? (std / mean <= 0.10) : false;
    if (!stable) continue;
    const last = arr[arr.length - 1].d;
    const next = new Date(last);
    if (period === 7) next.setDate(next.getDate() + 7);
    if (period === 30) next.setDate(next.getDate() + 30);
    if (period === 365) next.setDate(next.getDate() + 365);
    const conf = Math.min(1, count[period] / 3) * Math.min(1, 1 - Math.min(1, std / (mean || 1)));
    out.push({ merchant: arr[0].raw.merchant || 'Unknown', period, avg: mean, last3: arr.slice(-3).map(x => x.d.toISOString().slice(0, 10)), next: next.toISOString().slice(0, 10), confidence: conf });
  }
  out.sort((a, b) => monthify(b.avg, b.period) - monthify(a.avg, a.period));
  return out.slice(0, 12);
}
function detectAnomalies(rows, base) {
  const positives = rows.map(r => r.baseAmount || 0).filter(v => v > 0);
  const p95 = percentile(positives, 95);
  const p99 = percentile(positives, 99);
  const freq = {};
  rows.forEach(r => { const key = merchantKey(r.merchant || 'Unknown'); freq[key] = (freq[key] || 0) + 1; });
  const mc = {};
  rows.forEach(r => { const key = merchantKey(r.merchant || 'Unknown'); mc[key] = mc[key] || new Set(); if (r.country) mc[key].add(r.country); });
  const out = [];
  rows.forEach(r => {
    const reasons = [];
    const v = r.baseAmount || 0;
    if (v >= p99) reasons.push('very_high_amount@P99');
    else if (v >= p95) reasons.push('high_amount@P95');
    const mk = merchantKey(r.merchant || 'Unknown');
    if (freq[mk] === 1) reasons.push('new_merchant');
    if (mc[mk] && mc[mk].size >= 2) reasons.push('country_switch');
    if (reasons.length) {
      const severity = (reasons.includes('very_high_amount@P99')) ? 'high' : (reasons.includes('high_amount@P95') ? 'med' : 'low');
      out.push({ date: r.date, merchant: r.merchant || 'Unknown', category: r.category || '—', baseAmount: v, reasons: reasons.join(', '), severity });
    }
  });
  out.sort((a, b) => b.baseAmount - a.baseAmount);
  return out.slice(0, 30);
}

const csvText = fs.readFileSync(__dirname + '/labeled_dataset.csv', 'utf-8');
const objs = toObjects(parseCSV(csvText));
const base = 'HUF', rate = 395;
const rows = objs.map(o => ({
  date: o.date,
  amount: parseFloat(o.amount),
  currency: (o.currency || '').trim(),
  merchant: o.merchant,
  description: o.description,
  category: o.category,
  country: o.country,
  label_subscription: Number(o.label_subscription || 0),
  label_anomaly: Number(o.label_anomaly || 0),
  label_reason: o.label_reason,
}));
rows.forEach(r => r.baseAmount = computeBaseAmount(r, base, rate));

const labelSubs = new Set(rows.filter(r => r.label_subscription === 1).map(r => merchantKey(r.merchant)));
const labelAnoms = new Set(rows.filter(r => r.label_anomaly === 1).map(r => `${r.date}|${merchantKey(r.merchant)}`));
const t1 = performance.now();
const subs = detectSubscriptions(rows, base);
const anoms = detectAnomalies(rows, base);
const t2 = performance.now();
const subsDetected = new Set(subs.map(s => merchantKey(s.merchant)));
const subsTP = [...subsDetected].filter(m => labelSubs.has(m)).length;
const subsPrecision = subsDetected.size ? subsTP / subsDetected.size : 0;
const subsRecall = labelSubs.size ? subsTP / labelSubs.size : 0;
const subsF1 = (subsPrecision + subsRecall) > 0 ? (2 * subsPrecision * subsRecall / (subsPrecision + subsRecall)) : 0;
function precisionAtN(arr, n) {
  const top = arr.slice(0, n);
  if (!top.length) return 0;
  const tp = top.filter(a => labelAnoms.has(`${a.date}|${merchantKey(a.merchant)}`)).length;
  return tp / top.length;
}
const metrics = {
  rows: rows.length,
  subs: { precision: subsPrecision, recall: subsRecall, f1: subsF1, detected: subsDetected.size, truth: labelSubs.size },
  anoms: { p10: precisionAtN(anoms, 10), p20: precisionAtN(anoms, 20), p50: precisionAtN(anoms, 50), detected: anoms.length, truth: labelAnoms.size },
  latency_ms: t2 - t1
};
console.log(JSON.stringify(metrics, null, 2));
