/**
 * Municipalities Schema - Municipality and PDM document table definitions
 */
import {
  pgTable,
  serial,
  varchar,
  jsonb,
  timestamp,
  integer,
  boolean,
  text,
  index,
} from "drizzle-orm/pg-core";

// GIS Service configuration type for REN/RAN endpoints
export interface GISServiceConfig {
  url: string;
  layers?: string;
}

// PDM Documents type
export interface PDMDocuments {
  documents: Array<{
    id: string;
    title: string;
    description: string;
    url: string;
    summary: string;
    documentType: "pdm" | "regulamento" | "plano_pormenor";
  }>;
  lastUpdated: string;
}

export const municipalities = pgTable(
  "municipalities",
  {
    id: serial().primaryKey().notNull(),
    name: varchar({ length: 255 }).notNull().unique(),
    district: varchar({ length: 100 }),
    country: varchar({ length: 2 }).default('PT'), // Country code: PT, ES
    website: varchar({ length: 500 }),
    pdmDocuments: jsonb("pdm_documents").$type<PDMDocuments>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_municipalities_name").using("btree", table.name),
    index("idx_municipalities_district").using("btree", table.district),
    index("idx_municipalities_website").using("btree", table.website),
    index("idx_municipalities_pdm_gin").using("gin", table.pdmDocuments),
  ]
);

// Portugal municipalities table with administrative data and GIS endpoints
export const portugalMunicipalities = pgTable(
  "portugal_municipalities",
  {
    id: serial().primaryKey().notNull(),
    caopId: varchar("caop_id", { length: 10 }).unique().notNull(),
    name: varchar({ length: 255 }).unique().notNull(),
    district: varchar({ length: 100 }),
    nParishes: integer("n_parishes").default(0),
    nuts1: varchar({ length: 100 }),
    nuts2: varchar({ length: 100 }),
    nuts3: varchar({ length: 255 }),
    // GIS service endpoints for REN/RAN layers
    gisBaseUrl: varchar("gis_base_url", { length: 500 }),
    renService: jsonb("ren_service").$type<GISServiceConfig | null>(),
    ranService: jsonb("ran_service").$type<GISServiceConfig | null>(),
    gisVerified: boolean("gis_verified").default(false),
    gisLastChecked: timestamp("gis_last_checked", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_portugal_municipalities_name").using("btree", table.name),
    index("idx_portugal_municipalities_district").using("btree", table.district),
    index("idx_portugal_municipalities_caop_id").using("btree", table.caopId),
    index("idx_portugal_municipalities_gis_verified").using("btree", table.gisVerified),
    index("idx_portugal_municipalities_ren_gin").using("gin", table.renService),
    index("idx_portugal_municipalities_ran_gin").using("gin", table.ranService),
  ]
);

// PDM Document Embeddings for RAG
export const pdmDocumentEmbeddings = pgTable(
  "pdm_document_embeddings",
  {
    id: serial().primaryKey().notNull(),
    municipalityId: integer("municipality_id")
      .notNull()
      .references(() => municipalities.id, { onDelete: "cascade" }),
    documentId: varchar("document_id", { length: 255 }).notNull(),
    documentUrl: text("document_url").notNull(),
    documentTitle: text("document_title").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    chunkText: text("chunk_text").notNull(),
    embedding: text().notNull(), // pgvector type
    metadata: text("metadata"), // JSONB stored as text
    // Full-text search columns (BM25)
    searchVector: text("search_vector"), // tsvector type stored as text
    searchLanguage: text("search_language").default("english"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("pdm_embeddings_municipality_id_idx").using("btree", table.municipalityId),
    index("pdm_embeddings_document_id_idx").using("btree", table.documentId),
    // Note: GIN index for search_vector should be created via SQL:
    // CREATE INDEX idx_pdm_embeddings_fts ON pdm_document_embeddings USING GIN(search_vector);
  ]
);

// Regulations table
export const regulations = pgTable(
  "regulations",
  {
    id: serial().primaryKey().notNull(),
    municipalityId: integer("municipality_id")
      .notNull()
      .references(() => municipalities.id, { onDelete: "cascade" }),
    docUrl: text("doc_url").notNull(),
    regulation: jsonb("regulation").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("regulations_municipality_id_idx").using("btree", table.municipalityId),
    index("regulations_doc_url_idx").using("btree", table.docUrl),
    index("regulations_regulation_gin").using("gin", table.regulation),
  ]
);

// Portugal Parishes table (freguesias) - CAOP data
export const portugalParishes = pgTable(
  "portugal_parishes",
  {
    id: serial().primaryKey().notNull(),
    caopId: varchar("caop_id", { length: 10 }).unique().notNull(),
    name: varchar({ length: 255 }).notNull(),
    municipalityId: integer("municipality_id").references(() => portugalMunicipalities.id, { onDelete: "cascade" }),
    municipalityName: varchar("municipality_name", { length: 255 }).notNull(),
    district: varchar({ length: 100 }),
    nuts1: varchar({ length: 100 }),
    nuts2: varchar({ length: 100 }),
    nuts3: varchar({ length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_portugal_parishes_name").using("btree", table.name),
    index("idx_portugal_parishes_caop_id").using("btree", table.caopId),
    index("idx_portugal_parishes_municipality_id").using("btree", table.municipalityId),
    index("idx_portugal_parishes_municipality_name").using("btree", table.municipalityName),
  ]
);

// Type exports
export type Municipality = typeof municipalities.$inferSelect;
export type NewMunicipality = typeof municipalities.$inferInsert;
export type PortugalMunicipality = typeof portugalMunicipalities.$inferSelect;
export type NewPortugalMunicipality = typeof portugalMunicipalities.$inferInsert;
export type PortugalParish = typeof portugalParishes.$inferSelect;
export type NewPortugalParish = typeof portugalParishes.$inferInsert;
export type PDMDocumentEmbedding = typeof pdmDocumentEmbeddings.$inferSelect;
export type NewPDMDocumentEmbedding = typeof pdmDocumentEmbeddings.$inferInsert;
export type Regulation = typeof regulations.$inferSelect;
export type NewRegulation = typeof regulations.$inferInsert;
