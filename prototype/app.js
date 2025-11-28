/* CSV parse + to objects */
function parseCSV(text){const rows=[];let i=0,cur=[],field='',inQ=false;while(i<text.length){const c=text[i];if(inQ){if(c=='"'){if(text[i+1]=='"'){field+='"';i++;}else inQ=false;}else field+=c;}else{if(c=='"')inQ=true;else if(c==','){cur.push(field);field='';}else if(c=='\n'||c=='\r'){if(c=='\r'&&text[i+1]=='\n')i++;cur.push(field);field='';if(cur.length>1||cur[0]!=='')rows.push(cur);cur=[];}else field+=c;}i++;}if(field.length>0||cur.length>0){cur.push(field);rows.push(cur);}return rows;}
function toObjects(rows){if(!rows||!rows.length)return[];const headers=rows[0].map(h=>h.trim());const out=[];for(let r=1;r<rows.length;r++){const row=rows[r];if(row.length===1&&row[0]==='')continue;const o={};for(let c=0;c<headers.length;c++){o[headers[c]]=row[c]!==undefined?row[c]:'';}out.push(o);}return out;}

/* State */
const state={raw:[],rows:[],sortKey:'date',sortDir:'desc',page:1,pageSize:50,groupBy:'',baseCurrency:'HUF',eurHufRate:395,search:'',dateFrom:'',dateTo:'',amountMin:null,amountMax:null,categories:[]};
const prefs={dismissedSubs:new Set(),dismissedAnoms:new Set(),whitelist:new Set()};

/* Helpers */
function normalizeRow(r){const m={};for(const k in r)m[k.toLowerCase()]=r[k];const date=(m['date']||m['txn_date']||m['post_date']||'').trim();const amount=parseFloat((m['amount']||m['amt']||m['value']||'0').toString().replace(',','.'))||0;const currency=(m['currency']||m['curr']||m['ccy']||'').toUpperCase()||'HUF';const merchant=m['merchant']||m['payee']||m['counterparty']||m['description']||'Unknown';const description=m['description']||m['narrative']||merchant||'';const category=m['category']||m['cat']||'Uncategorized';const country=m['country']||m['location_country']||m['country_code']||'';return{date,amount,currency,merchant,description,category,country};}
function computeBaseAmount(row,base,rate){if(base==='HUF'){if(row.currency==='HUF')return row.amount;if(row.currency==='EUR')return row.amount*rate;}else if(base==='EUR'){if(row.currency==='EUR')return row.amount;if(row.currency==='HUF')return row.amount/rate;}return row.amount;}
function fmtAmt(x,curr){const v=Number(x||0);return(curr==='HUF')?Math.round(v).toLocaleString():v.toFixed(2);}
function merchantKey(name){return (name||'unknown').toString().trim().toLowerCase();}
function slug(s){
  try {
    return (s||'').toString()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/(^-|-$)/g,'');
  } catch(e){
    return (s||'').toString().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  }
}

function summarize(rows,base){const total=rows.reduce((s,r)=>s+(r.baseAmount||0),0);const tx=rows.length;const merchants=new Set(rows.map(r=>r.merchant)).size;const catSum={};rows.forEach(r=>{catSum[r.category]=(catSum[r.category]||0)+(r.baseAmount||0);});const topCat=Object.entries(catSum).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';return{total,tx,merchants,topCat};}

function loadPrefs(){try{const raw=JSON.parse(localStorage.getItem('finsense_prefs')||'{}');['dismissedSubs','dismissedAnoms','whitelist'].forEach(k=>{if(raw&&Array.isArray(raw[k]))prefs[k]=new Set(raw[k]);});}catch(e){console.warn('pref load',e);} }
function savePrefs(){try{localStorage.setItem('finsense_prefs',JSON.stringify({dismissedSubs:[...prefs.dismissedSubs],dismissedAnoms:[...prefs.dismissedAnoms],whitelist:[...prefs.whitelist]}));}catch(e){console.warn('pref save',e);} }

function getFilteredRows(){const{rows,search,dateFrom,dateTo,amountMin,amountMax,categories}=state;const q=search.trim().toLowerCase();return rows.filter(r=>{if(q){const t=`${r.merchant} ${r.category} ${r.description}`.toLowerCase();if(t.indexOf(q)===-1)return false;}const d=parseDate(r.date);if(dateFrom){const from=new Date(dateFrom);if(!d||d<from)return false;}if(dateTo){const to=new Date(dateTo);if(!d||d>to)return false;}const val=r.baseAmount||0;if(amountMin!==null&&amountMin!==''&&val<amountMin)return false;if(amountMax!==null&&amountMax!==''&&val>amountMax)return false;if(categories&&categories.length){if(!categories.includes(r.category))return false;}return true;});}

function updateCategoryOptions(){const sel=document.getElementById('categoryFilter');if(!sel)return;const cats=[...new Set(state.rows.map(r=>r.category||'Uncategorized'))].sort();sel.innerHTML=cats.map(c=>`<option value="${c}">${c}</option>`).join('');state.categories=state.categories.filter(c=>cats.includes(c));[...sel.options].forEach(o=>{o.selected=state.categories.includes(o.value);});}
function csvEscape(v){const s=String(v??'');if(s.includes(',')||s.includes('"')||s.includes('\n'))return '"'+s.replace(/"/g,'""')+'"';return s;}
function exportFilteredCSV(){const rows=sortRows([...getFilteredRows()]);if(!rows.length){alert('No rows to export');return;}const headers=['date','amount','currency','merchant','description','category','country','baseAmount'];const lines=[headers.join(',')];rows.forEach(r=>{const vals=[r.date||'',r.amount??'',r.currency||'',r.merchant||'',r.description||'',r.category||'',r.country||'',(r.baseAmount??'').toFixed? (r.baseAmount||0).toFixed(2):(r.baseAmount||0)];lines.push(vals.map(csvEscape).join(','));});const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='finsense_filtered.csv';a.click();URL.revokeObjectURL(url);}

function sortRows(arr){const dir=state.sortDir==='asc'?1:-1;const k=state.sortKey;return arr.sort((a,b)=>{if(k==='amount'||k==='baseAmount')return dir*((a[k]||0)-(b[k]||0));return dir*String(a[k]||'').localeCompare(String(b[k]||''));});}
function anomalyKey(a){return `${merchantKey(a.merchant)}|${a.date||''}|${Math.round((a.baseAmount||0)*100)/100}`;}
function dismissSub(m){prefs.dismissedSubs.add(m);savePrefs();render();}
function dismissAnom(key){prefs.dismissedAnoms.add(key);savePrefs();render();}
function whitelistMerchant(m){prefs.whitelist.add(m);savePrefs();render();}
function resetFeedback(){prefs.dismissedSubs.clear();prefs.dismissedAnoms.clear();prefs.whitelist.clear();savePrefs();render();}
function renderFeedbackBadges(){document.getElementById('whitelistCount').innerText=prefs.whitelist.size;document.getElementById('dismissedSubsCount').innerText=prefs.dismissedSubs.size;document.getElementById('dismissedAnomsCount').innerText=prefs.dismissedAnoms.size;}

/* Rendering */
function render(){
  const tableBody=document.getElementById('tableBody');const pager=document.getElementById('pager');const{page,pageSize,rows,groupBy,baseCurrency}=state;
  let filtered=getFilteredRows();
  state.lastFiltered=filtered;
  const sorted=sortRows([...filtered]);
  const {total,tx,merchants,topCat}=summarize(filtered,baseCurrency);
  document.getElementById('mTotal').innerText=`${fmtAmt(total,baseCurrency)} ${baseCurrency}`;
  document.getElementById('mCount').innerText=tx.toLocaleString();
  document.getElementById('mMerchants').innerText=merchants.toLocaleString();
  document.getElementById('mTopCat').innerText=topCat;

  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));state.page=Math.min(state.page,totalPages);
  const start=(state.page-1)*pageSize;const end=start+pageSize;
  tableBody.innerHTML='';let sliced=sorted.slice(start,end);
  if(!groupBy){sliced.forEach(r=>tableBody.appendChild(rowTr(r,baseCurrency)));}else{
    const groups={};sliced.forEach(r=>{const key=r[groupBy]||'—';if(!groups[key])groups[key]=[];groups[key].push(r);});
    Object.keys(groups).sort().forEach(key=>{
      const items=groups[key];const gid='g_'+slug(key);const head=document.createElement('tr');head.className='group-header';
      const sum=items.reduce((s,x)=>s+(x.baseAmount||0),0);
      head.innerHTML=`<td colspan="8"><button class="btn" onclick="toggleGroup('${gid}')">Toggle</button>
        <span style="margin-left:8px;">${groupBy}: <strong>${key}</strong></span>
        <span class="muted" style="margin-left:12px">(${items.length} tx)</span>
        <span class="badge" style="margin-left:12px">Sum: ${fmtAmt(sum,baseCurrency)} ${baseCurrency}</span></td>`;
      tableBody.appendChild(head);
      items.forEach(r=>{const tr=rowTr(r,baseCurrency);tr.dataset.group=gid;tableBody.appendChild(tr);});
    });
  }
  pager.innerHTML='';const prev=document.createElement('button');prev.className='pagebtn';prev.innerText='Prev';prev.disabled=state.page<=1;prev.onclick=()=>{state.page=Math.max(1,state.page-1);render();};
  const next=document.createElement('button');next.className='pagebtn';next.innerText='Next';next.disabled=state.page>=totalPages;next.onclick=()=>{state.page=Math.min(totalPages,state.page+1);render();};
  const info=document.createElement('span');info.className='muted';info.innerText=` Page ${state.page} / ${totalPages} — ${filtered.length} rows `;
  pager.appendChild(prev);pager.appendChild(info);pager.appendChild(next);

  renderCharts(filtered,baseCurrency);
  renderInsights(filtered,baseCurrency);
}
function toggleGroup(id){document.querySelectorAll(`tr[data-group="${id}"]`).forEach(r=>{r.style.display=(r.style.display==='none')?'':'none';});}
function rowTr(r,baseCurrency){const tr=document.createElement('tr');tr.innerHTML=`
  <td>${r.date||''}</td><td>${r.merchant||''}</td><td>${r.category||''}</td><td>${r.currency||''}</td>
  <td style="text-align:right">${fmtAmt(r.amount,r.currency)} ${r.currency||''}</td>
  <td style="text-align:right">${fmtAmt(r.baseAmount,baseCurrency)} ${baseCurrency}</td>
  <td>${r.description||''}</td><td>${r.country||''}</td>`;return tr;}

/* Charts */
const palette=["#2563eb","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#22c55e","#3b82f6","#a855f7","#14b8a6"];
function renderCharts(rows,baseCurrency){donutChart(rows,baseCurrency);barChart(rows,baseCurrency);}
function donutChart(rows,baseCurrency){
  const c=document.getElementById('donut');if(!c)return;const ctx=c.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,c.width,c.height);
  const sums={}, totalPos=rows.reduce((s,r)=>{const v=Math.max(0,r.baseAmount||0);if(!v)return s;const k=r.category||'Uncategorized';sums[k]=(sums[k]||0)+v;return s+v;},0);
  const entries=Object.entries(sums).sort((a,b)=>b[1]-a[1]);if(!entries.length||totalPos<=0){ctx.fillStyle="#6b7280";ctx.font="14px sans-serif";ctx.fillText("No data",10,20);return;}
  const top=entries.slice(0,8), other=entries.slice(8);
  const data=top.map(x=>x[1]);const labels=top.map(x=>x[0]);if(other.length){data.push(other.reduce((s,x)=>s+x[1],0));labels.push("Other");}
  const cx=c.width/2, cy=c.height/2, R=Math.min(c.width,c.height)/2-10, innerR=R*0.58;
  let ang=-Math.PI/2;for(let i=0;i<data.length;i++){const theta=(data[i]/totalPos)*Math.PI*2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,R,ang,ang+theta);ctx.closePath();ctx.fillStyle=palette[i%palette.length];ctx.fill();ang+=theta;}
  ctx.beginPath();ctx.arc(cx,cy,innerR,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();
  ctx.fillStyle="#111827";ctx.textAlign="center";ctx.textBaseline="middle";ctx.font="16px sans-serif";ctx.fillText("Total",cx,cy-8);ctx.font="bold 16px sans-serif";ctx.fillText(`${fmtAmt(totalPos,baseCurrency)} ${baseCurrency}`,cx,cy+10);
  const legend=document.getElementById('legend');legend.innerHTML='';labels.forEach((lab,i)=>{const item=document.createElement('div');item.className='item';const sw=document.createElement('span');sw.className='swatch';sw.style.background=palette[i%palette.length];const pct=((data[i]/totalPos)*100).toFixed(1);const txt=document.createElement('span');txt.textContent=`${lab} – ${pct}%`;item.appendChild(sw);item.appendChild(txt);legend.appendChild(item);});
}
function monthKey(d){const dt=new Date(d);if(!isFinite(dt.getTime()))return'—';const y=dt.getFullYear();const m=String(dt.getMonth()+1).padStart(2,'0');return `${y}-${m}`;}
function barChart(rows,baseCurrency){
  const c=document.getElementById('bar');if(!c)return;const ctx=c.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,c.width,c.height);
  const sums={};rows.forEach(r=>{const v=Math.max(0,r.baseAmount||0);if(!v)return;const k=monthKey(r.date);sums[k]=(sums[k]||0)+v;});
  const entries=Object.entries(sums).sort((a,b)=>a[0].localeCompare(b[0]));if(!entries.length){ctx.fillStyle="#6b7280";ctx.font="14px sans-serif";ctx.fillText("No data",10,20);return;}
  const labels=entries.map(e=>e[0]), data=entries.map(e=>e[1]);const maxV=Math.max(...data);
  const padL=40,padB=28,padT=8,padR=8;const innerW=c.width-padL-padR, innerH=c.height-padT-padB;
  const step=innerW/data.length, barW=Math.max(8,step-6);
  ctx.strokeStyle="#e5e7eb";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(padL,padT);ctx.lineTo(padL,c.height-padB);ctx.lineTo(c.width-padR,c.height-padB);ctx.stroke();
  ctx.fillStyle="#6b7280";ctx.font="12px sans-serif";for(let i=0;i<=4;i++){const v=(maxV*i/4);const y=c.height-padB-(v/maxV)*innerH;ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(c.width-padR,y);ctx.strokeStyle="#f3f4f6";ctx.stroke();ctx.fillText(fmtAmt(v,baseCurrency),4,y+4);}
  for(let i=0;i<data.length;i++){const x=padL+i*step+3;const h=(data[i]/maxV)*innerH;const y=c.height-padB-h;ctx.fillStyle="#2563eb";ctx.fillRect(x,y,barW,h);ctx.save();ctx.translate(x+barW/2,c.height-padB+12);ctx.rotate(-Math.PI/6);ctx.textAlign="right";ctx.fillStyle="#6b7280";ctx.font="11px sans-serif";ctx.fillText(labels[i],0,0);ctx.restore();}
}

/* Events */
document.getElementById('baseCurrency').addEventListener('change',e=>{state.baseCurrency=e.target.value;recomputeBase();render();});
document.getElementById('eurHufRate').addEventListener('input',e=>{state.eurHufRate=parseFloat(e.target.value)||395;recomputeBase();render();});
document.getElementById('pageSize').addEventListener('change',e=>{state.pageSize=parseInt(e.target.value,10);state.page=1;render();});
document.getElementById('groupBy').addEventListener('change',e=>{state.groupBy=e.target.value;render();});
document.getElementById('searchBox').addEventListener('input',e=>{state.search=e.target.value;state.page=1;render();});
document.getElementById('resetBtn').addEventListener('click',()=>{document.getElementById('baseCurrency').value='HUF';state.baseCurrency='HUF';document.getElementById('eurHufRate').value=395;state.eurHufRate=395;document.getElementById('pageSize').value=50;state.pageSize=50;document.getElementById('groupBy').value='';state.groupBy='';document.getElementById('searchBox').value='';state.search='';document.getElementById('dateFrom').value='';document.getElementById('dateTo').value='';state.dateFrom='';state.dateTo='';document.getElementById('amountMin').value='';document.getElementById('amountMax').value='';state.amountMin=null;state.amountMax=null;state.categories=[];[...document.getElementById('categoryFilter').options].forEach(o=>o.selected=false);state.page=1;recomputeBase();render();});
document.getElementById('dateFrom').addEventListener('change',e=>{state.dateFrom=e.target.value;state.page=1;render();});
document.getElementById('dateTo').addEventListener('change',e=>{state.dateTo=e.target.value;state.page=1;render();});
document.getElementById('amountMin').addEventListener('input',e=>{const v=e.target.value;state.amountMin=v===''?null:parseFloat(v);state.page=1;render();});
document.getElementById('amountMax').addEventListener('input',e=>{const v=e.target.value;state.amountMax=v===''?null:parseFloat(v);state.page=1;render();});
document.getElementById('categoryFilter').addEventListener('change',e=>{const opts=[...e.target.selectedOptions].map(o=>o.value);state.categories=opts;state.page=1;render();});
document.getElementById('exportBtn').addEventListener('click',exportFilteredCSV);
document.getElementById('resetFeedback').addEventListener('click',resetFeedback);

/* Sorting */
document.addEventListener('click',e=>{const th=e.target.closest('th.sortable');if(!th)return;const k=th.dataset.key;if(state.sortKey===k)state.sortDir=(state.sortDir==='asc')?'desc':'asc';else{state.sortKey=k;state.sortDir='asc';}render();});

/* File load */
function handleFile(file){const reader=new FileReader();reader.onload=e=>{const rows=parseCSV(e.target.result);const objs=toObjects(rows);const norm=objs.map(normalizeRow);state.raw=norm;recomputeBase();updateCategoryOptions();state.page=1;document.getElementById('loadStatus').innerText=`Loaded ${norm.length} rows from "${file.name}"`;render();};reader.readAsText(file,'utf-8');}
document.getElementById('fileInput').addEventListener('change',e=>{const f=e.target.files[0];if(f)handleFile(f);});
const dz=document.getElementById('dropzone');dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('dragover');});dz.addEventListener('dragleave',()=>dz.classList.remove('dragover'));dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('dragover');const f=e.dataTransfer.files&&e.dataTransfer.files[0];if(f)handleFile(f);});

/* recompute base */
function recomputeBase(){const base=state.baseCurrency, rate=state.eurHufRate;state.rows=state.raw.map(r=>Object.assign({},r,{baseAmount:computeBaseAmount(r,base,rate)}));}

/* initial render */
loadPrefs();
renderFeedbackBadges();
render();

function parseDate(d){
  // 支持 'YYYY-MM-DD' 或 'YYYY-MM-DD HH:MM'
  const t = Date.parse(d);
  return isNaN(t) ? null : new Date(t);
}
function daysBetween(a,b){ return Math.abs((b - a) / 86400000); }

function nearestPeriod(days){
  // 允许容差：周 ±1，月 ±3，年 ±15
  if (Math.abs(days-7) <= 1) return 7;
  if (Math.abs(days-30) <= 3) return 30;
  if (Math.abs(days-365) <= 15) return 365;
  return null;
}
function stdMean(xs){
  if (!xs.length) return [0,0];
  const mean = xs.reduce((s,x)=>s+x,0)/xs.length;
  const v = xs.reduce((s,x)=>s+(x-mean)*(x-mean),0)/xs.length;
  const std = Math.sqrt(v);
  return [std, mean];
}
function monthify(amount, period){
  if (period===7) return amount * (30/7);
  if (period===30) return amount;
  if (period===365) return amount / 12;
  return amount;
}

function detectSubscriptions(rows, base){
  const usable = rows.filter(r=>!prefs.whitelist.has(merchantKey(r.merchant)));
  // 按 merchant 聚合
  const byM = {};
  usable.forEach(r=>{
    const d = parseDate(r.date);
    if (!d) return;
    const key = (r.merchant||'Unknown').trim().toLowerCase();
    if (!byM[key]) byM[key] = [];
    byM[key].push({d, amt: r.baseAmount||0, raw: r});
  });
  const out = [];
  for (const k in byM){
    const arr = byM[k].sort((a,b)=>a.d-b.d);
    if (arr.length < 3) continue; // 至少3次
    // 间隔检测
    const gaps = [];
    for (let i=1;i<arr.length;i++) gaps.push(daysBetween(arr[i-1].d, arr[i].d));
    const nearest = gaps.map(nearestPeriod).filter(Boolean);
    if (!nearest.length) continue;
    // 取最常见周期
    const count = {7:0,30:0,365:0};
    nearest.forEach(p=>count[p]++);
    const period = [7,30,365].reduce((best,p)=> count[p]>count[best]?p:best,7);
    if (count[period] < 2) continue; // 至少两次符合该周期

    // 金额稳定度（±10% 容错）
    const amts = arr.map(x=>x.amt);
    const [std, mean] = stdMean(amts);
    const stable = (mean>0) ? (std/mean <= 0.10) : false;
    if (!stable) continue;

    // 汇总
    const last3 = arr.slice(-3).map(x=>x.d.toISOString().slice(0,10));
    const last = arr[arr.length-1].d;
    const next = new Date(last);
    if (period===7) next.setDate(next.getDate()+7);
    if (period===30) next.setDate(next.getDate()+30);
    if (period===365) next.setDate(next.getDate()+365);
    const avg = mean;
    const monthly = monthify(avg, period);
    // 简易置信度：周期匹配次数 * 金额稳定度权重
    const conf = Math.min(1, count[period]/3) * Math.min(1, 1 - Math.min(1, std/(mean||1)));
    out.push({
      merchant: (arr[0].raw.merchant||'Unknown'),
      period, avg, last3, next: next.toISOString().slice(0,10),
      confidence: conf
    });
  }
  // 取 Top N 月费
  out.sort((a,b)=> monthify(b.avg,b.period)-monthify(a.avg,a.period));
  return out.slice(0,12);
}

function percentile(arr, p){
  if (!arr.length) return 0;
  const a = [...arr].sort((x,y)=>x-y);
  const idx = Math.floor((p/100)*(a.length-1));
  return a[idx];
}
function detectAnomalies(rows, base){
  const usable = rows.filter(r=>!prefs.whitelist.has(merchantKey(r.merchant)));
  const positives = usable.map(r=>r.baseAmount||0).filter(v=>v>0);
  const p95 = percentile(positives, 95);
  const p99 = percentile(positives, 99);
  // 统计 “新商户”阈：只出现一次的商户
  const freq = {};
  usable.forEach(r=>{
    const key = (r.merchant||'Unknown').trim().toLowerCase();
    freq[key] = (freq[key]||0) + 1;
  });
  // 国家突变：同一商户出现多个国家
  const mc = {};
  usable.forEach(r=>{
    const key = (r.merchant||'Unknown').trim().toLowerCase();
    mc[key] = mc[key] || new Set();
    if (r.country) mc[key].add(r.country);
  });

  const out = [];
  usable.forEach(r=>{
    const reasons = [];
    const v = r.baseAmount||0;
    if (v >= p99) reasons.push('very_high_amount@P99');
    else if (v >= p95) reasons.push('high_amount@P95');

    const mk = (r.merchant||'Unknown').trim().toLowerCase();
    if (freq[mk]===1) reasons.push('new_merchant');
    if (mc[mk] && mc[mk].size>=2) reasons.push('country_switch');

    if (reasons.length){
      const severity = (reasons.includes('very_high_amount@P99')) ? 'high'
                      : (reasons.includes('high_amount@P95') ? 'med' : 'low');
      out.push({
        date: r.date, merchant: r.merchant||'Unknown',
        category: r.category||'—',
        baseAmount: v, reasons: reasons.join(', '), severity
      });
    }
  });
  // 只展示 Top 30（按金额）
  out.sort((a,b)=>b.baseAmount-a.baseAmount);
  return out.slice(0,30);
}

function renderInsights(filtered, base){
  const usable = filtered.filter(r=>!prefs.whitelist.has(merchantKey(r.merchant)));
  // 订阅
  const subs = detectSubscriptions(usable, base).filter(s=>!prefs.dismissedSubs.has(merchantKey(s.merchant)));
  const sb = document.getElementById('subsBody');
  sb.innerHTML = subs.map(s=>`
    <tr>
      <td>${s.merchant}</td>
      <td>${s.period === 7 ? 'Weekly' : s.period===30 ? 'Monthly' : 'Yearly'}</td>
      <td style="text-align:right">${fmtAmt(s.avg, base)} ${base}</td>
      <td>${s.last3.join(' , ')}</td>
      <td>${s.next}</td>
      <td>${(s.confidence*100).toFixed(0)}%</td>
      <td style="white-space:nowrap;gap:6px;display:flex">
        <button class="btn" onclick="dismissSub('${merchantKey(s.merchant)}')">Dismiss</button>
        <button class="btn" onclick="whitelistMerchant('${merchantKey(s.merchant)}')">Whitelist</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="7" class="muted">No candidates</td></tr>`;

  // 异常
  const anoms = detectAnomalies(usable, base).filter(a=>{const key=anomalyKey(a);const mk=merchantKey(a.merchant);return !prefs.dismissedAnoms.has(key)&&!prefs.whitelist.has(mk);});
  const ab = document.getElementById('anomBody');
  ab.innerHTML = anoms.map(a=>{const key=anomalyKey(a);return `
    <tr>
      <td>${a.date||''}</td>
      <td>${a.merchant}</td>
      <td>${a.category}</td>
      <td style=\"text-align:right\">${fmtAmt(a.baseAmount, base)} ${base}</td>
      <td>${a.reasons}</td>
      <td>${a.severity}</td>
      <td style=\"white-space:nowrap;gap:6px;display:flex\">
        <button class=\"btn\" onclick=\"dismissAnom('${key}')\">Dismiss</button>
        <button class=\"btn\" onclick=\"whitelistMerchant('${merchantKey(a.merchant)}')\">Whitelist</button>
      </td>
    </tr>`;}).join('') || `<tr><td colspan="7" class="muted">No anomalies</td></tr>`;
  renderFeedbackBadges();
}
