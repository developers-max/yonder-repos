import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { db } from "../../../lib/db";
import {
  usersTable,
  organizationsTable,
  membersTable,
  organizationPlotsTable,
  organizationStepsTable,
  enrichedPlots,
  pdmRequestsTable,
  municipalities,
} from "../../../lib/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";

// Helper function to check if user is admin
async function requireAdmin(userId: string) {
  const user = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user[0] || user[0].role !== "admin") {
    throw new Error("Admin access required");
  }
}

export const adminRouter = router({
  // Safe check for admin status without throwing
  isAdmin: protectedProcedure.query(async ({ ctx }) => {
    const user = await db
      .select({ role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, ctx.user.id))
      .limit(1);
    return { isAdmin: !!user[0] && user[0].role === "admin" };
  }),

  // Get current user's remaining chat queries (available to all authenticated users)
  getRemainingChatQueries: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await db
      .select({ remainingChatQueries: usersTable.remainingChatQueries })
      .from(usersTable)
      .where(eq(usersTable.id, ctx.user.id))
      .limit(1);
    return { remainingChatQueries: user?.remainingChatQueries ?? 0 };
  }),

  // Get all projects with progress
  getAllProjects: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(20),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);

      const { page, limit, search } = input;
      const offset = (page - 1) * limit;

      // Build search condition
      const searchCondition = search
        ? sql`(${organizationsTable.name} ILIKE '%' || ${search} || '%' OR ${usersTable.name} ILIKE '%' || ${search} || '%' OR ${usersTable.email} ILIKE '%' || ${search} || '%')`
        : sql`1=1`;

      // Get total count
      const [{ count: totalCount }] = await db
        .select({ count: sql`count(*)`.as("count") })
        .from(organizationsTable)
        .innerJoin(
          membersTable,
          eq(membersTable.organizationId, organizationsTable.id)
        )
        .innerJoin(usersTable, eq(usersTable.id, membersTable.userId))
        .where(and(eq(membersTable.role, "owner"), searchCondition));

      // Get projects with owner info and stats
      const projects = await db
        .select({
          project: organizationsTable,
          owner: {
            id: usersTable.id,
            name: usersTable.name,
            email: usersTable.email,
            first_name: usersTable.first_name,
            last_name: usersTable.last_name,
          },
          plotsCount: sql`(
            SELECT COUNT(*) 
            FROM ${organizationPlotsTable} 
            WHERE ${organizationPlotsTable.organizationId} = ${organizationsTable.id}
          )`.as("plotsCount"),
          completedStepsCount: sql`(
            SELECT COUNT(*) 
            FROM ${organizationStepsTable} 
            WHERE ${organizationStepsTable.organizationId} = ${organizationsTable.id} 
            AND ${organizationStepsTable.status} = 'completed'
          )`.as("completedStepsCount"),
          totalStepsCount: sql`(
            SELECT COUNT(*) 
            FROM ${organizationStepsTable} 
            WHERE ${organizationStepsTable.organizationId} = ${organizationsTable.id}
          )`.as("totalStepsCount"),
        })
        .from(organizationsTable)
        .innerJoin(
          membersTable,
          eq(membersTable.organizationId, organizationsTable.id)
        )
        .innerJoin(usersTable, eq(usersTable.id, membersTable.userId))
        .where(and(eq(membersTable.role, "owner"), searchCondition))
        .orderBy(desc(organizationsTable.createdAt))
        .limit(limit)
        .offset(offset);

      const totalPages = Math.ceil(Number(totalCount) / limit);

      return {
        projects: projects.map((p) => ({
          ...p.project,
          owner: p.owner,
          plotsCount: Number(p.plotsCount),
          completedStepsCount: Number(p.completedStepsCount),
          totalStepsCount: Number(p.totalStepsCount),
          progressPercentage:
            Number(p.totalStepsCount) > 0
              ? Math.round(
                  (Number(p.completedStepsCount) / Number(p.totalStepsCount)) *
                    100
                )
              : 0,
        })),
        pagination: {
          page,
          limit,
          totalCount: Number(totalCount),
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    }),

  // Get all outreach requests (organization plots with interested status)
  getAllOutreachRequests: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(20),
        status: z
          .enum([
            "interested",
            "outreach_sent",
            "realtor_replied",
            "viewing_scheduled",
            "offer_made",
            "purchased",
            "declined",
          ])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);

      const { page, limit, status } = input;
      const offset = (page - 1) * limit;

      // Simplified query - get organizations with their plot counts directly
      const organizationsWithOutreach = await db
        .select({
          id: organizationsTable.id,
          name: organizationsTable.name,
          slug: organizationsTable.slug,
          searchFilters: organizationsTable.searchFilters,
          userId: usersTable.id,
          userName: usersTable.name,
          userEmail: usersTable.email,
          userFirstName: usersTable.first_name,
          userLastName: usersTable.last_name,
          // Get plot count and earliest created date efficiently
          plotCount: sql`(
            SELECT COUNT(*) 
            FROM ${organizationPlotsTable} 
            WHERE ${organizationPlotsTable.organizationId} = ${
            organizationsTable.id
          }
            ${
              status
                ? sql`AND ${organizationPlotsTable.status} = ${status}`
                : sql``
            }
          )`.as("plotCount"),
          earliestCreated: sql`(
            SELECT MIN(${organizationPlotsTable.createdAt}) 
            FROM ${organizationPlotsTable} 
            WHERE ${organizationPlotsTable.organizationId} = ${
            organizationsTable.id
          }
            ${
              status
                ? sql`AND ${organizationPlotsTable.status} = ${status}`
                : sql``
            }
          )`.as("earliestCreated"),
        })
        .from(organizationsTable)
        .innerJoin(
          membersTable,
          eq(membersTable.organizationId, organizationsTable.id)
        )
        .innerJoin(usersTable, eq(usersTable.id, membersTable.userId))
        .where(
          and(
            eq(membersTable.role, "owner"),
            // EXISTS check for organizations with plots
            sql`EXISTS (
            SELECT 1 FROM ${organizationPlotsTable} 
            WHERE ${organizationPlotsTable.organizationId} = ${
              organizationsTable.id
            }
            ${
              status
                ? sql`AND ${organizationPlotsTable.status} = ${status}`
                : sql``
            }
          )`
          )
        )
        // Order by organization created date instead of expensive subquery
        .orderBy(desc(organizationsTable.createdAt))
        .limit(limit)
        .offset(offset);

      // Only get count if we need pagination (when we have results)
      let totalCount = 0;
      if (organizationsWithOutreach.length === limit) {
        // Only count if we might have more pages
        const [{ count }] = await db
          .select({ count: sql`count(*)`.as("count") })
          .from(organizationsTable).where(sql`EXISTS (
            SELECT 1 FROM ${organizationPlotsTable} 
            WHERE ${organizationPlotsTable.organizationId} = ${
          organizationsTable.id
        }
            ${
              status
                ? sql`AND ${organizationPlotsTable.status} = ${status}`
                : sql``
            }
          )`);
        totalCount = Number(count);
      } else {
        // No more pages, calculate count from current data
        totalCount = offset + organizationsWithOutreach.length;
      }

      const totalPages = Math.ceil(totalCount / limit);

      return {
        outreachRequests: organizationsWithOutreach.map((org) => ({
          id: org.id,
          project: {
            id: org.id,
            name: org.name,
            slug: org.slug,
            searchFilters: org.searchFilters,
          },
          user: {
            id: org.userId,
            name: org.userName,
            email: org.userEmail,
            first_name: org.userFirstName,
            last_name: org.userLastName,
          },
          status: status || "interested",
          plots: [], // Remove expensive plots loading
          plotCount: Number(org.plotCount),
          createdAt: org.earliestCreated
            ? new Date(org.earliestCreated as string).toISOString()
            : new Date().toISOString(),
        })),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    }),

  // Get organization plots for a specific organization (outreach details)
  getOrganizationPlots: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        status: z
          .enum([
            "interested",
            "outreach_sent",
            "realtor_replied",
            "viewing_scheduled",
            "offer_made",
            "purchased",
            "declined",
          ])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);

      // Get organization with owner info
      const [orgData] = await db
        .select({
          project: organizationsTable,
          user: {
            id: usersTable.id,
            name: usersTable.name,
            email: usersTable.email,
            first_name: usersTable.first_name,
            last_name: usersTable.last_name,
          },
        })
        .from(organizationsTable)
        .innerJoin(
          membersTable,
          eq(membersTable.organizationId, organizationsTable.id)
        )
        .innerJoin(usersTable, eq(usersTable.id, membersTable.userId))
        .where(
          and(
            eq(organizationsTable.id, input.organizationId),
            eq(membersTable.role, "owner")
          )
        )
        .limit(1);

      if (!orgData) {
        throw new Error("Organization not found");
      }

      // Get all plots for this organization with optional status filter
      const conditions = [eq(organizationPlotsTable.organizationId, input.organizationId)];
      if (input.status) {
        conditions.push(eq(organizationPlotsTable.status, input.status));
      }

      const plots = await db
        .select({
          organizationPlot: {
            status: organizationPlotsTable.status,
            createdAt: organizationPlotsTable.createdAt,
            realtorEmail: organizationPlotsTable.realtorEmail,
            realtorName: organizationPlotsTable.realtorName,
          },
          plot: {
            id: enrichedPlots.id,
            latitude: enrichedPlots.latitude,
            longitude: enrichedPlots.longitude,
            price: enrichedPlots.price,
            size: enrichedPlots.size,
            enrichmentData: enrichedPlots.enrichmentData,
            images: enrichedPlots.images,
          },
        })
        .from(organizationPlotsTable)
        .innerJoin(enrichedPlots, eq(enrichedPlots.id, organizationPlotsTable.plotId))
        .where(and(...conditions))
        .orderBy(organizationPlotsTable.createdAt);

      type AdminOrganizationPlotsResponse = {
        project: typeof orgData.project;
        user: typeof orgData.user;
        plots: Array<{
          id: string;
          latitude: number;
          longitude: number;
          price: string | null;
          size: string | null;
          enrichmentData: unknown;
          images: string[] | null | undefined;
          organizationPlotStatus: {
            status: string | null;
            createdAt: string;
            realtorEmail: string | null;
            realtorName: string | null;
          };
        }>;
      };

      const response: AdminOrganizationPlotsResponse = {
        project: orgData.project,
        user: orgData.user,
        plots: plots.map((item) => ({
          id: String(item.plot.id),
          latitude: Number(item.plot.latitude),
          longitude: Number(item.plot.longitude),
          price: item.plot.price as string | null,
          size: item.plot.size as string | null,
          enrichmentData: item.plot.enrichmentData as unknown,
          images: (item.plot.images as unknown as string[] | null | undefined),
          organizationPlotStatus: {
            status: item.organizationPlot.status as string | null,
            createdAt: (item.organizationPlot.createdAt as unknown as Date | string) instanceof Date
              ? (item.organizationPlot.createdAt as unknown as Date).toISOString()
              : String(item.organizationPlot.createdAt),
            realtorEmail: item.organizationPlot.realtorEmail as string | null,
            realtorName: item.organizationPlot.realtorName as string | null,
          },
        })),
      };

      return response;
    }),

  // Update plot status for admin
  updatePlotStatus: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        plotId: z.string(),
        status: z.enum([
          "interested",
          "outreach_sent",
          "realtor_replied",
          "viewing_scheduled",
          "offer_made",
          "purchased",
          "declined",
        ]),
        realtorEmail: z.string().optional(),
        realtorName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);

      const updateData: {
        status: string;
        realtorEmail?: string;
        realtorName?: string;
      } = {
        status: input.status,
      };

      if (input.realtorEmail) {
        updateData.realtorEmail = input.realtorEmail;
      }

      if (input.realtorName) {
        updateData.realtorName = input.realtorName;
      }

      const [updatedPlot] = await db
        .update(organizationPlotsTable)
        .set(updateData)
        .where(
          and(
            eq(organizationPlotsTable.organizationId, input.organizationId),
            eq(organizationPlotsTable.plotId, input.plotId)
          )
        )
        .returning();

      if (!updatedPlot) {
        throw new Error("Plot not found in organization");
      }

      return updatedPlot;
    }),

  // Get admin dashboard stats
  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    await requireAdmin(ctx.user.id);

    const [
      totalProjectsResult,
      activeProjectsResult,
      interestedPlotsResult,
      outreachSentPlotsResult,
      realtorRepliedPlotsResult,
      viewingScheduledPlotsResult,
      offerMadePlotsResult,
      purchasedPlotsResult,
    ] = await Promise.all([
      db.select({ count: sql`count(*)`.as("count") }).from(organizationsTable),
      db
        .select({ count: sql`count(*)`.as("count") })
        .from(organizationsTable)
        .where(eq(organizationsTable.status, "active")),
      db
        .select({ count: sql`count(*)`.as("count") })
        .from(organizationPlotsTable)
        .where(eq(organizationPlotsTable.status, "interested")),
      db
        .select({ count: sql`count(*)`.as("count") })
        .from(organizationPlotsTable)
        .where(eq(organizationPlotsTable.status, "outreach_sent")),
      db
        .select({ count: sql`count(*)`.as("count") })
        .from(organizationPlotsTable)
        .where(eq(organizationPlotsTable.status, "realtor_replied")),
      db
        .select({ count: sql`count(*)`.as("count") })
        .from(organizationPlotsTable)
        .where(eq(organizationPlotsTable.status, "viewing_scheduled")),
      db
        .select({ count: sql`count(*)`.as("count") })
        .from(organizationPlotsTable)
        .where(eq(organizationPlotsTable.status, "offer_made")),
      db
        .select({ count: sql`count(*)`.as("count") })
        .from(organizationPlotsTable)
        .where(eq(organizationPlotsTable.status, "purchased")),
    ]);

    return {
      totalProjects: Number(totalProjectsResult[0]?.count || 0),
      activeProjects: Number(activeProjectsResult[0]?.count || 0),
      interested: Number(interestedPlotsResult[0]?.count || 0),
      outreachSent: Number(outreachSentPlotsResult[0]?.count || 0),
      realtorReplied: Number(realtorRepliedPlotsResult[0]?.count || 0),
      viewingScheduled: Number(viewingScheduledPlotsResult[0]?.count || 0),
      offerMade: Number(offerMadePlotsResult[0]?.count || 0),
      purchased: Number(purchasedPlotsResult[0]?.count || 0),
    };
  }),

  listPdmRequests: protectedProcedure.query(async ({ ctx }) => {
    await requireAdmin(ctx.user.id);

    const rows = await db
      .select({
        id: pdmRequestsTable.id,
        status: pdmRequestsTable.status,
        createdAt: pdmRequestsTable.createdAt,
        municipalityId: pdmRequestsTable.municipalityId,
        municipalityName: municipalities.name,
        plotId: pdmRequestsTable.plotId,
        organizationId: pdmRequestsTable.organizationId,
        userId: pdmRequestsTable.userId,
        userName: usersTable.name,
        userEmail: usersTable.email,
      })
      .from(pdmRequestsTable)
      .leftJoin(
        municipalities,
        eq(municipalities.id, pdmRequestsTable.municipalityId)
      )
      .leftJoin(usersTable, eq(usersTable.id, pdmRequestsTable.userId))
      .orderBy(desc(pdmRequestsTable.createdAt));

    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      municipality: { id: r.municipalityId, name: r.municipalityName },
      plotId: r.plotId,
      organizationId: r.organizationId,
      user: { id: r.userId, name: r.userName, email: r.userEmail },
    }));
  }),

  getPdmMunicipalityDetails: protectedProcedure
    .input(z.object({ municipalityId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);

      const rows = await db
        .select({
          requestId: pdmRequestsTable.id,
          plotId: pdmRequestsTable.plotId,
          organizationId: pdmRequestsTable.organizationId,
          userId: pdmRequestsTable.userId,
          userName: usersTable.name,
          userEmail: usersTable.email,
          createdAt: pdmRequestsTable.createdAt,
          status: pdmRequestsTable.status,
        })
        .from(pdmRequestsTable)
        .leftJoin(usersTable, eq(usersTable.id, pdmRequestsTable.userId))
        .where(eq(pdmRequestsTable.municipalityId, input.municipalityId))
        .orderBy(desc(pdmRequestsTable.createdAt));

      // Get municipality name
      const [municipality] = await db
        .select({ name: municipalities.name })
        .from(municipalities)
        .where(eq(municipalities.id, input.municipalityId))
        .limit(1);

      return {
        municipalityName:
          municipality?.name || `Municipality ${input.municipalityId}`,
        requests: rows.map((r) => ({
          requestId: r.requestId,
          plotId: r.plotId,
          organizationId: r.organizationId,
          userId: r.userId,
          userName: r.userName,
          userEmail: r.userEmail,
          createdAt: r.createdAt,
          status: r.status,
        })),
      };
    }),

  // Set user role (admin only)
  setUserRole: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.enum(['user', 'realtor', 'admin']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);

      const [updated] = await db
        .update(usersTable)
        .set({ role: input.role })
        .where(eq(usersTable.id, input.userId))
        .returning({ id: usersTable.id, role: usersTable.role });

      if (!updated) {
        throw new Error('User not found');
      }

      return updated;
    }),

  // Set user chat queries (admin only)
  setUserChatQueries: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        remainingChatQueries: z.number().int().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);

      const [updated] = await db
        .update(usersTable)
        .set({ remainingChatQueries: input.remainingChatQueries })
        .where(eq(usersTable.id, input.userId))
        .returning({ id: usersTable.id, remainingChatQueries: usersTable.remainingChatQueries });

      if (!updated) {
        throw new Error('User not found');
      }

      return updated;
    }),

  // List users (admin only)
  getUsers: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(20),
        search: z.string().optional(),
        role: z.enum(['user', 'realtor', 'admin']).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);

      const { page, limit, search, role } = input;
      const offset = (page - 1) * limit;

      const searchCondition = search
        ? sql`(${usersTable.name} ILIKE '%' || ${search} || '%' OR ${usersTable.email} ILIKE '%' || ${search} || '%')`
        : sql`1=1`;

      const roleCondition = role ? eq(usersTable.role, role) : sql`1=1`;

      const [{ count }] = await db
        .select({ count: sql`count(*)`.as('count') })
        .from(usersTable)
        .where(and(searchCondition, roleCondition));

      const users = await db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          role: usersTable.role,
          remainingChatQueries: usersTable.remainingChatQueries,
          createdAt: usersTable.createdAt,
        })
        .from(usersTable)
        .where(and(searchCondition, roleCondition))
        .orderBy(desc(usersTable.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        users,
        pagination: {
          page,
          limit,
          totalCount: Number(count),
          totalPages: Math.ceil(Number(count) / limit),
          hasNextPage: page * limit < Number(count),
          hasPrevPage: page > 1,
        },
      };
    }),

  // List realtor companies (admin only)
  getRealtors: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(20),
        search: z.string().optional(),
        country: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);

      const { page, limit, search, country } = input;
      const offset = (page - 1) * limit;

      type RealtorRow = {
        id: number;
        company_name: string;
        country: string;
        website_url: string;
        email: string | null;
        telephone: string | null;
      };

      // Helper to normalize db.execute return shape
      function hasRows<T>(v: unknown): v is { rows: T[] } {
        return typeof v === 'object' && v !== null && 'rows' in v;
      }

      const itemsRes = await db.execute(sql<RealtorRow>`
        SELECT id, company_name, country, website_url, email, telephone
        FROM realtors
        WHERE 1=1
        ${search ? sql` AND (company_name ILIKE '%' || ${search} || '%' OR email ILIKE '%' || ${search} || '%' OR telephone ILIKE '%' || ${search} || '%' OR website_url ILIKE '%' || ${search} || '%')` : sql``}
        ${country ? sql` AND country = ${country}` : sql``}
        ORDER BY company_name ASC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const countRes = await db.execute(sql<{ count: number }>`
        SELECT COUNT(*)::int AS count
        FROM realtors
        WHERE 1=1
        ${search ? sql` AND (company_name ILIKE '%' || ${search} || '%' OR email ILIKE '%' || ${search} || '%' OR telephone ILIKE '%' || ${search} || '%' OR website_url ILIKE '%' || ${search} || '%')` : sql``}
        ${country ? sql` AND country = ${country}` : sql``}
      `);

      const items: RealtorRow[] = hasRows<RealtorRow>(itemsRes)
        ? itemsRes.rows
        : ((itemsRes as unknown) as RealtorRow[]) ?? [];
      const totalCount: number = hasRows<{ count: number }>(countRes)
        ? Number(countRes.rows[0]?.count || 0)
        : Number((countRes as unknown as { count: number }[])[0]?.count || 0);

      return {
        realtors: items,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNextPage: page * limit < totalCount,
          hasPrevPage: page > 1,
        },
      };
    }),

  // Admin can view "realtor panel" data for a given realtor by email or domain
  getRealtorAssignedOutreach: protectedProcedure
    .input(
      z.object({
        realtorEmail: z.string().optional(),
        emailDomain: z.string().optional(),
        page: z.number().default(1),
        limit: z.number().default(20),
        status: z
          .enum([
            "interested",
            "outreach_sent",
            "realtor_replied",
            "viewing_scheduled",
            "offer_made",
            "purchased",
            "declined",
          ])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);

      const { page, limit, status, realtorEmail, emailDomain } = input;
      const offset = (page - 1) * limit;

      const whereStatus = status
        ? eq(organizationPlotsTable.status, status)
        : sql`1=1`;

      // Prefer exact email match; otherwise fallback to domain match (realtorEmail LIKE %@domain)
      const whereRealtor = realtorEmail
        ? eq(organizationPlotsTable.realtorEmail, realtorEmail)
        : emailDomain
        ? sql`${organizationPlotsTable.realtorEmail} ILIKE ${'%' + '@' + emailDomain}`
        : sql`1=1`;

      const items = await db
        .select({
          organization: organizationsTable,
          orgPlot: organizationPlotsTable,
          plot: enrichedPlots,
        })
        .from(organizationPlotsTable)
        .innerJoin(
          organizationsTable,
          eq(organizationsTable.id, organizationPlotsTable.organizationId)
        )
        .innerJoin(
          enrichedPlots,
          eq(enrichedPlots.id, organizationPlotsTable.plotId)
        )
        .where(and(whereRealtor, whereStatus))
        .orderBy(desc(organizationPlotsTable.createdAt))
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql`count(*)`.as('count') })
        .from(organizationPlotsTable)
        .where(and(whereRealtor, whereStatus));

      return {
        items: items.map((row) => ({
          project: row.organization,
          plot: row.plot,
          organizationPlot: row.orgPlot,
        })),
        pagination: {
          page,
          limit,
          totalCount: Number(count),
          totalPages: Math.ceil(Number(count) / limit),
        },
      };
    }),

  // ==================== MUNICIPALITY ADMIN ====================

  // Get all municipalities with filtering
  getMunicipalities: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(20),
        search: z.string().optional(),
        country: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);

      const { page, limit, search, country } = input;
      const offset = (page - 1) * limit;

      // Build conditions
      const conditions = [];
      if (search) {
        // Check if search is a number (ID search)
        const searchAsNumber = parseInt(search, 10);
        if (!isNaN(searchAsNumber)) {
          conditions.push(
            sql`(${municipalities.id} = ${searchAsNumber} OR ${municipalities.name} ILIKE '%' || ${search} || '%' OR ${municipalities.district} ILIKE '%' || ${search} || '%')`
          );
        } else {
          conditions.push(
            sql`(${municipalities.name} ILIKE '%' || ${search} || '%' OR ${municipalities.district} ILIKE '%' || ${search} || '%')`
          );
        }
      }
      if (country) {
        conditions.push(eq(municipalities.country, country));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count
      const [{ count: totalCount }] = await db
        .select({ count: sql`count(*)`.as("count") })
        .from(municipalities)
        .where(whereClause);

      // Get municipalities
      const items = await db
        .select({
          id: municipalities.id,
          name: municipalities.name,
          district: municipalities.district,
          country: municipalities.country,
          website: municipalities.website,
          pdmDocuments: municipalities.pdmDocuments,
          createdAt: municipalities.createdAt,
          updatedAt: municipalities.updatedAt,
        })
        .from(municipalities)
        .where(whereClause)
        .orderBy(municipalities.name)
        .limit(limit)
        .offset(offset);

      const totalPages = Math.ceil(Number(totalCount) / limit);

      return {
        municipalities: items,
        pagination: {
          page,
          limit,
          totalCount: Number(totalCount),
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    }),

  // Get distinct countries for filtering
  getMunicipalityCountries: protectedProcedure.query(async ({ ctx }) => {
    await requireAdmin(ctx.user.id);

    const countries = await db
      .selectDistinct({ country: municipalities.country })
      .from(municipalities)
      .where(sql`${municipalities.country} IS NOT NULL`)
      .orderBy(municipalities.country);

    return countries.map((c) => c.country).filter(Boolean) as string[];
  }),

  // Update municipality PDM document
  updateMunicipalityPdm: protectedProcedure
    .input(
      z.object({
        municipalityId: z.number(),
        pdmDocument: z.object({
          title: z.string().min(1),
          url: z.string().url(),
          description: z.string().optional(),
          documentType: z.enum(["pdm", "regulamento", "plano_pormenor"]).default("pdm"),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);

      const { municipalityId, pdmDocument } = input;

      // Get current municipality
      const [current] = await db
        .select()
        .from(municipalities)
        .where(eq(municipalities.id, municipalityId))
        .limit(1);

      if (!current) {
        throw new Error("Municipality not found");
      }

      // Create new PDM documents structure
      const newDoc = {
        id: `doc-${Date.now()}`,
        title: pdmDocument.title,
        url: pdmDocument.url,
        description: pdmDocument.description || "",
        summary: "",
        documentType: pdmDocument.documentType,
      };

      const existingDocs = current.pdmDocuments?.documents || [];
      const updatedPdmDocuments = {
        documents: [...existingDocs, newDoc],
        lastUpdated: new Date().toISOString(),
      };

      // Update municipality
      await db
        .update(municipalities)
        .set({
          pdmDocuments: updatedPdmDocuments,
          updatedAt: new Date(),
        })
        .where(eq(municipalities.id, municipalityId));

      return { success: true, documentId: newDoc.id };
    }),

  // Remove a PDM document from municipality
  removeMunicipalityPdmDocument: protectedProcedure
    .input(
      z.object({
        municipalityId: z.number(),
        documentId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);

      const { municipalityId, documentId } = input;

      // Get current municipality
      const [current] = await db
        .select()
        .from(municipalities)
        .where(eq(municipalities.id, municipalityId))
        .limit(1);

      if (!current) {
        throw new Error("Municipality not found");
      }

      const existingDocs = current.pdmDocuments?.documents || [];
      const updatedDocs = existingDocs.filter((doc) => doc.id !== documentId);

      const updatedPdmDocuments = {
        documents: updatedDocs,
        lastUpdated: new Date().toISOString(),
      };

      // Update municipality
      await db
        .update(municipalities)
        .set({
          pdmDocuments: updatedPdmDocuments,
          updatedAt: new Date(),
        })
        .where(eq(municipalities.id, municipalityId));

      return { success: true };
    }),

  // Update municipality website
  updateMunicipalityWebsite: protectedProcedure
    .input(
      z.object({
        municipalityId: z.number(),
        website: z.string().url().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);

      await db
        .update(municipalities)
        .set({
          website: input.website,
          updatedAt: new Date(),
        })
        .where(eq(municipalities.id, input.municipalityId));

      return { success: true };
    }),

  // Process PDM document for RAG/LLM integration
  processPdmDocument: protectedProcedure
    .input(
      z.object({
        municipalityId: z.number(),
        pdmUrl: z.string().url(),
        forceRefresh: z.boolean().default(false),
        generateEmbeddings: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);

      const { processPdmDocument } = await import('../../../lib/utils/remote-clients/yonder-agent-client');
      
      try {
        const result = await processPdmDocument({
          pdm_url: input.pdmUrl,
          municipality_id: input.municipalityId,
          force_refresh: input.forceRefresh,
          generate_embeddings: input.generateEmbeddings,
        });
        
        return {
          success: true,
          status: result.status,
          municipalityName: result.municipality_name,
          pdmDocumentsUpdated: result.pdm_documents_updated,
          jsonConversion: result.json_conversion,
          embeddingsGeneration: result.embeddings_generation,
          processingTime: result.processing_time,
          readyForQueries: result.ready_for_queries,
        };
      } catch (error) {
        console.error('Error processing PDM document:', error);
        throw new Error(`Failed to process PDM document: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),
});
