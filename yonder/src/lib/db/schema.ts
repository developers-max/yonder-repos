import { z } from "zod";
import {
  integer,
  pgTable,
  varchar,
  index,
  unique,
  uuid,
  text,
  jsonb,
  timestamp,
  boolean,
  serial,
} from "drizzle-orm/pg-core";

// ============================================================================
// SHARED TABLES - Re-exported from @yonder/persistence
// These are the common tables used by both yonder-app and yonder-enrich
// ============================================================================
export {
  // Plots
  plots,
  enrichedPlots,
  plotsStage,
  enrichedPlotsStage,
  type Plot,
  type NewPlot,
  type EnrichedPlot,
  type NewEnrichedPlot,
  // Municipalities
  municipalities,
  portugalMunicipalities,
  portugalParishes,
  pdmDocumentEmbeddings,
  regulations,
  type Municipality,
  type NewMunicipality,
  type PortugalMunicipality,
  type NewPortugalMunicipality,
  type PortugalParish,
  type NewPortugalParish,
  type PDMDocumentEmbedding,
  type NewPDMDocumentEmbedding,
  type Regulation,
  type NewRegulation,
  type GISServiceConfig,
  type PDMDocuments,
  // Casafari
  rawCasafariBubblePlots,
  plotFetchLogs,
  type RawCasafariBubblePlot,
  type NewRawCasafariBubblePlot,
  type PlotFetchLog,
  type NewPlotFetchLog,
  // Realtors
  ensureRealtorsTable,
  ensurePlotsStageRealtorsJoinTable,
  type SqlClient,
  type Realtor,
  type PlotRealtorJoin,
} from "@yonder/persistence";

// Import for local references in app-specific tables
import { enrichedPlots, municipalities } from "@yonder/persistence";

// ============================================================================
// APP-SPECIFIC TABLES - Only used by yonder-app
// ============================================================================

export const OrganizationMetadataSchema = z.object({
  description: z.string().optional(),
  website: z.string().url().optional(),
}).catchall(z.unknown());

export type OrganizationMetadata = z.infer<typeof OrganizationMetadataSchema>;

export const usersTable = pgTable("users", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  first_name: varchar({ length: 255 }).notNull(),
  last_name: varchar({ length: 255 }).notNull(),
  name: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text(),
  role: varchar({ length: 50 }).default("user"),
  banned: boolean().default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),
  remainingChatQueries: integer("remaining_chat_queries").default(15).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const accountsTable = pgTable("accounts", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text(),
  password: text(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const sessionsTable = pgTable("sessions", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  token: text().notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  activeOrganizationId: text("active_organization_id").references(
    () => organizationsTable.id
  ),
  impersonatedBy: text("impersonated_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const verificationsTable = pgTable("verifications", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const organizationsTable = pgTable(
  "organizations",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: varchar({ length: 255 }).notNull(),
    slug: varchar({ length: 255 }).notNull().unique(),
    logo: varchar({ length: 500 }),
    metadata: jsonb("metadata").$type<OrganizationMetadata | null>(),
    searchFilters: jsonb("search_filters"),
    status: varchar({ length: 50 }).default("active"),
    selectedPlotId: uuid("selected_plot_id").references(() => enrichedPlots.id),
    currentStage: text("current_stage").references(() => processStepsTable.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("organizations_slug_idx").using("btree", table.slug),
    index("organizations_current_stage_idx").using("btree", table.currentStage),
    index("organizations_status_idx").using("btree", table.status),
  ]
);

export const membersTable = pgTable(
  "members",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    role: varchar({ length: 50 }).default("member").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("members_user_org_uniq").on(table.userId, table.organizationId),
    index("members_user_id_idx").using("btree", table.userId),
    index("members_organization_id_idx").using("btree", table.organizationId),
    index("members_org_role_idx").using(
      "btree",
      table.organizationId,
      table.role
    ),
  ]
);

export const invitationsTable = pgTable(
  "invitations",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: varchar({ length: 255 }).notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    role: varchar({ length: 50 }).default("member").notNull(),
    status: varchar({ length: 50 }).default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("invitations_email_idx").using("btree", table.email),
    index("invitations_organization_id_idx").using(
      "btree",
      table.organizationId
    ),
    index("invitations_status_idx").using("btree", table.status),
  ]
);

export const chatsTable = pgTable(
  "chats",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: varchar({ length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("chats_organization_id_idx").using("btree", table.organizationId),
    index("chats_created_by_idx").using("btree", table.createdBy),
    index("chats_created_at_idx").using("btree", table.createdAt.desc()),
  ]
);

export const messagesTable = pgTable(
  "messages",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    chatId: text("chat_id")
      .notNull()
      .references(() => chatsTable.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    message: jsonb("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("messages_chat_id_idx").using("btree", table.chatId),
    index("messages_created_by_idx").using("btree", table.createdBy),
    index("messages_created_at_idx").using("btree", table.createdAt),
  ]
);

export const organizationPlotsTable = pgTable(
  "organization_plots",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    plotId: uuid("plot_id")
      .notNull()
      .references(() => enrichedPlots.id, { onDelete: "cascade" }),
    status: varchar({ length: 50 }).default("interested"),
    realtorEmail: varchar("realtor_email", { length: 255 }),
    realtorName: varchar("realtor_name", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("organization_plots_org_plot_uniq").on(
      table.organizationId,
      table.plotId
    ),
    index("organization_plots_organization_id_idx").using(
      "btree",
      table.organizationId
    ),
    index("organization_plots_status_idx").using("btree", table.status),
    index("organization_plots_status_org_created_idx").using(
      "btree",
      table.status,
      table.organizationId,
      table.createdAt.desc()
    ),
    index("organization_plots_created_at_desc_idx").using(
      "btree",
      table.createdAt.desc()
    ),
  ]
);

export const plotCampaignsTable = pgTable(
  "plot_campaigns",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    plotId: text("plot_id").notNull(),
    campaignId: integer("campaign_id").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    campaignName: varchar("campaign_name", { length: 255 }).notNull(),
    status: varchar({ length: 50 }).default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("plot_campaigns_plot_id_unique").on(table.plotId),
    index("plot_campaigns_organization_id_idx").using(
      "btree",
      table.organizationId
    ),
    index("plot_campaigns_campaign_id_idx").using(
      "btree",
      table.campaignId
    ),
  ]
);

export const conversationsTable = pgTable(
  "conversations",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    organizationPlotId: text("organization_plot_id").references(
      () => organizationPlotsTable.id,
      { onDelete: "cascade" }
    ),
    stakeholderType: varchar("stakeholder_type", { length: 50 }).notNull(),
    stakeholderEmail: varchar("stakeholder_email", { length: 255 }),
    stakeholderName: varchar("stakeholder_name", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("conversations_organization_id_idx").using(
      "btree",
      table.organizationId
    ),
    index("conversations_stakeholder_type_idx").using(
      "btree",
      table.stakeholderType
    ),
  ]
);

export const conversationMessagesTable = pgTable(
  "conversation_messages",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    senderId: text("sender_id").references(() => usersTable.id),
    senderType: varchar("sender_type", { length: 50 }).notNull(),
    senderName: varchar("sender_name", { length: 255 }),
    content: text().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("conversation_messages_conversation_id_idx").using(
      "btree",
      table.conversationId
    ),
    index("conversation_messages_sent_at_idx").using(
      "btree",
      table.sentAt.desc()
    ),
  ]
);

export const yonderPartnersTable = pgTable(
  "yonder_partners",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: varchar({ length: 255 }).notNull(),
    type: varchar({ length: 100 }).notNull(),
    email: varchar({ length: 255 }),
    specialties: jsonb("specialties").$type<string[]>(),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("yonder_partners_type_idx").using("btree", table.type),
    index("yonder_partners_active_idx").using("btree", table.isActive),
  ]
);

export const processStepsTable = pgTable(
  "process_steps",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orderIndex: integer("order_index").notNull(),
    name: varchar({ length: 255 }).notNull(),
    title: varchar({ length: 500 }).notNull(),
    detailedDescription: text("detailed_description").notNull(),
    yonderPartner: boolean("yonder_partner").notNull().default(false),
    yonderPartnerId: text("yonder_partner_id").references(
      () => yonderPartnersTable.id
    ),
    isRequired: boolean("is_required").notNull().default(true),
    category: varchar({ length: 100 }).notNull(),
    estimatedTime: varchar("estimated_time", { length: 255 }).notNull(),
    docsNeeded: jsonb("docs_needed").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("process_steps_order_idx").using("btree", table.orderIndex),
    index("process_steps_category_idx").using("btree", table.category),
    index("process_steps_required_idx").using("btree", table.isRequired),
    index("process_steps_yonder_partner_idx").using(
      "btree",
      table.yonderPartnerId
    ),
  ]
);

export const organizationStepsTable = pgTable(
  "organization_steps",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    processStepId: text("process_step_id")
      .notNull()
      .references(() => processStepsTable.id),
    status: varchar({ length: 50 }).default("pending"),
    assignedTo: text("assigned_to").references(() => yonderPartnersTable.id),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("organization_steps_org_step_uniq").on(
      table.organizationId,
      table.processStepId
    ),
    index("organization_steps_organization_id_idx").using(
      "btree",
      table.organizationId
    ),
    index("organization_steps_status_idx").using("btree", table.status),
    index("organization_steps_assigned_to_idx").using(
      "btree",
      table.assignedTo
    ),
  ]
);

export const pdmRequestsTable = pgTable(
  "pdm_requests",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    chatId: text("chat_id").references(() => chatsTable.id, {
      onDelete: "set null",
    }),
    organizationId: text("organization_id").references(
      () => organizationsTable.id,
      { onDelete: "cascade" }
    ),
    plotId: uuid("plot_id").references(() => enrichedPlots.id, {
      onDelete: "cascade",
    }),
    municipalityId: integer("municipality_id")
      .notNull()
      .references(() => municipalities.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    status: varchar({ length: 50 }).default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("pdm_requests_unique_request").on(
      table.municipalityId,
      table.plotId,
      table.organizationId,
      table.userId
    ),
    index("pdm_requests_municipality_id_idx").using(
      "btree",
      table.municipalityId
    ),
    index("pdm_requests_created_at_idx").using("btree", table.createdAt.desc()),
  ]
);
