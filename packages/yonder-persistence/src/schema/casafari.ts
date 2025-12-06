/**
 * Casafari Schema - Raw Casafari data and plot fetch logs
 */
import {
  pgTable,
  serial,
  text,
  bigint,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// Raw Casafari bubble plots - imported from external source
export const rawCasafariBubblePlots = pgTable(
  "raw_casafari_bubble_plots",
  {
    accessCondition: text("Access condition"),
    accessFrontages: text("Access Frontages"),
    buildability: text("Buildability"),
    buildableSurfaceArea: text("Buildable surface area"),
    casafariDescription: text("Casafari Description"),
    casafariEmail: text("Casafari Email"),
    casafariImagesCached: text("Casafari Images Cached?"),
    casafariPhoneNumber: text("Casafari Phone Number"),
    casafariPropertyId: bigint("Casafari Property ID", {
      mode: "number",
    }).notNull(),
    city: text("City"),
    deleteListingId: text("Delete Listing ID"),
    distanceTown: text("Distance Town"),
    externalPlatformLink: text("External Platform Link"),
    homes: text("Homes"),
    hubspotListingId: text("Hubspot Listing ID"),
    images: text("Images"),
    lastSubscriptionUpdate: text("Last Subscription Update"),
    legalAccess: text("Legal Access"),
    location: text("Location"),
    maxFloorBuilt: text("Max Floor Built"),
    owner: text("Owner"),
    plotSize: text("Plot size"),
    price: text("Price"),
    roadAccess: text("Road Access"),
    source: text("Source"),
    status: text("Status"),
    subscriptionStatus: text("Subscription Status"),
    summary: text("Summary"),
    totalSurfaceArea: text("Total surface area"),
    triggerOneTimeSupabaseSync: text("Trigger One time Supabase Sync?"),
    type: text("Type"),
    typeOfLand: text("Type of land"),
    utilities: text("Utilities"),
    verificationStatus: text("Verification Status"),
    zoning: text("Zoning"),
    creationDate: text("Creation Date"),
    modifiedDate: text("Modified Date"),
    slug: text("Slug"),
    creator: text("Creator"),
    uniqueId: text("unique id").notNull(),
  },
  (table) => [
    index("idx_raw_casafari_casafari_property_id").using(
      "btree",
      table.casafariPropertyId
    ),
    index("idx_raw_casafari_unique_id").using("btree", table.uniqueId),
    index("idx_raw_casafari_status").using("btree", table.status),
    index("idx_raw_casafari_city").using("btree", table.city),
  ]
);

// Plot fetch logs - tracks when plots were fetched for locations
export const plotFetchLogs = pgTable(
  "plot_fetch_logs",
  {
    id: serial().primaryKey().notNull(),
    locationId: integer("location_id").notNull(),
    plotsFound: integer("plots_found").notNull(),
    jobId: text("job_id"),
    searchParams: jsonb("search_params"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
  },
  (table) => [
    index("plot_fetch_logs_created_at_idx").using(
      "btree",
      table.createdAt.asc().nullsLast().op("timestamptz_ops")
    ),
    index("plot_fetch_logs_location_id_idx").using(
      "btree",
      table.locationId.asc().nullsLast().op("int4_ops")
    ),
  ]
);

// Type exports
export type RawCasafariBubblePlot = typeof rawCasafariBubblePlots.$inferSelect;
export type NewRawCasafariBubblePlot = typeof rawCasafariBubblePlots.$inferInsert;
export type PlotFetchLog = typeof plotFetchLogs.$inferSelect;
export type NewPlotFetchLog = typeof plotFetchLogs.$inferInsert;
