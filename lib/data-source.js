/**
 * Shared data-source abstraction for dashboards.
 *
 * Three modes behind a runtime toggle:
 *   'sheets' — existing gviz JSONP calls (current default)
 *   'dev'    — Supabase dev project (kfwqtaazdankxmdlqdak)
 *   'prod'   — Supabase prod project (zdvpqygiqavwpxljpvqw)
 *
 * Mode is read from ?src=... URL param first, then localStorage('dashSource'),
 * defaulting to 'sheets'. setMode() persists to localStorage and reloads the
 * page with ?src= appended.
 *
 * Each logical table name (e.g. 'invoices') has a config entry mapping to
 * the physical sheet source(s) OR the Supabase view/table. fetchTable()
 * returns a gviz-shaped {cols, rows} object no matter the backend, so page
 * code that already parses gviz responses only changes the fetch call.
 *
 * Supabase client is loaded lazily from CDN on first use.
 */
(function (global) {
  'use strict';

  // =========================================================================
  // Configuration
  // =========================================================================

  const SUPABASE_PROJECTS = {
    dev: {
      url: 'https://kfwqtaazdankxmdlqdak.supabase.co',
      anon: 'sb_publishable_AMRw7zq1xtPex_3-8wgvDA_A3QzWgHb',
    },
    prod: {
      url: 'https://zdvpqygiqavwpxljpvqw.supabase.co',
      anon: 'sb_publishable_HaoyPZbNIUxKPnwCh3iI3Q_1NIiWGgv',
    },
  };

  // Shared sheet IDs so we don't repeat them.
  const SHEETS = {
    invoices: '124y8JdWXmbf_hb1vfimHmGaKLVXrRHybw02w_ozCExE',
    grow:     '1VtEecYn-W1pbnIU1hRHfxIpkH2DtK7hj0CpcpiLoziM',
    chem:     '1XwaLTghRd1SRuebJmCyjZJ6z5i6vu_nrI0nR0kkE2c0',
    fsafe:    '1MbHJoJmq0w8hWz8rl9VXezmK-63MFmuK19lz3pu0dfc',
    plantmap: '1ewWyvaXGkRCvZxjUxBOHGY4PKdMHwKeTA5jTIod48LE',
  };

  /**
   * Per logical table: how to load it in sheets mode and in supabase mode.
   *
   * sheets: array of { sheetId, gid } sources (multiple get concatenated)
   * supabase: { table, select?, filter?, columns }
   *   columns is an ordered list of { label, field, type, transform? } — the
   *   label matches what the sheet header would be so downstream parseGvizTable
   *   in page code sees the same column names.
   */
  const CONFIG = {
    invoices: {
      sheets: [
        { sheetId: SHEETS.invoices, gid: '1254110782' }, // invoices_23-25
        { sheetId: SHEETS.invoices, gid: '544460225'  }, // invoices_2025 (holds 2026 data)
      ],
      supabase: {
        table: 'sales_invoice_v',
        select: '*',
        columns: [
          { label: 'InvoiceDate',   field: 'invoice_date',   type: 'date'   },
          { label: 'CustomerName',  field: 'customer_name',  type: 'string' },
          { label: 'ProductCode',   field: 'product_code',   type: 'string' },
          { label: 'Cases',         field: 'cases',          type: 'number' },
          { label: 'Dollars',       field: 'dollars',        type: 'number' },
          { label: 'InvoiceNumber', field: 'invoice_number', type: 'string' },
          { label: 'Pounds',        field: 'pounds',         type: 'number' },
          { label: 'Variety',       field: 'variety',        type: 'string' },
          { label: 'Grade',         field: 'grade',          type: 'number' },
          { label: 'Year',          field: 'year',           type: 'number' },
          { label: 'Month',         field: 'month',          type: 'number' },
          { label: 'ISOYear',       field: 'iso_year',       type: 'number' },
          { label: 'ISOWeek',       field: 'iso_week',       type: 'number' },
          { label: 'DOW',           field: 'dow',            type: 'number' },
          { label: 'Farm',          field: 'farm_id',        type: 'string',
            transform: (v) => v === 'cuke' ? 'Cuke' : (v === 'lettuce' ? 'Lettuce' : v) },
          { label: 'CustomerGroup', field: 'customer_group', type: 'string' },
        ],
      },
    },
    expenses: {
      // No dashboard currently reads expenses from sheet tabs directly; the
      // nightly sync is the only sheet consumer. Leaving sheets empty here
      // means fetchTable('expenses') only works in dev/prod mode.
      sheets: [],
      supabase: {
        table: 'fin_expense_v',
        select: '*',
        columns: [
          { label: 'Txn Date',         field: 'txn_date',         type: 'date'    },
          { label: 'Payee',            field: 'payee_name',       type: 'string'  },
          { label: 'Description',      field: 'description',      type: 'string'  },
          { label: 'Account',          field: 'account_name',     type: 'string'  },
          { label: 'AccountRef',       field: 'account_ref',      type: 'string'  },
          { label: 'Class',            field: 'class_name',       type: 'string'  },
          { label: 'Amount',           field: 'amount',           type: 'number'  },
          { label: 'IsCredit',         field: 'is_credit',        type: 'boolean' },
          { label: 'EffectiveAmount',  field: 'effective_amount', type: 'number'  },
          { label: 'Macro',            field: 'macro_category',   type: 'string'  },
          { label: 'Year',             field: 'year',             type: 'number'  },
          { label: 'Month',            field: 'month',            type: 'number'  },
        ],
      },
    },
    cuke_harvest: {
      sheets: [
        { sheetId: SHEETS.grow, tab: 'grow_C_harvest' },
      ],
      supabase: {
        table: 'grow_cuke_harvest_v',
        select: '*',
        columns: [
          { label: 'HarvestDate',         field: 'harvest_date',           type: 'date'   },
          { label: 'Greenhouse',          field: 'greenhouse',             type: 'string' },
          { label: 'Variety',             field: 'variety',                type: 'string' },
          { label: 'Grade',               field: 'grade',                  type: 'number' },
          { label: 'GreenhouseNetWeight', field: 'greenhouse_net_weight',  type: 'number' },
        ],
      },
    },
    // Additional logical tables get added here as each dashboard migrates.
  };

  // =========================================================================
  // Mode state
  // =========================================================================

  const STORAGE_KEY = 'dashSource';
  const VALID_MODES = ['sheets', 'dev', 'prod'];

  function getMode() {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get('src');
    if (fromUrl && VALID_MODES.includes(fromUrl)) return fromUrl;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_MODES.includes(stored)) return stored;
    return 'sheets';
  }

  function setMode(mode) {
    if (!VALID_MODES.includes(mode)) throw new Error('Bad mode: ' + mode);
    localStorage.setItem(STORAGE_KEY, mode);
    const url = new URL(window.location.href);
    url.searchParams.set('src', mode);
    window.location.href = url.toString();
  }

  // =========================================================================
  // Supabase client (lazy)
  // =========================================================================

  let supabasePromise = null;
  let cachedClient = {};

  function loadSupabaseLib() {
    if (supabasePromise) return supabasePromise;
    supabasePromise = new Promise((resolve, reject) => {
      if (global.supabase && global.supabase.createClient) {
        resolve(global.supabase);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = () => {
        if (global.supabase && global.supabase.createClient) resolve(global.supabase);
        else reject(new Error('supabase-js loaded but createClient missing'));
      };
      script.onerror = () => reject(new Error('Failed to load supabase-js from CDN'));
      document.head.appendChild(script);
    });
    return supabasePromise;
  }

  async function getSupabaseClient(mode) {
    if (cachedClient[mode]) return cachedClient[mode];
    const { createClient } = await loadSupabaseLib();
    const proj = SUPABASE_PROJECTS[mode];
    if (!proj) throw new Error('Unknown supabase project for mode: ' + mode);
    cachedClient[mode] = createClient(proj.url, proj.anon);
    return cachedClient[mode];
  }

  // =========================================================================
  // Sheets fetch (gviz JSONP)
  // =========================================================================

  function fetchSheetGviz(sheetId, source) {
    // source: { gid } or { tab } or { tab, tq }
    return new Promise((resolve, reject) => {
      const tag = source.gid || source.tab || '0';
      const cbName = '_cb_' + String(tag).replace(/[^a-z0-9_]/gi, '') + '_' + Math.floor(Math.random() * 1e9);
      let url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json;responseHandler:${cbName}`;
      if (source.gid) url += `&gid=${source.gid}`;
      if (source.tab) url += `&sheet=${encodeURIComponent(source.tab)}`;
      if (source.tq)  url += `&tq=${encodeURIComponent(source.tq)}`;
      global[cbName] = function (resp) {
        delete global[cbName];
        if (script.parentNode) script.parentNode.removeChild(script);
        if (!resp || resp.status === 'error') { reject(resp ? resp.errors : 'no response'); return; }
        resolve(resp.table);
      };
      const script = document.createElement('script');
      script.src = url;
      script.onerror = () => { delete global[cbName]; reject('Network error loading ' + tag); };
      document.head.appendChild(script);
    });
  }

  function mergeGvizTables(tables) {
    if (!tables.length) return { cols: [], rows: [] };
    return {
      cols: tables[0].cols,
      rows: tables.flatMap(t => t.rows || []),
    };
  }

  // =========================================================================
  // Supabase -> gviz-shape
  // =========================================================================

  function toGvizDateString(val) {
    if (!val) return null;
    // Supabase gives ISO date (YYYY-MM-DD) or ISO datetime. Extract Y/M/D.
    const m = String(val).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1; // gviz uses 0-indexed months
    const d = parseInt(m[3], 10);
    return { v: `Date(${y},${mo},${d})`, f: `${m[2]}/${m[3]}/${m[1]}` };
  }

  function rowsToGviz(supaRows, columns) {
    const cols = columns.map((c, i) => ({
      id: String.fromCharCode(65 + (i % 26)),
      label: c.label,
      type: c.type,
    }));
    const rows = supaRows.map((r) => {
      const c = columns.map((col) => {
        let v = r[col.field];
        if (col.transform) v = col.transform(v);
        if (v === null || v === undefined) return { v: null };
        if (col.type === 'date') {
          const d = toGvizDateString(v);
          return d || { v: null };
        }
        if (col.type === 'number') {
          const n = typeof v === 'number' ? v : parseFloat(v);
          return isNaN(n) ? { v: null } : { v: n, f: String(v) };
        }
        if (col.type === 'boolean') {
          return { v: !!v };
        }
        return { v: String(v) };
      });
      return { c };
    });
    return { cols, rows };
  }

  // =========================================================================
  // Public API: fetchTable
  // =========================================================================

  async function fetchTable(logicalName, opts = {}) {
    const mode = opts.mode || getMode();
    const conf = CONFIG[logicalName];
    if (!conf) throw new Error('Unknown logical table: ' + logicalName);

    if (mode === 'sheets') {
      if (!conf.sheets || !conf.sheets.length) {
        throw new Error(`Logical table '${logicalName}' has no sheets source; pick dev or prod mode`);
      }
      const tables = await Promise.all(conf.sheets.map(s => fetchSheetGviz(s.sheetId, s)));
      return mergeGvizTables(tables);
    }

    // dev or prod
    const sc = conf.supabase;
    if (!sc) throw new Error(`Logical table '${logicalName}' has no supabase source`);
    const client = await getSupabaseClient(mode);
    let query = client.from(sc.table).select(sc.select || '*');
    // Handle common filters from opts
    if (opts.filters) {
      for (const [col, val] of Object.entries(opts.filters)) {
        query = query.eq(col, val);
      }
    }
    // Pagination loop — Supabase caps responses at 1000 rows per request
    const all = [];
    const pageSize = 1000;
    let page = 0;
    while (true) {
      const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
      if (error) throw error;
      if (!data || !data.length) break;
      all.push(...data);
      if (data.length < pageSize) break;
      page++;
    }
    return rowsToGviz(all, sc.columns);
  }

  // =========================================================================
  // Toggle UI
  // =========================================================================

  function renderModeToggle(container, opts = {}) {
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) return;
    const current = getMode();
    container.style.cssText = (container.style.cssText || '') + `;display:inline-flex;align-items:center;gap:4px;margin-left:8px;`;
    container.innerHTML = '';
    const sel = document.createElement('select');
    sel.title = 'Data source';
    sel.style.cssText = 'background:#111;color:#bbb;border:1px solid #333;padding:2px 6px;font-size:0.72rem;border-radius:3px;cursor:pointer;';
    VALID_MODES.forEach(m => {
      const o = document.createElement('option');
      o.value = m;
      o.textContent = m;
      if (m === current) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => setMode(sel.value));
    container.appendChild(sel);
  }

  /**
   * Inject a toggle next to an existing element (e.g. version stamp).
   * Calls renderModeToggle into a new span appended after targetEl.
   */
  function attachToggleAfter(targetEl) {
    if (typeof targetEl === 'string') targetEl = document.getElementById(targetEl);
    if (!targetEl) return;
    const span = document.createElement('span');
    span.id = 'ds-mode-toggle';
    targetEl.parentNode.insertBefore(span, targetEl.nextSibling);
    renderModeToggle(span);
    return span;
  }

  // Parent-index helper: if we're inside an iframe, ensure the iframe URL
  // carries ?src= so child pages read the same mode.
  function propagateToIframes(mode) {
    document.querySelectorAll('iframe').forEach(frame => {
      const src = frame.getAttribute('src');
      if (!src) return;
      try {
        const u = new URL(src, window.location.href);
        u.searchParams.set('src', mode);
        frame.setAttribute('src', u.toString());
      } catch (_) { /* ignore */ }
    });
  }

  // =========================================================================
  // Export
  // =========================================================================

  global.DataSource = {
    fetchTable,
    getMode,
    setMode,
    renderModeToggle,
    attachToggleAfter,
    propagateToIframes,
    CONFIG, // exposed for debugging / extensions
    SUPABASE_PROJECTS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
