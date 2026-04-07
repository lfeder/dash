# Daily Report Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new "Daily" dashboard page showing daily sales summary, weekly dollar chart, and cuke/lettuce harvest tables with a Today/Yesterday toggle.

**Architecture:** Single-file HTML page (`daily/index.html`) following the same pattern as `sales/index.html`. Fetches invoice data via JSONP from the existing Google Sheet, and grow data from the grow sheet. All logic inline. Light/cream theme. Registered as a tab in the main nav (`index.html`).

**Tech Stack:** HTML/CSS/JS, Chart.js 4.4.7 (CDN), Google Sheets gviz API (JSONP)

**Spec:** `docs/superpowers/specs/2026-04-07-daily-report-design.md`

---

### Task 1: Create daily/index.html with page skeleton and styles

**Files:**
- Create: `daily/index.html`

This task creates the full HTML shell with all CSS, empty content sections, and the Today/Yesterday toggle wiring. No data fetching yet — just the static structure.

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p daily
```

- [ ] **Step 2: Write the page skeleton**

Create `daily/index.html` with this content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Daily Report</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f0eb; color: #333; }
  #header { background: #4a8c5c; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; }
  #header h1 { font-size: 1.5rem; color: #fff; font-weight: 700; }
  #content { max-width: 1200px; margin: 0 auto; padding: 20px 24px; }
  #date-line { font-size: 1rem; color: #333; margin-bottom: 12px; }
  .toggle-bar { display: flex; gap: 0; margin-bottom: 16px; }
  .toggle-btn { padding: 6px 16px; font-size: 0.85rem; border: 1px solid #999; background: #e0dbd5; color: #666; cursor: pointer; }
  .toggle-btn:first-child { border-radius: 4px 0 0 4px; }
  .toggle-btn:last-child { border-radius: 0 4px 4px 0; }
  .toggle-btn.active { background: #4a8c5c; color: #fff; border-color: #4a8c5c; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-bottom: 24px; }
  th { text-align: left; padding: 6px 10px; border-bottom: 2px solid #ccc; color: #4a8c5c; font-weight: 600; }
  th.num, td.num { text-align: right; }
  td { padding: 5px 10px; border-bottom: 1px solid #ddd; }
  tr.total-row td { border-top: 2px solid #999; font-weight: 600; }
  .section-title { font-size: 1.1rem; font-weight: 600; color: #333; margin: 24px 0 8px; }

  /* Chart */
  .chart-box { background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 24px; border: 1px solid #ddd; }
  .chart-box h3 { font-size: 1rem; font-weight: 600; color: #333; margin-bottom: 8px; }
</style>
</head>
<body>

<div id="header">
  <h1>Daily</h1>
  <span style="font-size:0.7rem;color:#e0e0e0;" id="version"></span>
</div>

<div id="content">
  <div id="date-line"></div>
  <div class="toggle-bar">
    <button class="toggle-btn active" id="btnToday" onclick="setDay('today')">Today</button>
    <button class="toggle-btn" id="btnYesterday" onclick="setDay('yesterday')">Yesterday</button>
  </div>

  <div id="sales-section">
    <table id="sales-table"><thead><tr>
      <th>$ (000)</th><th class="num">TDY</th><th class="num">WTD</th><th class="num">MTD</th><th class="num">YTD</th><th class="num">LYTD</th><th class="num">Chg</th>
    </tr></thead><tbody id="sales-tbody"></tbody></table>
  </div>

  <div class="chart-box">
    <h3>Weekly $ (000)</h3>
    <canvas id="weeklyChart" height="300"></canvas>
  </div>

  <div class="section-title">Cuke Pounds</div>
  <table id="cuke-table"><thead><tr>
    <th>GH</th><th class="num">Day</th><th class="num">K1</th><th class="num">J1</th><th class="num">E1</th><th class="num">K2</th><th class="num">J2</th><th class="num">E2</th><th class="num">Total</th><th class="num">% OG</th>
  </tr></thead><tbody id="cuke-tbody"></tbody></table>

  <div class="section-title">Lettuce Pounds</div>
  <table id="lettuce-table"><thead><tr>
    <th>Pond</th><th>Variety</th><th class="num">Boards</th><th class="num">Lb/Board</th><th class="num">Total</th>
  </tr></thead><tbody id="lettuce-tbody"></tbody></table>
</div>

<script>
// ── Reference date logic ──
function hstNow() {
  return new Date(new Date().getTime() - 10 * 3600000);
}
function hstToday() {
  const h = hstNow();
  return new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), h.getUTCDate()));
}

let refDate = hstToday();
let dayMode = 'today';

function setDay(mode) {
  dayMode = mode;
  refDate = hstToday();
  if (mode === 'yesterday') refDate.setUTCDate(refDate.getUTCDate() - 1);
  document.getElementById('btnToday').classList.toggle('active', mode === 'today');
  document.getElementById('btnYesterday').classList.toggle('active', mode === 'yesterday');
  document.getElementById('date-line').textContent = refDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  render();
}

function render() {
  renderSalesTable();
  renderWeeklyChart();
  renderCukeTable();
  renderLettuceTable();
}

// Placeholder render functions — implemented in subsequent tasks
function renderSalesTable() {}
function renderWeeklyChart() {}
function renderCukeTable() {}
function renderLettuceTable() {}

// Initialize
setDay('today');
</script>
</body>
</html>
```

- [ ] **Step 3: Verify page loads**

Open `daily/index.html` in a browser. Confirm: green header with "Daily", date displays, Today/Yesterday toggle switches, empty tables with correct headers visible.

- [ ] **Step 4: Commit**

```bash
git add daily/index.html
git commit -m "Add daily report page skeleton with layout and toggle"
```

---

### Task 2: Fetch invoice data via JSONP

**Files:**
- Modify: `daily/index.html` (script section)

Add the JSONP fetching logic for invoice data, reusing the same pattern as `sales/index.html`. Parse date fields to extract year, month, day, ISO week, and day-of-week.

- [ ] **Step 1: Add data fetching code**

In `daily/index.html`, insert the following above the `// ── Reference date logic ──` comment:

```javascript
// ── Data ──
const SHEET_ID = '124y8JdWXmbf_hb1vfimHmGaKLVXrRHybw02w_ozCExE';
const INVOICE_TABS = [
  { name: 'invoices_23-25', gid: '1254110782' },
  { name: 'invoices_2025',  gid: '544460225'  }
];
const GROW_SHEET = '1VtEecYn-W1pbnIU1hRHfxIpkH2DtK7hj0CpcpiLoziM';

let invoiceRows = [];
let cukeGrowRows = [];
let lettuceGrowRows = [];

function parseGvizTable(table) {
  const cols = table.cols.map(c => c.label);
  return table.rows.map(r => {
    const obj = {};
    r.c.forEach((cell, i) => {
      const col = cols[i];
      if (!col) return;
      if (!cell || cell.v === null || cell.v === undefined) { obj[col] = ''; return; }
      if (typeof cell.v === 'string' && cell.v.startsWith('Date(')) {
        const dm = cell.v.match(/Date\((\d+),(\d+),(\d+)\)/);
        if (dm) {
          obj[col] = cell.f || cell.v;
          obj['_y'] = parseInt(dm[1]);
          obj['_m'] = parseInt(dm[2]) + 1; // 1-indexed
          obj['_d'] = parseInt(dm[3]);
          obj['_md'] = obj['_m'] * 100 + obj['_d'];
          // Compute ISO week and day-of-week
          const dt = new Date(Date.UTC(obj['_y'], obj['_m'] - 1, obj['_d']));
          obj['_dow'] = dt.getUTCDay(); // 0=Sun
          // ISO week calculation
          const tmp = new Date(Date.UTC(obj['_y'], obj['_m'] - 1, obj['_d']));
          tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
          const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
          obj['_isoWeek'] = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
        }
      } else if (typeof cell.v === 'number') {
        obj[col] = cell.v;
      } else {
        obj[col] = cell.v;
      }
    });
    return obj;
  });
}

function fetchJsonp(sheetId, gid, cb) {
  return new Promise((resolve, reject) => {
    const cbName = '_cb' + gid + '_' + Date.now();
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json;responseHandler:${cbName}&gid=${gid}`;
    window[cbName] = function(resp) {
      delete window[cbName];
      if (script.parentNode) script.parentNode.removeChild(script);
      if (resp.status === 'error') { reject(resp.errors); return; }
      resolve(resp.table);
    };
    const script = document.createElement('script');
    script.src = url;
    script.onerror = () => { delete window[cbName]; reject('Network error'); };
    document.head.appendChild(script);
  });
}

function fetchSheetByName(sheetId, sheetName, tq) {
  return new Promise((resolve, reject) => {
    const cbName = '_cb_' + sheetName + '_' + Date.now();
    let url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json;responseHandler:${cbName}&sheet=${encodeURIComponent(sheetName)}`;
    if (tq) url += `&tq=${encodeURIComponent(tq)}`;
    window[cbName] = function(resp) {
      delete window[cbName];
      if (script.parentNode) script.parentNode.removeChild(script);
      if (resp.status === 'error') { reject(resp.errors); return; }
      resolve(resp.table);
    };
    const script = document.createElement('script');
    script.src = url;
    script.onerror = () => { delete window[cbName]; reject('Network error'); };
    document.head.appendChild(script);
  });
}
```

- [ ] **Step 2: Add loadData function and call it**

Replace the `// Initialize` and `setDay('today')` block at the bottom of the script with:

```javascript
async function loadData() {
  // Fetch invoices
  const tables = await Promise.all(INVOICE_TABS.map(t => fetchJsonp(SHEET_ID, t.gid)));
  invoiceRows = tables.flatMap(t => parseGvizTable(t))
    .filter(r => r.CustomerGroup && r.ProductCode !== 'Sales')
    .filter(r => {
      const y = Math.round(r.Year);
      return y === 2025 || y === 2026;
    });
  invoiceRows.forEach(r => {
    r.Year = Math.round(r.Year);
    r.Dollars = r.Dollars || 0;
    r.Cases = Math.round(r.Cases || 0);
  });

  // Fetch cuke grow: SELECT A,G,H,I,L from grow_C_harvest
  const cukeTable = await fetchSheetByName(GROW_SHEET, 'grow_C_harvest', "SELECT A,G,H,I,L");
  cukeGrowRows = parseGvizTable(cukeTable).filter(r => r._y === 2026);
  cukeGrowRows.forEach(r => {
    r.Greenhouse = r.Greenhouse || '';
    r.Variety = r.Variety || '';
    r.Grade = Math.round(r.Grade || 0);
    r.GreenhouseNetWeight = r.GreenhouseNetWeight || 0;
  });

  // Fetch lettuce grow
  const lettTable = await fetchSheetByName(GROW_SHEET, 'grow_L_seeding',
    "SELECT * WHERE YEAR(N)=2026");
  lettuceGrowRows = parseGvizTable(lettTable).filter(r => r._y === 2026);
  lettuceGrowRows.forEach(r => {
    r.Pond = r.Pond || '';
    r.SeedName = r.SeedName || '';
    r.BoardsPerPond = r.BoardsPerPond || 0;
    r.PoundsPerBoard = r.PoundsPerBoard || 0;
    r.GreenhouseNetWeight = r.GreenhouseNetWeight || 0;
  });

  setDay('today');
}

loadData().catch(err => console.error('Load error:', err));
```

- [ ] **Step 3: Verify data loads**

Open browser console, confirm no errors. Add `console.log(invoiceRows.length, cukeGrowRows.length, lettuceGrowRows.length)` temporarily after loading to verify data comes through.

- [ ] **Step 4: Commit**

```bash
git add daily/index.html
git commit -m "Add invoice and grow data fetching to daily report"
```

---

### Task 3: Render sales $ summary table

**Files:**
- Modify: `daily/index.html` (replace `renderSalesTable` function)

Implements the TDY/WTD/MTD/YTD/LYTD/Chg table with Cuke, Lettuce, and Total rows.

- [ ] **Step 1: Implement renderSalesTable**

Replace the placeholder `function renderSalesTable() {}` with:

```javascript
function renderSalesTable() {
  const rd = refDate;
  const yr = rd.getUTCFullYear();      // 2026
  const mo = rd.getUTCMonth() + 1;     // 1-indexed month
  const dy = rd.getUTCDate();
  const md = mo * 100 + dy;

  // Compute reference date's ISO week
  const tmp = new Date(Date.UTC(yr, mo - 1, dy));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const ys = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const refIsoWeek = Math.ceil(((tmp - ys) / 86400000 + 1) / 7);
  const refDow = rd.getUTCDay();

  // Filter helpers — all work on invoice date parsed fields
  const isRefDay = r => r._y === yr && r._m === mo && r._d === dy;
  const isWtd = r => r._y === yr && r._isoWeek === refIsoWeek && r._dow <= refDow;
  const isMtd = r => r._y === yr && r._m === mo && r._d <= dy;
  const isYtd = r => r._y === yr && r._md <= md;
  const isLytd = r => r._y === (yr - 1) && r._md <= md;

  function sumDollars(rows, filterFn) {
    return rows.filter(filterFn).reduce((s, r) => s + r.Dollars, 0);
  }

  const farms = ['Cuke', 'Lettuce'];
  const tbody = document.getElementById('sales-tbody');
  tbody.innerHTML = '';

  const totals = { tdy: 0, wtd: 0, mtd: 0, ytd: 0, lytd: 0 };

  farms.forEach(farm => {
    const fr = invoiceRows.filter(r => r.Farm === farm);
    const tdy = sumDollars(fr, isRefDay);
    const wtd = sumDollars(fr, isWtd);
    const mtd = sumDollars(fr, isMtd);
    const ytd = sumDollars(fr, isYtd);
    const lytd = sumDollars(fr, isLytd);
    const chg = lytd ? ((ytd - lytd) / lytd * 100) : 0;
    totals.tdy += tdy; totals.wtd += wtd; totals.mtd += mtd;
    totals.ytd += ytd; totals.lytd += lytd;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${farm}</td>
      <td class="num">${Math.round(tdy / 1000).toLocaleString()}</td>
      <td class="num">${Math.round(wtd / 1000).toLocaleString()}</td>
      <td class="num">${Math.round(mtd / 1000).toLocaleString()}</td>
      <td class="num">${Math.round(ytd / 1000).toLocaleString()}</td>
      <td class="num">${Math.round(lytd / 1000).toLocaleString()}</td>
      <td class="num">${lytd ? Math.round(chg) + '%' : '—'}</td>
    `;
    tbody.appendChild(tr);
  });

  const totChg = totals.lytd ? ((totals.ytd - totals.lytd) / totals.lytd * 100) : 0;
  const totTr = document.createElement('tr');
  totTr.className = 'total-row';
  totTr.innerHTML = `
    <td>Total</td>
    <td class="num">${Math.round(totals.tdy / 1000).toLocaleString()}</td>
    <td class="num">${Math.round(totals.wtd / 1000).toLocaleString()}</td>
    <td class="num">${Math.round(totals.mtd / 1000).toLocaleString()}</td>
    <td class="num">${Math.round(totals.ytd / 1000).toLocaleString()}</td>
    <td class="num">${Math.round(totals.lytd / 1000).toLocaleString()}</td>
    <td class="num">${totals.lytd ? Math.round(totChg) + '%' : '—'}</td>
  `;
  tbody.appendChild(totTr);
}
```

- [ ] **Step 2: Verify table renders**

Open page in browser. Confirm Cuke/Lettuce/Total rows appear with dollar values in thousands. Toggle Yesterday and verify values change.

- [ ] **Step 3: Commit**

```bash
git add daily/index.html
git commit -m "Add sales dollar summary table to daily report"
```

---

### Task 4: Render weekly $ chart

**Files:**
- Modify: `daily/index.html` (replace `renderWeeklyChart` function)

Line chart with one line per weekday (Mon–Fri), X-axis = week 1–52, Y-axis = dollars in thousands. Uses 2026 invoice data.

- [ ] **Step 1: Add chart instance variable**

Add this near the top of the script section, after `let lettuceGrowRows = [];`:

```javascript
let weeklyChart = null;
```

- [ ] **Step 2: Implement renderWeeklyChart**

Replace the placeholder `function renderWeeklyChart() {}` with:

```javascript
function renderWeeklyChart() {
  // Aggregate: for each ISO week, sum dollars by day-of-week (Mon=1..Fri=5)
  const yr = refDate.getUTCFullYear();
  const data = {}; // { dow: { week: totalDollars } }
  for (let d = 1; d <= 5; d++) data[d] = {};

  invoiceRows.filter(r => r._y === yr).forEach(r => {
    const dow = r._dow; // 0=Sun, 1=Mon..5=Fri
    if (dow < 1 || dow > 5) return;
    const w = r._isoWeek;
    if (!data[dow][w]) data[dow][w] = 0;
    data[dow][w] += r.Dollars;
  });

  const weeks = [];
  for (let w = 1; w <= 52; w++) weeks.push(w);

  const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const dayColors = ['', '#e74c3c', '#4a90d9', '#4ecca3', '#f0a030', '#888'];

  const datasets = [];
  for (let d = 1; d <= 5; d++) {
    datasets.push({
      label: dayNames[d],
      data: weeks.map(w => data[d][w] ? Math.round(data[d][w] / 1000) : null),
      borderColor: dayColors[d],
      backgroundColor: dayColors[d],
      tension: 0.3,
      pointRadius: 2,
      spanGaps: false,
      borderWidth: 2
    });
  }

  if (weeklyChart) weeklyChart.destroy();
  const ctx = document.getElementById('weeklyChart').getContext('2d');
  weeklyChart = new Chart(ctx, {
    type: 'line',
    data: { labels: weeks, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: '#555',
            font: { size: 11 },
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toLocaleString() : '—'}`
          }
        }
      },
      scales: {
        x: { ticks: { color: '#888', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.06)' } },
        y: {
          grace: '5%',
          ticks: { color: '#888', font: { size: 11 }, precision: 0 },
          grid: { color: 'rgba(0,0,0,0.06)' }
        }
      }
    }
  });
}
```

- [ ] **Step 3: Verify chart renders**

Open page. Confirm line chart shows with 5 colored lines (Mon–Fri), X-axis 1–52, sensible dollar-in-thousands values on Y-axis.

- [ ] **Step 4: Commit**

```bash
git add daily/index.html
git commit -m "Add weekly dollar chart to daily report"
```

---

### Task 5: Render cuke pounds table

**Files:**
- Modify: `daily/index.html` (replace `renderCukeTable` function)

Table showing greenhouse rows with per-variety/grade breakdown, totals, and % OG.

- [ ] **Step 1: Implement renderCukeTable**

Replace the placeholder `function renderCukeTable() {}` with:

```javascript
function renderCukeTable() {
  const rd = refDate;
  const dayRows = cukeGrowRows.filter(r => r._y === rd.getUTCFullYear() && r._m === (rd.getUTCMonth() + 1) && r._d === rd.getUTCDate());

  // Aggregate by greenhouse
  const ghData = {}; // { gh: { K1:0, K2:0, J1:0, J2:0, E1:0, E2:0 } }
  dayRows.forEach(r => {
    const gh = r.Greenhouse;
    if (!ghData[gh]) ghData[gh] = { K1:0, K2:0, J1:0, J2:0, E1:0, E2:0 };
    const key = r.Variety + r.Grade; // e.g. "K1", "J2"
    if (ghData[gh][key] !== undefined) ghData[gh][key] += r.GreenhouseNetWeight;
  });

  const tbody = document.getElementById('cuke-tbody');
  tbody.innerHTML = '';

  const ghNames = Object.keys(ghData).sort();
  const tots = { K1:0, K2:0, J1:0, J2:0, E1:0, E2:0 };

  ghNames.forEach(gh => {
    const d = ghData[gh];
    const day = d.K1 + d.K2 + d.J1 + d.J2 + d.E1 + d.E2;
    const g1 = d.K1 + d.J1 + d.E1;
    const g2 = d.K2 + d.J2 + d.E2;
    const og = (g1 + g2) ? Math.round(g2 / (g1 + g2) * 100) : 0;
    Object.keys(tots).forEach(k => tots[k] += d[k]);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:#4a8c5c;font-weight:600;">${gh}</td>
      <td class="num">${Math.round(day).toLocaleString()}</td>
      <td class="num">${d.K1 ? Math.round(d.K1).toLocaleString() : ''}</td>
      <td class="num">${d.J1 ? Math.round(d.J1).toLocaleString() : ''}</td>
      <td class="num">${d.E1 ? Math.round(d.E1).toLocaleString() : ''}</td>
      <td class="num">${d.K2 ? Math.round(d.K2).toLocaleString() : ''}</td>
      <td class="num">${d.J2 ? Math.round(d.J2).toLocaleString() : ''}</td>
      <td class="num">${d.E2 ? Math.round(d.E2).toLocaleString() : ''}</td>
      <td class="num">${Math.round(day).toLocaleString()}</td>
      <td class="num">${og}%</td>
    `;
    tbody.appendChild(tr);
  });

  // Total row
  const totDay = Object.values(tots).reduce((s, v) => s + v, 0);
  const totG1 = tots.K1 + tots.J1 + tots.E1;
  const totG2 = tots.K2 + tots.J2 + tots.E2;
  const totOg = (totG1 + totG2) ? Math.round(totG2 / (totG1 + totG2) * 100) : 0;

  const tr = document.createElement('tr');
  tr.className = 'total-row';
  tr.innerHTML = `
    <td style="font-weight:600;">Total</td>
    <td class="num"></td>
    <td class="num">${Math.round(tots.K1).toLocaleString()}</td>
    <td class="num">${Math.round(tots.J1).toLocaleString()}</td>
    <td class="num">${Math.round(tots.E1).toLocaleString()}</td>
    <td class="num">${Math.round(tots.K2).toLocaleString()}</td>
    <td class="num">${Math.round(tots.J2).toLocaleString()}</td>
    <td class="num">${Math.round(tots.E2).toLocaleString()}</td>
    <td class="num">${Math.round(totDay).toLocaleString()}</td>
    <td class="num">${totOg}%</td>
  `;
  tbody.appendChild(tr);
}
```

- [ ] **Step 2: Verify table renders**

Open page, confirm greenhouse rows appear with variety/grade columns populated for the reference date. Toggle Yesterday and verify data changes.

- [ ] **Step 3: Commit**

```bash
git add daily/index.html
git commit -m "Add cuke pounds table to daily report"
```

---

### Task 6: Render lettuce pounds table

**Files:**
- Modify: `daily/index.html` (replace `renderLettuceTable` function)

Table showing pond, variety, boards, lb/board, and total for the reference date.

- [ ] **Step 1: Implement renderLettuceTable**

Replace the placeholder `function renderLettuceTable() {}` with:

```javascript
function renderLettuceTable() {
  const rd = refDate;
  const dayRows = lettuceGrowRows.filter(r => r._y === rd.getUTCFullYear() && r._m === (rd.getUTCMonth() + 1) && r._d === rd.getUTCDate());

  const tbody = document.getElementById('lettuce-tbody');
  tbody.innerHTML = '';

  let totBoards = 0, totLbs = 0;

  dayRows.forEach(r => {
    const boards = Math.round(r.BoardsPerPond) || 0;
    const lbBoard = r.PoundsPerBoard || 0;
    const total = r.GreenhouseNetWeight || 0;
    totBoards += boards;
    totLbs += total;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:#4a8c5c;font-weight:600;">${r.Pond}</td>
      <td>${r.SeedName}</td>
      <td class="num">${boards.toLocaleString()}</td>
      <td class="num">${lbBoard ? lbBoard.toFixed(1) : ''}</td>
      <td class="num">${Math.round(total).toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  });

  // Total row
  const avgLbBoard = totBoards ? totLbs / totBoards : 0;
  const tr = document.createElement('tr');
  tr.className = 'total-row';
  tr.innerHTML = `
    <td style="font-weight:600;">Total</td>
    <td></td>
    <td class="num">${totBoards.toLocaleString()}</td>
    <td class="num">${avgLbBoard ? avgLbBoard.toFixed(1) : ''}</td>
    <td class="num">${Math.round(totLbs).toLocaleString()}</td>
  `;
  tbody.appendChild(tr);
}
```

- [ ] **Step 2: Verify table renders**

Open page, confirm lettuce rows show pond, variety, boards, lb/board, and total. Toggle Yesterday to verify.

- [ ] **Step 3: Commit**

```bash
git add daily/index.html
git commit -m "Add lettuce pounds table to daily report"
```

---

### Task 7: Register Daily tab in main navigation

**Files:**
- Modify: `index.html`

Add the Daily page to the main dashboard navigation.

- [ ] **Step 1: Add Daily to DASHBOARDS array**

In `index.html`, add this entry at the beginning of the `DASHBOARDS` array (so Daily appears as the first tab):

```javascript
  { id: 'daily',     label: 'Daily',     src: 'daily/index.html' },
```

The full array should now start:
```javascript
const DASHBOARDS = [
  { id: 'daily',     label: 'Daily',     src: 'daily/index.html' },
  { id: 'sales',     label: 'Sales',     src: 'sales/index.html' },
  ...
];
```

- [ ] **Step 2: Verify navigation works**

Open `index.html` in browser. Confirm "Daily" tab appears and loads the daily report page in its iframe.

- [ ] **Step 3: Update version stamps**

Update the version stamp in `daily/index.html` to current HST time (format: `MM-DD HH:MM`).

- [ ] **Step 4: Commit and push**

```bash
git add index.html daily/index.html
git commit -m "Register Daily tab in main dashboard navigation"
git push
```
