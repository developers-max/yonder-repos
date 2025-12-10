/**
 * Plots Schema - Core plot and enriched plots table definitions
 * These are the shared tables used by both yonder-app and yonder-enrich
 */
import {
  pgTable,
  uuid,
  doublePrecision,
  text,
  geometry,
  numeric,
  boolean,
  bigint,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { municipalities } from "./municipalities";

// Environment configuration for table selection
const __plotsTableEnv = (process.env.PLOTS_TABLE_ENV || 'stage').toLowerCase();
const __useProdTables = __plotsTableEnv === 'prod';
const __plotsTableName = __useProdTables ? 'plots' : 'plots_stage';
const __enrichedPlotsTableName = __useProdTables ? 'enriched_plots' : 'enriched_plots_stage';

// Dynamic plots table (prod or stage based on env)
export const plots = pgTable(__plotsTableName, {
  id: uuid().defaultRandom().primaryKey().notNull(),
  latitude: doublePrecision().notNull(),
  longitude: doublePrecision().notNull(),
  environment: text().default('version-test').notNull(),
  geom: geometry({ type: "point", srid: 4326 }).generatedAlwaysAs(
    sql`st_setsrid(st_makepoint(longitude, latitude), 4326)`
  ),
  price: numeric({ precision: 10, scale: 2 }).default('0.00'),
  size: numeric(),
  enriched: boolean().default(false),
  casafariId: bigint("casafari_id", { mode: "number" }),
  // Listing information
  description: text(), // Description from casafari or owner
  timeInMarket: integer("time_in_market"), // Days on market
  status: text().default('active'), // Listing status: active, sold, pending, etc.
}, (table) => [
  index("idx_plots_size").using("btree", table.size.asc().nullsLast().op("numeric_ops")),
  index("plots_geom_idx").using("gist", table.geom.asc().nullsLast().op("gist_geometry_ops_2d")),
  index("idx_plots_enriched").using("btree", table.enriched),
  index("idx_plots_casafari_id").using("btree", table.casafariId),
]);

// Dynamic enriched plots table (prod or stage based on env)
export const enrichedPlots = pgTable(__enrichedPlotsTableName, {
  id: uuid().defaultRandom().primaryKey().notNull(),
  latitude: doublePrecision().notNull(),
  longitude: doublePrecision().notNull(),
  environment: text().default('version-test').notNull(),
  geom: geometry({ type: "point", srid: 4326 }).generatedAlwaysAs(
    sql`st_setsrid(st_makepoint(longitude, latitude), 4326)`
  ),
  price: numeric({ precision: 10, scale: 2 }).default('0.00'),
  size: numeric(),
  enrichmentData: jsonb("enrichment_data"),
  images: jsonb("images").$type<string[]>(),
  municipalityId: integer("municipality_id").references(() => municipalities.id),
  plotReportUrl: text("plot_report_url"),
  plotReportJson: jsonb("plot_report_json"),
  // Realtor-provided accurate location data
  realLatitude: doublePrecision("real_latitude"),
  realLongitude: doublePrecision("real_longitude"),
  realAddress: text("real_address"),
  // Claimed realtor contact info (set when realtor claims/accepts the plot)
  claimedByUserId: text("claimed_by_user_id"),
  claimedByName: text("claimed_by_name"),
  claimedByEmail: text("claimed_by_email"),
  claimedByPhone: text("claimed_by_phone"),
  claimedAt: text("claimed_at"), // ISO timestamp
  // Listing information from Casafari
  description: text(), // Description from listing
  timeInMarket: integer("time_in_market"), // Days on market
  status: text().default('active'), // Listing status: active, sold, pending, etc.
  type: text(), // Property type: urban_plot, rustic_plot, etc.
  primaryListingLink: text("primary_listing_link"), // URL to the original listing
}, (table) => [
  index("enriched_plots_geom_idx").using("gist", table.geom.asc().nullsLast().op("gist_geometry_ops_2d")),
  index("idx_enriched_plots_size").using("btree", table.size.asc().nullsLast().op("numeric_ops")),
  index("idx_enriched_plots_price").using("btree", table.price.asc().nullsLast().op("numeric_ops")),
  index("idx_enriched_plots_enrichment_gin").using("gin", table.enrichmentData),
  index("idx_enriched_plots_municipality_id").using("btree", table.municipalityId),
  index("idx_enriched_plots_price_size").using("btree", table.price, table.size).where(sql`${table.price} IS NOT NULL AND ${table.size} IS NOT NULL`),
  index("idx_enriched_plots_price_not_null").using("btree", table.price).where(sql`${table.price} IS NOT NULL`),
  index("idx_enriched_plots_size_not_null").using("btree", table.size).where(sql`${table.size} IS NOT NULL`),
  index("idx_enriched_plots_environment").using("btree", table.environment),
]);

// Explicit stage tables for when you need direct access regardless of env
export const plotsStage = pgTable("plots_stage", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  latitude: doublePrecision().notNull(),
  longitude: doublePrecision().notNull(),
  environment: text().default('version-test').notNull(),
  geom: geometry({ type: "point", srid: 4326 }).generatedAlwaysAs(
    sql`st_setsrid(st_makepoint(longitude, latitude), 4326)`
  ),
  price: numeric({ precision: 10, scale: 2 }).default('0.00'),
  size: numeric(),
  enriched: boolean().default(false),
  casafariId: bigint("casafari_id", { mode: "number" }),
  // Listing information
  description: text(), // Description from casafari or owner
  timeInMarket: integer("time_in_market"), // Days on market
  status: text().default('active'), // Listing status: active, sold, pending, etc.
}, (table) => [
  index("idx_plots_stage_size").using("btree", table.size.asc().nullsLast().op("numeric_ops")),
  index("plots_stage_geom_idx").using("gist", table.geom.asc().nullsLast().op("gist_geometry_ops_2d")),
  index("idx_plots_stage_enriched").using("btree", table.enriched),
  index("idx_plots_stage_casafari_id").using("btree", table.casafariId),
  index("idx_plots_stage_status").using("btree", table.status),
]);

export const enrichedPlotsStage = pgTable("enriched_plots_stage", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  latitude: doublePrecision().notNull(),
  longitude: doublePrecision().notNull(),
  environment: text().default('version-test').notNull(),
  geom: geometry({ type: "point", srid: 4326 }).generatedAlwaysAs(
    sql`st_setsrid(st_makepoint(longitude, latitude), 4326)`
  ),
  price: numeric({ precision: 10, scale: 2 }).default('0.00'),
  size: numeric(),
  enrichmentData: jsonb("enrichment_data"),
  images: jsonb("images").$type<string[]>(),
  municipalityId: integer("municipality_id").references(() => municipalities.id),
  plotReportUrl: text("plot_report_url"),
  plotReportJson: jsonb("plot_report_json"),
  realLatitude: doublePrecision("real_latitude"),
  realLongitude: doublePrecision("real_longitude"),
  realAddress: text("real_address"),
  // Claimed realtor contact info (set when realtor claims/accepts the plot)
  claimedByUserId: text("claimed_by_user_id"),
  claimedByName: text("claimed_by_name"),
  claimedByEmail: text("claimed_by_email"),
  claimedByPhone: text("claimed_by_phone"),
  claimedAt: text("claimed_at"), // ISO timestamp
  // Listing information from Casafari
  description: text(), // Description from listing
  timeInMarket: integer("time_in_market"), // Days on market
  status: text().default('active'), // Listing status: active, sold, pending, etc.
  type: text(), // Property type: urban_plot, rustic_plot, etc.
  primaryListingLink: text("primary_listing_link"), // URL to the original listing
}, (table) => [
  index("enriched_plots_stage_geom_idx").using("gist", table.geom.asc().nullsLast().op("gist_geometry_ops_2d")),
  index("idx_enriched_plots_stage_size").using("btree", table.size.asc().nullsLast().op("numeric_ops")),
  index("idx_enriched_plots_stage_price").using("btree", table.price.asc().nullsLast().op("numeric_ops")),
  index("idx_enriched_plots_stage_enrichment_gin").using("gin", table.enrichmentData),
  index("idx_enriched_plots_stage_municipality_id").using("btree", table.municipalityId),
  index("idx_enriched_plots_stage_price_size").using("btree", table.price, table.size).where(sql`${table.price} IS NOT NULL AND ${table.size} IS NOT NULL`),
  index("idx_enriched_plots_stage_price_not_null").using("btree", table.price).where(sql`${table.price} IS NOT NULL`),
  index("idx_enriched_plots_stage_size_not_null").using("btree", table.size).where(sql`${table.size} IS NOT NULL`),
  index("idx_enriched_plots_stage_environment").using("btree", table.environment),
]);

// Type exports
export type Plot = typeof plots.$inferSelect;
export type NewPlot = typeof plots.$inferInsert;
export type EnrichedPlot = typeof enrichedPlots.$inferSelect;
export type NewEnrichedPlot = typeof enrichedPlots.$inferInsert;
