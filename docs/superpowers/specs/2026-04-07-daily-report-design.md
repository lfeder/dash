# Daily Report Page — Design Spec

## Overview

A new "Daily" page in the farm dashboard showing a daily sales summary, weekly dollar chart, and greenhouse harvest tables for cuke and lettuce. Light/cream theme with green header.

## Data Sources

### Invoices
- **Sheet**: `124y8JdWXmbf_hb1vfimHmGaKLVXrRHybw02w_ozCExE`
- **Tabs**: `invoices_23-25` (gid `1254110782`), `invoices_2025` (gid `544460225`)
- **Fields used**: `InvoiceDate`, `Dollars`, `Farm` (Cuke/Lettuce), `Year`, `Month`, `DOW`, `ISOYear`, `ISOWeek`, `_md` (month×100+day, parsed from InvoiceDate)
- **Fetch method**: JSONP via gviz API (same as sales/index.html)

### Cuke Grow
- **Sheet**: `1VtEecYn-W1pbnIU1hRHfxIpkH2DtK7hj0CpcpiLoziM`
- **Tab**: `grow_C_harvest`
- **Fields**: `HarvestDate` (col A), `Greenhouse` (need to identify column), `Variety` (col H — K/J/E), `Grade` (col I — 1 or 2), `GreenhouseNetWeight` (col L — pounds)
- **Fetch method**: JSONP via gviz API

### Lettuce Grow
- **Sheet**: `1VtEecYn-W1pbnIU1hRHfxIpkH2DtK7hj0CpcpiLoziM`
- **Tab**: `grow_L_seeding`
- **Fields**: `HarvestDate` (col N), `Pond`, `Variety` (col D), `Boards`, `GreenhouseNetWeight` (col P — pounds)
- **Fetch method**: JSONP via gviz API

## Reference Date

- **Today** = current date in HST (UTC-10)
- **Yesterday** = Today minus 1 day
- Toggle button switches between the two; all sections recompute using the selected reference date
- Default: Today

## Sections

### 1. Header
- Green (#4ecca3 or similar green from screenshots) header bar
- Title: "Daily" in bold white/dark text
- Version stamp upper right

### 2. Date & Toggle
- Display: "April 7, 2026" (reference date, formatted)
- Two buttons: "Today" (active/highlighted) and "Yesterday"

### 3. Sales $ Summary Table

| $ (000) | TDY | WTD | MTD | YTD | LYTD | Chg |
|---------|-----|-----|-----|-----|------|-----|
| Cuke    |     |     |     |     |      |     |
| Lettuce |     |     |     |     |      |     |
| Total   |     |     |     |     |      |     |

- All values = `sum(Dollars) / 1000`, rounded to integers
- **TDY**: invoices where InvoiceDate matches reference date
- **WTD**: invoices in the same ISO week as reference date, up to and including reference date
- **MTD**: invoices in the same month as reference date, up to and including reference date
- **YTD**: invoices in 2026, up to and including reference date
- **LYTD**: invoices in 2025, up to and including the same calendar day (month/day) in 2025
- **Chg**: `(YTD - LYTD) / LYTD` as a percentage with % symbol
- When Yesterday is selected, all periods shift back one day

### 4. Weekly $ (000) Chart

- Chart.js line chart
- X-axis: week numbers 1–52
- Y-axis: dollars in thousands
- One line per weekday: Mon, Tue, Wed, Thu, Fri
- Each data point: total dollars (Cuke + Lettuce) for that weekday in that week, divided by 1000
- Data from 2026 invoices only
- Title: "Weekly $ (000)"
- Weekday colors: distinct colors matching screenshot (Mon=red, Tue=blue, Wed=green, Thu=orange, Fri=gray)

### 5. Cuke Pounds Table

| GH | Day | K1 | J1 | E1 | K2 | J2 | E2 | Total | % OG |
|----|-----|----|----|----|----|----|----|----|------|

- **GH**: greenhouse identifier from grow_C_harvest data
- **Day**: total harvest pounds for that greenhouse on the reference date (all varieties/grades)
- **K1/J1/E1**: Keiki/Japanese/English Grade 1 pounds on reference date
- **K2/J2/E2**: Keiki/Japanese/English Grade 2 pounds on reference date
- **Total**: sum of K1+J1+E1+K2+J2+E2
- **% OG**: (sum of Grade 2) / (sum of Grade 1 + Grade 2), displayed as percentage
- **Total row**: column sums, with % OG calculated from totals
- Rows sorted by greenhouse name

### 6. Lettuce Pounds Table

| Pond | Variety | Boards | Lb/Board | Total |
|------|---------|--------|----------|-------|

- One row per pond from grow_L_seeding for the reference date
- **Pond**: pond identifier
- **Variety**: lettuce variety name
- **Boards**: number of boards harvested
- **Lb/Board**: `GreenhouseNetWeight / Boards`
- **Total**: `GreenhouseNetWeight` (total pounds)
- **Total row**: sum of Boards, weighted average Lb/Board, sum of Total

## Styling

- **Background**: light/cream (#f5f0eb or similar warm beige from screenshots)
- **Header bar**: green (#4a8c5c or similar muted green from screenshots)
- **Table styling**: clean, minimal borders, left-aligned text columns, right-aligned number columns
- **Chart**: Chart.js with light theme, legend with colored dots for each weekday
- **Font**: system font stack (same as other pages)
- **Responsive**: single-column layout, scrollable

## File Structure

- New file: `daily/index.html` (single-file page, all CSS/JS inline — matches project convention)
- Update: `index.html` (add "Daily" tab to navigation)

## Non-Goals

- Pathogen-free / CA banner (explicitly deferred)
- Dark theme (this page uses light theme per mockup)
- Caching / pre-fetched JSON (fetch live like sales page)
