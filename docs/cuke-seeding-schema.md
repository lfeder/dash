# Cuke Seeding & Plant Map Schema

Status: **in review**

Supabase projects: dev `kfwqtaazdankxmdlqdak`, prod `zdvpqygiqavwpxljpvqw`.

---

## Why fork cuke seeding from lettuce?

Cuke and lettuce currently share `grow_seed_batch` (660 cuke rows, 5,674 lettuce rows). This proposal creates a separate `grow_cuke_seed_batch` table for cuke, leaving lettuce untouched on `grow_seed_batch`.

**The reason to split the table:**

- **7 of 25 columns are unused or forced for cuke.** `grow_cycle_pattern_id`, `grow_seed_mix_id`, `invnt_lot_id`, and `number_of_rows` are always null or sentinel values (`-1`) for cuke. `transplant_date` and `estimated_harvest_date` are `NOT NULL` in the schema but are lettuce concepts — cuke rows hold dummy values to satisfy the constraint.

- **Missing variety reference.** `grow_seed_batch` has `invnt_item_id` (the specific cultivar like `delta_star_minis_rz`) but no FK to `grow_variety` (`k`/`j`/`e`). You can't group "all Keiki batches" without inspecting the seed item name. The `grow_variety` table exists — it just wasn't wired into the seeding table. The new cuke table fixes this.

- **Cuke needs fields lettuce doesn't.** Cuke seeding requires snapshot fields from the plant map (`rows_4_per_bag`, `rows_5_per_bag`, `seeds`) to freeze per-cycle totals at seeding time. Lettuce doesn't use a plant map. Adding these to the shared table would mean more irrelevant columns for lettuce.

- **Different units and semantics.** Lettuce seeds in boards, cuke seeds in bags. Lettuce uses seed mixes, cuke never does. Lettuce has 19 trial types, cuke has one catch-all. The tables serve different workflows.

**What stays shared:** `org_site` (greenhouses), `grow_variety` (K/J/E + new Trial entry), `invnt_item` (seed cultivars). Only the seeding event table forks.

**Note on lettuce and variety:** Lettuce *does* use varieties — `grow_variety` has 22 lettuce entries, and the lettuce sheet has a `variety` column. The flaw is that `grow_seed_batch` never got a `grow_variety_id` FK wired in, so today both lettuce and cuke have to infer variety from the seed item name. The new cuke table fixes this for cuke; backfilling `grow_seed_batch` for lettuce is a separate question (see Questions for Michael #2).

**Migration path:** The 660 existing cuke rows in `grow_seed_batch` get transformed into `grow_cuke_seed_batch` rows. After migration, cuke rows in `grow_seed_batch` are soft-deleted. Lettuce rows remain untouched — no changes to lettuce workflows.

---

## Questions for Michael

1. **Batch code format.** Current convention in `grow_seed_batch` is `YYMMDD[GH]<variety><P|T>` (e.g. `260406KP`, `260406HIKP`, `260406ET`). Variety letter and P/T suffix are redundant — variety is stored in `grow_variety_id`, and trial is `grow_variety_id = 't'`. Can we remove? Need to agree on the new convention since `batch_code` is globally unique.

2. **`grow_variety_id` missing from `grow_seed_batch`.** The original `grow_seed_batch` table has `invnt_item_id` (specific cultivar like `delta_star_minis_rz`) but no FK to `grow_variety` (the `k`/`j`/`e` lookup table that already exists). This means you can't group "all Keiki batches" without inspecting the seed item. The new cuke seeding table fixes this by including `grow_variety_id`. Should we also backfill `grow_seed_batch` with a `grow_variety_id` column for lettuce, or leave that for later?

3. **HK (Hamakua-Kohala).** `org_site` has `hk` as a single site; physically there are two greenhouses. Should we split `hk` into separate `hamakua` and `kohala` rows in `org_site`, or keep `hk` as one site and distinguish the two structures via `block_num` on `org_site_gh_row`? Splitting is cleaner long-term but requires backfilling existing `grow_seed_batch` references.

---

## Table summary

| Table | Purpose | Crop scope | Rows (est.) |
|---|---|---|---|
| `org_site_gh` | GH-level layout + grid placement | generic | ~13 |
| `org_site_gh_block` | Block row ranges + render direction | generic | ~25 |
| `org_site_gh_row` | Physical row infrastructure | generic | ~660 |
| `grow_cuke_seed_batch` | Seeding events + forward plans | cuke | ~1,160 |
| `grow_cuke_gh_row_planting` | What's planted in each row (current/planned) | cuke | ~1,320 |

---

## Table 1: `org_site_gh`

Greenhouse-level layout and display configuration. Hangs under `org_site`. One row per greenhouse. Not cuke-specific — any activity (scouting, maintenance, spraying) that renders a GH reads this.

**Grain**: one row per greenhouse.

### DDL

```sql
create table org_site_gh (
  site_id            text        primary key references org_site(id),
  org_id             text        not null,
  farm_section       text        not null,
  rows_orientation   text        not null check (rows_orientation in ('vertical','horizontal')),
  sidewalk_position  text        not null check (sidewalk_position in ('middle','top','bottom','left','right','none')),
  blocks_vertical    boolean     not null default false,
  layout_grid_row    int         not null,
  layout_grid_col    int         not null,
  layout_stack_pos   int,
  created_at         timestamptz not null default now(),
  created_by         text,
  updated_at         timestamptz not null default now(),
  updated_by         text,
  is_deleted         boolean     not null default false
);
```

### Column comments

```sql
comment on table org_site_gh is
  'Greenhouse-level layout and display config. One row per greenhouse. Extends org_site with GH-specific rendering attributes used by the plant-map dashboard and any other GH-aware feature.';

comment on column org_site_gh.site_id is
  'References org_site. One config per greenhouse';
comment on column org_site_gh.farm_section is
  'Farm area: JTL or BIP. Labels the farm region for display';
comment on column org_site_gh.rows_orientation is
  'vertical = rows run top-to-bottom; horizontal = rows run left-to-right';
comment on column org_site_gh.sidewalk_position is
  'Where the sidewalk renders in the GH visual: middle, top, bottom, left, right, or none. Dashboard renders sidewalks in grey';
comment on column org_site_gh.blocks_vertical is
  'If true, the renderer stacks blocks vertically instead of placing them side-by-side';
comment on column org_site_gh.layout_grid_row is
  'Dashboard grid row position. Controls top/bottom placement. GHs with lower values render higher on the dashboard. All GHs in the same grid row render at the same pixel height';
comment on column org_site_gh.layout_grid_col is
  'Dashboard grid column position. Controls left/right placement. JTL houses have lower values, BIP houses have higher values';
comment on column org_site_gh.layout_stack_pos is
  'When multiple GHs share the same (grid_row, grid_col), this orders them within the shared cell. Null when no stacking';
```

### Seed data

Populated from the existing `GH_CONFIG` constant in `dash/plant-map/index.html`. ~13 rows (one per greenhouse).

### Derivation notes

- **Seeding rotation order**: not stored here. Derived from `grow_cuke_seed_batch.seeding_date` ordering.
- **Height alignment**: all GHs with the same `layout_grid_row` render at the same pixel height — no explicit `height_group` column needed.

---

## Table 2: `org_site_gh_block`

Block definitions per greenhouse. A block is a visually contiguous group of rows rendered together on the dashboard; sidewalks render between blocks. Also controls render direction within the block (rows drawn by ascending or descending `row_num`).

**Grain**: `(site_id, block_num)`.

### DDL

```sql
create table org_site_gh_block (
  id             uuid        primary key default gen_random_uuid(),
  org_id         text        not null,
  site_id        text        not null references org_site(id),
  block_num      int         not null,
  row_num_from   int         not null,
  row_num_to     int         not null,
  direction      text        not null check (direction in ('forward','reverse')),
  created_at     timestamptz not null default now(),
  created_by     text,
  updated_at     timestamptz not null default now(),
  updated_by     text,
  is_deleted     boolean     not null default false,
  unique (site_id, block_num)
);

create index on org_site_gh_block (site_id);
```

### Column comments

```sql
comment on table org_site_gh_block is
  'Block definitions per greenhouse. A block is a visually contiguous group of rows rendered together on the dashboard. Sidewalks render between blocks. GHs with no side divisions have a single block covering all rows';

comment on column org_site_gh_block.site_id is
  'Greenhouse. References org_site';
comment on column org_site_gh_block.block_num is
  'Block sequence (1, 2, 3...). The dashboard renders blocks in ascending block_num, with sidewalks between them';
comment on column org_site_gh_block.row_num_from is
  'First row_num in this block (inclusive). Block membership is defined by row_num range: a row belongs to the block where row_num_from <= row_num <= row_num_to';
comment on column org_site_gh_block.row_num_to is
  'Last row_num in this block (inclusive)';
comment on column org_site_gh_block.direction is
  'forward = rows render in ascending row_num order within the block. reverse = rows render in descending row_num order';
```

---

## Table 3: `org_site_gh_row`

Physical greenhouse row infrastructure. One table row per physical GH row. Crop-agnostic and rendering-agnostic — referenced by any row-level activity (seeding, scouting, maintenance, spraying). Block membership and render order are defined in `org_site_gh_block` via row_num ranges.

**Grain**: `(site_id, row_num)` — unique within GH.

### DDL

```sql
create table org_site_gh_row (
  id                uuid        primary key default gen_random_uuid(),
  org_id            text        not null,
  site_id           text        not null references org_site(id),
  row_num           int         not null,
  num_bags_capacity int         not null,
  notes             text,
  created_at        timestamptz not null default now(),
  created_by        text,
  updated_at        timestamptz not null default now(),
  updated_by        text,
  is_deleted        boolean     not null default false,
  unique (site_id, row_num)
);
```

### Column comments

```sql
comment on table org_site_gh_row is
  'Physical greenhouse row infrastructure. One row per physical GH row. Crop-agnostic and rendering-agnostic — referenced by seeding, scouting, maintenance, and spraying activities when they target a specific row. Block membership and render order are defined in org_site_gh_block';

comment on column org_site_gh_row.site_id is
  'Greenhouse. References org_site';
comment on column org_site_gh_row.row_num is
  'Physical row number. Unique within a greenhouse. Used on labels and for crew navigation. Block membership is derived by joining to org_site_gh_block on site_id where row_num is between row_num_from and row_num_to';
comment on column org_site_gh_row.num_bags_capacity is
  'Maximum number of grow bags that physically fit in this row. Rows are always planted to full capacity. When a row is split between two varieties, each variety occupies capacity/2 bags';
comment on column org_site_gh_row.notes is
  'Row-specific notes (e.g. known irrigation issue, damaged bay)';
```

---

## Table 4: `grow_cuke_seed_batch`

One row per variety per seeding event at a greenhouse. Holds past cycles and forward-planned cycles. Snapshot fields (`rows_4_per_bag`, `rows_5_per_bag`, `seeds`) are populated from the plant map at seeding time and are not recomputed if the plant map changes later.

**Grain**: `(site_id, seeding_date, grow_variety_id)`.

### DDL

```sql
create table grow_cuke_seed_batch (
  id                   uuid        primary key default gen_random_uuid(),
  org_id               text        not null,
  batch_code           text        not null unique,
  site_id              text        not null references org_site(id),
  grow_variety_id      text        not null references grow_variety(id),
  seeding_date         date        not null,
  transplant_date      date,
  next_bag_change_date date,
  rows_4_per_bag       int         not null default 0,
  rows_5_per_bag       int         not null default 0,
  seeds                int         not null,
  notes                text,
  created_at           timestamptz not null default now(),
  created_by           text,
  updated_at           timestamptz not null default now(),
  updated_by           text,
  is_deleted           boolean     not null default false
);

create index on grow_cuke_seed_batch (site_id, seeding_date);
create index on grow_cuke_seed_batch (seeding_date);
create index on grow_cuke_seed_batch (seeding_date, grow_variety_id);
```

### Column comments

```sql
comment on table grow_cuke_seed_batch is
  'Cuke seeding cycle record. One row per variety per greenhouse per seeding event. Holds historical and forward-planned cycles. Snapshot fields are frozen at seeding time from the plant map';

comment on column grow_cuke_seed_batch.batch_code is
  'Globally unique traceability code. Current format: YYMMDD[GH]<variety><P|T> — format under review (see Questions for Michael #1)';
comment on column grow_cuke_seed_batch.site_id is
  'Greenhouse. References org_site where subcategory = greenhouse';
comment on column grow_cuke_seed_batch.grow_variety_id is
  'Cuke variety: k (Keiki), j (Japanese), e (English), t (Trial). References grow_variety';
comment on column grow_cuke_seed_batch.seeding_date is
  'Actual planting date. For future cycles this is the planned date. Dashboard derives ISO week from this';
comment on column grow_cuke_seed_batch.transplant_date is
  'Planned or actual date transplant crew moves seedlings into the greenhouse';
comment on column grow_cuke_seed_batch.next_bag_change_date is
  'When bags get swapped for this cycle. Null if not yet scheduled';
comment on column grow_cuke_seed_batch.rows_4_per_bag is
  'Snapshot: number of physical GH rows at 4 plants per bag for this variety this cycle. Populated from plant map at seeding time';
comment on column grow_cuke_seed_batch.rows_5_per_bag is
  'Snapshot: number of physical GH rows at 5 plants per bag for this variety this cycle. Populated from plant map at seeding time';
comment on column grow_cuke_seed_batch.seeds is
  'Snapshot: total seeds sown for this variety this cycle. Calculated at seeding time from the plant map';
```

### Derived fields (no column needed)

- **Total rows per variety** = `rows_4_per_bag + rows_5_per_bag`
- **Status** = derived from `seeding_date`, `transplant_date`, `next_bag_change_date` vs today

### Comparison vs existing `grow_seed_batch` (dev `kfwqtaazdankxmdlqdak`)

Column-by-column diff. `grow_seed_batch` has 25 cols (20 real + 5 audit); `grow_cuke_seed_batch` has 17 cols (12 real + 5 audit).

| `grow_seed_batch` | `grow_cuke_seed_batch` | Change | Why |
|---|---|---|---|
| `id` uuid pk | `id` uuid pk | same | — |
| `org_id` text not null | `org_id` text not null | same | — |
| `farm_id` text not null | — | **dropped** | Table name is crop-scoped; always `'cuke'` |
| `site_id` text nullable | `site_id` text **not null** | tightened | Cuke always seeded at a known GH |
| `ops_task_tracker_id` uuid | — | **dropped** | Not used for cuke |
| `batch_code` text not null unique | `batch_code` text not null unique | same | Format under review (Q #1) |
| `grow_cycle_pattern_id` text | — | **dropped** | Always null for cuke |
| `grow_trial_type_id` text | — | **dropped** | Replaced by `grow_variety_id = 't'` |
| `grow_seed_mix_id` text | — | **dropped** | Cuke never uses seed mixes |
| `invnt_item_id` text | — | **dropped** | Cultivar not tracked at batch level for cuke |
| `invnt_lot_id` text | — | **dropped** | Depends on `invnt_item_id` |
| — | `grow_variety_id` text not null FK | **added** | Missing from `grow_seed_batch`; enables variety grouping |
| `seeding_uom` text not null | — | **dropped** | Cuke unit is always bags (implicit) |
| `number_of_units` int not null | — | **dropped** | Replaced by `rows_4_per_bag` + `rows_5_per_bag` + `seeds` snapshot |
| `seeds_per_unit` int not null | — | **dropped** | Same — snapshot replaces computation |
| `number_of_rows` int not null | — | **dropped** | Replaced by `rows_4_per_bag + rows_5_per_bag` (derived) |
| — | `rows_4_per_bag` int not null default 0 | **added** | Snapshot from plant map at seeding time |
| — | `rows_5_per_bag` int not null default 0 | **added** | Snapshot from plant map at seeding time |
| — | `seeds` int not null | **added** | Snapshot; frozen so plant-map edits don't alter history |
| `seeding_date` date not null | `seeding_date` date not null | same | — |
| `transplant_date` date **not null** | `transplant_date` date **nullable** | relaxed | Cuke doesn't always have a planned transplant date |
| `estimated_harvest_date` date not null | — | **dropped** | Lettuce concept; cuke harvests continuously |
| — | `next_bag_change_date` date | **added** | Cuke-specific bag-swap scheduling |
| `status` text not null | — | **dropped** | Derived from dates |
| `notes` text | `notes` text | same | — |
| audit (5 cols) | audit (5 cols) | same | `created_at/by`, `updated_at/by`, `is_deleted` |

**Net:** 11 columns dropped, 5 added, 2 modified (nullability). 7 of the dropped columns were null/sentinel for every existing cuke row in `grow_seed_batch`.

### Seed data needed

```sql
insert into grow_variety (id, name, farm_id)
values ('t', 'Trial', 'cuke')
on conflict do nothing;
```

---

## Table 5: `grow_cuke_gh_row_planting`

What cuke variety is planted in each physical GH row. One row per `(site_gh_row, scenario)`. Two scenarios: `current` (active layout the crew follows) and `planned` (proposed future layout).

**Convention**: rows are always planted to full capacity. When a row is split between two varieties, the split is always 50/50 (each variety gets capacity/2 bags). Plants per bag (4 or 5) is uniform across the entire row, including both varieties in a split.

**Grain**: `(site_gh_row_id, scenario)`.

### DDL

```sql
create table grow_cuke_gh_row_planting (
  id                 uuid        primary key default gen_random_uuid(),
  org_id             text        not null,
  site_gh_row_id     uuid        not null references org_site_gh_row(id) on delete cascade,
  scenario           text        not null check (scenario in ('current','planned')),
  grow_variety_id    text        not null references grow_variety(id),
  grow_variety_id_2  text        references grow_variety(id),
  plants_per_bag     int         not null check (plants_per_bag in (4, 5)),
  notes              text,
  created_at         timestamptz not null default now(),
  created_by         text,
  updated_at         timestamptz not null default now(),
  updated_by         text,
  is_deleted         boolean     not null default false,
  unique (site_gh_row_id, scenario)
);

create index on grow_cuke_gh_row_planting (scenario);
```

### Column comments

```sql
comment on table grow_cuke_gh_row_planting is
  'Cuke planting assignment per physical GH row. Two scenarios per row: current (live layout the transplant crew follows) and planned (proposed future layout for review). Rows are always planted to full capacity; split rows are always 50/50';

comment on column grow_cuke_gh_row_planting.site_gh_row_id is
  'The physical row. References org_site_gh_row';
comment on column grow_cuke_gh_row_planting.scenario is
  'current = live layout. planned = proposed future layout. Exactly one row per (site_gh_row, scenario)';
comment on column grow_cuke_gh_row_planting.grow_variety_id is
  'Primary variety planted in this row. If grow_variety_id_2 is null, this variety fills the entire row (num_bags = site_gh_row.num_bags_capacity). If split, this variety occupies 50% (num_bags = capacity / 2)';
comment on column grow_cuke_gh_row_planting.grow_variety_id_2 is
  'Second variety when the row is split. Row is split 50/50: each variety occupies capacity/2 bags. Null for non-split rows';
comment on column grow_cuke_gh_row_planting.plants_per_bag is
  'Plants per bag: 4 or 5. Applies uniformly across the entire row, including both varieties in a split';
```

### Derived view

```sql
create view grow_cuke_gh_row_planting_v as
select
  p.id,
  p.site_gh_row_id,
  p.scenario,
  r.site_id,
  r.row_num,
  b.block_num,
  b.direction,
  p.grow_variety_id,
  p.grow_variety_id_2,
  p.plants_per_bag,
  case when p.grow_variety_id_2 is null
       then r.num_bags_capacity
       else r.num_bags_capacity / 2
  end                                       as bags_primary,
  case when p.grow_variety_id_2 is null
       then 0
       else r.num_bags_capacity / 2
  end                                       as bags_secondary,
  r.num_bags_capacity * p.plants_per_bag    as total_plants,
  p.grow_variety_id_2 is not null           as is_split
from grow_cuke_gh_row_planting p
join org_site_gh_row r on r.id = p.site_gh_row_id
left join org_site_gh_block b
  on b.site_id = r.site_id
 and r.row_num between b.row_num_from and b.row_num_to;
```

---

## Migration plan

### Step 1: Insert `Trial` variety

```sql
insert into grow_variety (id, name, farm_id)
values ('t', 'Trial', 'cuke')
on conflict do nothing;
```

### Step 2: Fix GH5 row numbering

The plant-map sheet has GH5 row 43 appearing on both Middle and South — a data mistake. The Middle section should be rows 22–42. Fix before migration:

```
Before: GH5 Middle has ..., 42, 43 and GH5 South starts at 43
After:  GH5 Middle ends at 42; GH5 South starts at 43
```

### Step 3: Populate `org_site_gh`

Source: `GH_CONFIG` constant in `dash/plant-map/index.html`. 13 rows.

| GH_CONFIG key | → | `org_site_gh` |
|---|---|---|
| GH name → `site_id` | (map GH1→01, Kona→ko, etc.) |
| `group` | → | `farm_section` (JTL or BIP) |
| `vert: true/false` | → | `rows_orientation` (`vertical` / `horizontal`) |
| `sidewalk` | → | `sidewalk_position` |
| `stackSections` | → | `blocks_vertical` |
| `layout[0]` | → | `layout_grid_row` |
| `layout[1]` | → | `layout_grid_col` |
| `layout[2]` (if present) | → | `layout_stack_pos` |

Dropped: `heightGroup` (derivable from `layout_grid_row`), `merge` (dropped — GH7/GH8 just become single-block), `sideOrder` (replaced by `block_num` on the row table).

### Step 4: Populate `org_site_gh_block`

Source: plant-map Google Sheet, grouping rows by `Greenhouse` + `Side` to derive each block's `(row_num_from, row_num_to, direction)`.

For each (GH, Side) combination:
- `row_num_from` = min(Row) within the group
- `row_num_to` = max(Row) within the group
- `direction` = `forward` if the sheet's `Order` ascends with `row_num`, `reverse` if `Order` ascends as `row_num` descends
- `block_num` = position in the sheet's side order for that GH (e.g. North=1, Middle=2, South=3)

GHs with merged or single-section rendering (GH7, GH8, Hamakua) get a single block covering all rows.

### Step 5: Populate `org_site_gh_row`

Source: plant-map Google Sheet `1ewWyvaXGkRCvZxjUxBOHGY4PKdMHwKeTA5jTIod48LE` gid `1615707612`. ~660 rows.

| Sheet column | → | `org_site_gh_row` |
|---|---|---|
| `Greenhouse` | → | `site_id` |
| `Row` | → | `row_num` |
| `Bags_per_row` + `Bags_per_row2` (sum) | → | `num_bags_capacity` |

### Step 6: Verify 50/50 split rule before populating `grow_cuke_gh_row_planting`

Before inserting planting rows, run this check against the sheet:

```python
# Pseudo: for each sheet row where Variety2 is set (row is split)
for row in sheet.rows:
    if row.variety_2:
        if row.bags_per_row != row.bags_per_row_2:
            print(f"SPLIT MISMATCH: {row.greenhouse} row {row.row_num}: "
                  f"{row.bags_per_row} vs {row.bags_per_row_2}")
```

Any row flagged by this check needs to be resolved with the user before migration:
- If it's a data entry error, correct it in the sheet first
- If it's intentional (non-50/50 split), we need to extend the schema to allow arbitrary splits

### Step 7: Populate `grow_cuke_gh_row_planting`

| Sheet column | → | `grow_cuke_gh_row_planting` |
|---|---|---|
| `Variety` | → | `grow_variety_id` (map Keiki→k, Japanese→j, English→e) |
| `Variety2` | → | `grow_variety_id_2` (null if empty) |
| `Plants_per_Bag` | → | `plants_per_bag` |

All imported rows get `scenario = 'current'`. The sheet's `Variety2`/`Bags_per_row2` columns imply a `planned` scenario too — those will be imported as a second row with `scenario = 'planned'` if they differ from the current values.

### Step 8: Populate `grow_cuke_seed_batch`

Source: 660 existing cuke rows in `grow_seed_batch` (for historical) and the `grow_C_seeding` sheet tab (for cross-check).

| `grow_seed_batch` | → | `grow_cuke_seed_batch` |
|---|---|---|
| `batch_code` | → | `batch_code` |
| `site_id` | → | `site_id` |
| `invnt_item_id` | → | `grow_variety_id` (derived: map each cultivar → variety) |
| `seeding_date` | → | `seeding_date` |
| `transplant_date` | → | `transplant_date` (if non-dummy) |
| `number_of_units × seeds_per_unit` | → | `seeds` |
| (plant map lookup at seeding_date) | → | `rows_4_per_bag`, `rows_5_per_bag` |

After migration, cuke rows in `grow_seed_batch` are soft-deleted (set `is_deleted = true`). Lettuce rows remain untouched.

### Step 9: Forward-load next year of seeding plans

Insert ~500 forward rows into `grow_cuke_seed_batch` covering the next 12 months of planned cycles per GH. Source: TBD — likely derived from the SIM_ORDER rotation and current bag-change cadence.

---

## Relationship diagram

```
org_site (existing)
  ├── org_site_gh.site_id
  ├── org_site_gh_block.site_id
  ├── org_site_gh_row.site_id
  │    └── grow_cuke_gh_row_planting.site_gh_row_id
  └── grow_cuke_seed_batch.site_id

grow_variety (existing, add 't'/Trial)
  ├── grow_cuke_seed_batch.grow_variety_id
  ├── grow_cuke_gh_row_planting.grow_variety_id
  └── grow_cuke_gh_row_planting.grow_variety_id_2
```

Block membership of a row is derived via join:
```sql
select r.*, b.block_num, b.direction
from org_site_gh_row r
join org_site_gh_block b
  on b.site_id = r.site_id
 and r.row_num between b.row_num_from and b.row_num_to;
```

---

## Column counts summary

| Table | Real cols | Audit cols | Total |
|---|---|---|---|
| `org_site_gh` | 9 | 5 | 14 |
| `org_site_gh_block` | 5 | 5 | 10 |
| `org_site_gh_row` | 5 | 5 | 10 |
| `grow_cuke_seed_batch` | 12 | 5 | 17 |
| `grow_cuke_gh_row_planting` | 6 | 5 | 11 |
