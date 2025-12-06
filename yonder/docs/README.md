# yonder-app

## Environment configuration

- **PLOTS_TABLE_ENV**: controls which physical tables the backend uses for plots data.
  - Allowed values: `prod` | `stage`
  - Default: `stage`
  - Mapping:
    - `prod` → `plts` and `plots_enriched`
    - `stage` → `plots_stage` and `enriched_plots_stage`

Set this in your environment (e.g. `.env`):

```env
PLOTS_TABLE_ENV=stage
```

The server resolves this in `yonder/src/server/db/schema.ts` and all queries import the `plots` and `enrichedPlots` objects from that schema, so no further changes are needed across routers.