import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { db } from "../../../lib/db";
import {
  organizationsTable,
  enrichedPlots,
  organizationPlotsTable,
  processStepsTable,
  organizationStepsTable,
  membersTable,
  chatsTable,
  pdmRequestsTable,
  usersTable,
  sessionsTable,
} from "../../../lib/db/schema";
import { eq, and, inArray, asc, isNull, sql } from "drizzle-orm";

export const projectsRouter = router({
  // Select plot for organization (organization = project)
  selectPlotForOrganization: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        plotId: z.string().uuid(),
        searchFilters: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user is a member of the organization
      const [membership] = await db
        .select()
        .from(membersTable)
        .where(
          and(
            eq(membersTable.userId, ctx.user.id),
            eq(membersTable.organizationId, input.organizationId)
          )
        )
        .limit(1);

      if (!membership) {
        throw new Error("You are not a member of this organization");
      }

      // Verify plot exists
      const [plot] = await db
        .select()
        .from(enrichedPlots)
        .where(eq(enrichedPlots.id, input.plotId))
        .limit(1);

      if (!plot) {
        throw new Error("Plot not found");
      }

      // Check if organization_plot already exists
      const [existingOrgPlot] = await db
        .select()
        .from(organizationPlotsTable)
        .where(
          and(
            eq(organizationPlotsTable.organizationId, input.organizationId),
            eq(organizationPlotsTable.plotId, input.plotId)
          )
        )
        .limit(1);

      // Create organization_plot if it doesn't exist
      if (!existingOrgPlot) {
        await db.insert(organizationPlotsTable).values({
          organizationId: input.organizationId,
          plotId: input.plotId,
          status: "interested",
        });
      }

      // Update organization with selected plot (ignore searchFilters here)
      const [updatedOrg] = await db
        .update(organizationsTable)
        .set({
          selectedPlotId: input.plotId,
        })
        .where(eq(organizationsTable.id, input.organizationId))
        .returning();

      return updatedOrg;
    }),

  // Mark plots as outreach_sent (fallback or manual confirmation after send)
  markOutreachSent: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        plotIds: z.array(z.string().uuid()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user is a member of the organization
      const [membership] = await db
        .select()
        .from(membersTable)
        .where(
          and(
            eq(membersTable.userId, ctx.user.id),
            eq(membersTable.organizationId, input.organizationId)
          )
        )
        .limit(1);

      if (!membership) {
        throw new Error("You are not a member of this organization");
      }

      const updated = await db
        .update(organizationPlotsTable)
        .set({ status: 'outreach_sent' })
        .where(
          and(
            eq(organizationPlotsTable.organizationId, input.organizationId),
            inArray(organizationPlotsTable.plotId, input.plotIds)
          )
        )
        .returning({ plotId: organizationPlotsTable.plotId });

      return { updatedCount: updated.length, plotIds: updated.map(u => u.plotId) };
    }),

  // Update selected plot for an organization
  updateSelectedPlot: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        plotId: z.string().uuid().optional(), // Optional - if empty, removes selected plot
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user is a member of the organization
      const [membership] = await db
        .select()
        .from(membersTable)
        .where(
          and(
            eq(membersTable.userId, ctx.user.id),
            eq(membersTable.organizationId, input.organizationId)
          )
        )
        .limit(1);

      if (!membership) {
        throw new Error("You are not a member of this organization");
      }

      // If plotId is provided, verify it exists
      if (input.plotId) {
        const [plot] = await db
          .select()
          .from(enrichedPlots)
          .where(eq(enrichedPlots.id, input.plotId))
          .limit(1);

        if (!plot) {
          throw new Error("Plot not found");
        }
      }

      // Update organization selected plot (null to clear)
      const [updatedOrg] = await db
        .update(organizationsTable)
        .set({
          selectedPlotId: input.plotId || null,
        })
        .where(eq(organizationsTable.id, input.organizationId))
        .returning();

      return updatedOrg;
    }),

  // Get organization's data (used to be project data)
  getOrganizationProject: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify user is a member of the organization
      const [membership] = await db
        .select()
        .from(membersTable)
        .where(
          and(
            eq(membersTable.userId, ctx.user.id),
            eq(membersTable.organizationId, input.organizationId)
          )
        )
        .limit(1);

      if (!membership) {
        throw new Error("You are not a member of this organization");
      }

      // Return the organization row
      const [org] = await db
        .select()
        .from(organizationsTable)
        .where(eq(organizationsTable.id, input.organizationId))
        .limit(1);
      if (!org) return null;

      // Compute derived simple stage based on organization plots and their statuses
      // Rules:
      // 1) No organization plots -> "Add plots"
      // 2) Has at least one plot -> "Contact realtors"
      // 3) If any outreach emails sent (status='outreach_sent') and no replies yet -> "Waiting for realtors response"
      // 4) If any replies or beyond (realtor_replied/viewing_scheduled/offer_made/purchased) -> "Contact local expert"

      // Count total plots for this organization
      const [{ count: plotCountStr }] = await db
        .select({ count: sql`count(*)`.as('count') })
        .from(organizationPlotsTable)
        .where(eq(organizationPlotsTable.organizationId, input.organizationId));
      const plotCount = Number((plotCountStr as unknown) as string | number);

      let computedStage = 'Add plots';
      if (plotCount > 0) {
        // Count plots with outreach sent
        const [{ count: outreachCountStr }] = await db
          .select({ count: sql`count(*)`.as('count') })
          .from(organizationPlotsTable)
          .where(
            and(
              eq(organizationPlotsTable.organizationId, input.organizationId),
              eq(organizationPlotsTable.status, 'outreach_sent')
            )
          );
        const outreachCount = Number((outreachCountStr as unknown) as string | number);

        // Count plots with replies or beyond
        const [{ count: repliedOrBeyondStr }] = await db
          .select({ count: sql`count(*)`.as('count') })
          .from(organizationPlotsTable)
          .where(
            and(
              eq(organizationPlotsTable.organizationId, input.organizationId),
              inArray(organizationPlotsTable.status, [
                'realtor_replied',
                'viewing_scheduled',
                'offer_made',
                'purchased',
              ])
            )
          );
        const repliedOrBeyond = Number((repliedOrBeyondStr as unknown) as string | number);

        if (repliedOrBeyond > 0) {
          computedStage = 'Contact local expert';
        } else if (outreachCount > 0) {
          computedStage = 'Waiting for realtors response';
        } else {
          computedStage = 'Contact realtors';
        }
      }

      return { ...org, computedStage } as typeof org & { computedStage: string };
    }),

  // Get organization data for a chat
  getProjectData: protectedProcedure
    .input(
      z.object({
        chatId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Get the organization for this chat
      const [chatData] = await db
        .select({
          organizationId: chatsTable.organizationId,
        })
        .from(chatsTable)
        .innerJoin(
          membersTable,
          and(
            eq(membersTable.organizationId, chatsTable.organizationId),
            eq(membersTable.userId, ctx.user.id)
          )
        )
        .where(eq(chatsTable.id, input.chatId))
        .limit(1);

      if (!chatData) {
        return null; // No access or chat not found
      }

      // Get organization data with current stage details
      const [orgWithStage] = await db
        .select({
          id: organizationsTable.id,
          organizationId: organizationsTable.id,
          name: organizationsTable.name,
          status: organizationsTable.status,
          selectedPlotId: organizationsTable.selectedPlotId,
          currentStage: organizationsTable.currentStage,
          createdAt: organizationsTable.createdAt,
          currentStageDetails: processStepsTable,
        })
        .from(organizationsTable)
        .leftJoin(
          processStepsTable,
          eq(organizationsTable.currentStage, processStepsTable.id)
        )
        .where(eq(organizationsTable.id, chatData.organizationId))
        .limit(1);

      if (!orgWithStage) {
        return null; // Organization not found
      }

      return {
        id: orgWithStage.id,
        organizationId: orgWithStage.organizationId,
        name: orgWithStage.name,
        status: orgWithStage.status,
        selectedPlotId: orgWithStage.selectedPlotId,
        currentStage: orgWithStage.currentStage,
        createdAt: orgWithStage.createdAt,
        currentStageDetails: orgWithStage.currentStageDetails,
      };
    }),

  // Get project plots for a chat (legacy - now maps to organization)
  getProjectPlots: protectedProcedure
    .input(
      z.object({
        chatId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Get the organization for this chat
      const [chatData] = await db
        .select({
          organizationId: chatsTable.organizationId,
        })
        .from(chatsTable)
        .innerJoin(
          membersTable,
          and(
            eq(membersTable.organizationId, chatsTable.organizationId),
            eq(membersTable.userId, ctx.user.id)
          )
        )
        .where(eq(chatsTable.id, input.chatId))
        .limit(1);

      if (!chatData) {
        return null; // No access or chat not found
      }

      // Get organization data
      const [organization] = await db
        .select()
        .from(organizationsTable)
        .where(eq(organizationsTable.id, chatData.organizationId))
        .limit(1);

      if (!organization) {
        return null; // Organization not found
      }

      // Get organization plots with plot details
      const organizationPlots = await db
        .select({
          id: organizationPlotsTable.id,
          organizationId: organizationPlotsTable.organizationId,
          plotId: organizationPlotsTable.plotId,
          status: organizationPlotsTable.status,
          realtorEmail: organizationPlotsTable.realtorEmail,
          realtorName: organizationPlotsTable.realtorName,
          createdAt: organizationPlotsTable.createdAt,
          // Plot details
          plotPrice: enrichedPlots.price,
          plotSize: enrichedPlots.size,
          plotLatitude: enrichedPlots.latitude,
          plotLongitude: enrichedPlots.longitude,
          plotImages: enrichedPlots.images,
          plotEnrichmentData: enrichedPlots.enrichmentData,
        })
        .from(organizationPlotsTable)
        .leftJoin(
          enrichedPlots,
          eq(organizationPlotsTable.plotId, enrichedPlots.id)
        )
        .where(
          eq(organizationPlotsTable.organizationId, chatData.organizationId)
        )
        .orderBy(organizationPlotsTable.createdAt);

      return {
        project: organization, // For backward compatibility
        projectPlots: organizationPlots,
      };
    }),

  // Initiate outreach for all plots matching current results
  initiateOutreach: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        plotIds: z.array(z.string().uuid()),
        searchFilters: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user is a member of the organization
      const [membership] = await db
        .select()
        .from(membersTable)
        .where(
          and(
            eq(membersTable.userId, ctx.user.id),
            eq(membersTable.organizationId, input.organizationId)
          )
        )
        .limit(1);

      if (!membership) {
        throw new Error("You are not a member of this organization");
      }

      if (!input.plotIds.length) {
        throw new Error("No plots provided for outreach");
      }

      // Verify all plot IDs exist
      const plots = await db
        .select({ id: enrichedPlots.id })
        .from(enrichedPlots)
        .where(inArray(enrichedPlots.id, input.plotIds));

      if (plots.length !== input.plotIds.length) {
        throw new Error("Some plot IDs are invalid");
      }

      // Get existing organization plots to avoid duplicates
      const existingOrgPlots = await db
        .select({ plotId: organizationPlotsTable.plotId })
        .from(organizationPlotsTable)
        .where(eq(organizationPlotsTable.organizationId, input.organizationId));

      const existingPlotIds = new Set(existingOrgPlots.map((pp) => pp.plotId));

      // Create organization_plot entries for new plots
      const newPlotIds = input.plotIds.filter(
        (plotId) => !existingPlotIds.has(plotId)
      );

      if (newPlotIds.length > 0) {
        await db.insert(organizationPlotsTable).values(
          newPlotIds.map((plotId) => ({
            organizationId: input.organizationId,
            plotId,
            status: "interested" as const,
          }))
        );
      }

      // Create organization steps if they don't exist (user is now serious about acquisition)
      let organizationStepsCreated = false;
      let stepsCreatedCount = 0;

      try {
        // Check if organization steps already exist
        const existingOrgSteps = await db
          .select()
          .from(organizationStepsTable)
          .where(
            eq(organizationStepsTable.organizationId, input.organizationId)
          )
          .limit(1);

        if (existingOrgSteps.length === 0) {
          // Get all process steps
          const processSteps = await db
            .select({
              id: processStepsTable.id,
              yonderPartnerId: processStepsTable.yonderPartnerId,
            })
            .from(processStepsTable)
            .orderBy(asc(processStepsTable.orderIndex));

          // Create organization steps for all process steps
          const orgStepsToInsert = processSteps.map((processStep) => ({
            organizationId: input.organizationId,
            processStepId: processStep.id,
            status: "pending" as const,
            assignedTo: processStep.yonderPartnerId, // Auto-assign to Yonder partner if available
          }));

          const createdOrgSteps = await db
            .insert(organizationStepsTable)
            .values(orgStepsToInsert)
            .returning();

          organizationStepsCreated = true;
          stepsCreatedCount = createdOrgSteps.length;
        }
      } catch (error) {
        // Don't fail the entire outreach if organization steps creation fails
        console.error("Failed to create organization steps:", error);
      }

      return {
        project: null, // No separate projects table
        totalPlotsProvided: input.plotIds.length,
        newPlotsAdded: newPlotIds.length,
        existingPlotsSkipped: input.plotIds.length - newPlotIds.length,
        projectStepsCreated: organizationStepsCreated,
        stepsCreatedCount,
      };
    }),

  // Get organization current stage
  getProjectCurrentStage: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify user is a member of the organization
      const [membership] = await db
        .select()
        .from(membersTable)
        .where(
          and(
            eq(membersTable.userId, ctx.user.id),
            eq(membersTable.organizationId, input.organizationId)
          )
        )
        .limit(1);

      if (!membership) {
        throw new Error("You are not a member of this organization");
      }

      const [org] = await db
        .select({
          id: organizationsTable.id,
          status: organizationsTable.status,
          currentStage: organizationsTable.currentStage,
          currentStageDetails: processStepsTable,
        })
        .from(organizationsTable)
        .leftJoin(
          processStepsTable,
          eq(organizationsTable.currentStage, processStepsTable.id)
        )
        .where(eq(organizationsTable.id, input.organizationId))
        .limit(1);

      if (!org) {
        throw new Error("Organization not found");
      }

      return org;
    }),

  // Update organization status and current stage
  updateProjectStatus: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        status: z.string().optional(), // Project status (active, paused, completed, etc.)
        currentStage: z.string().optional(), // Process step ID
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user is a member of the organization
      const [membership] = await db
        .select()
        .from(membersTable)
        .where(
          and(
            eq(membersTable.userId, ctx.user.id),
            eq(membersTable.organizationId, input.organizationId)
          )
        )
        .limit(1);

      if (!membership) {
        throw new Error("You are not a member of this organization");
      }

      // If currentStage is provided, verify it exists
      if (input.currentStage) {
        const [processStep] = await db
          .select()
          .from(processStepsTable)
          .where(eq(processStepsTable.id, input.currentStage))
          .limit(1);

        if (!processStep) {
          throw new Error("Process step not found");
        }
      }

      // Build update object with only provided fields
      const updateData: Partial<typeof organizationsTable.$inferInsert> = {};
      if (input.status !== undefined) updateData.status = input.status;
      if (input.currentStage !== undefined)
        updateData.currentStage = input.currentStage;

      if (Object.keys(updateData).length === 0) {
        throw new Error("No fields to update");
      }

      // Update organization
      const [updatedOrg] = await db
        .update(organizationsTable)
        .set(updateData)
        .where(eq(organizationsTable.id, input.organizationId))
        .returning();

      return updatedOrg;
    }),

  // Get organization plots for an organization
  getOrganizationPlots: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify user is a member of the organization
      const [membership] = await db
        .select()
        .from(membersTable)
        .where(
          and(
            eq(membersTable.userId, ctx.user.id),
            eq(membersTable.organizationId, input.organizationId)
          )
        )
        .limit(1);

      if (!membership) {
        throw new Error("You are not a member of this organization");
      }

      // Get organization plots with plot details
      const organizationPlots = await db
        .select({
          id: organizationPlotsTable.id,
          organizationId: organizationPlotsTable.organizationId,
          plotId: organizationPlotsTable.plotId,
          status: organizationPlotsTable.status,
          realtorEmail: organizationPlotsTable.realtorEmail,
          realtorName: organizationPlotsTable.realtorName,
          createdAt: organizationPlotsTable.createdAt,
          // Plot details
          plotPrice: enrichedPlots.price,
          plotSize: enrichedPlots.size,
          plotLatitude: enrichedPlots.latitude,
          plotLongitude: enrichedPlots.longitude,
          plotImages: enrichedPlots.images,
          plotEnrichmentData: enrichedPlots.enrichmentData,
        })
        .from(organizationPlotsTable)
        .leftJoin(
          enrichedPlots,
          eq(organizationPlotsTable.plotId, enrichedPlots.id)
        )
        .where(eq(organizationPlotsTable.organizationId, input.organizationId))
        .orderBy(organizationPlotsTable.createdAt);

      return organizationPlots;
    }),

  // List all available realtors (users with role 'realtor')
  listRealtors: protectedProcedure
    .query(async () => {
      // Any authenticated user can list available realtors
      const rows = await db
        .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.role, 'realtor'))
        .orderBy(asc(usersTable.name));

      return rows;
    }),

  // Assign or clear a realtor for a specific plot in an organization (project)
  setPlotRealtor: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        plotId: z.string().uuid(),
        realtorEmail: z.string().optional(),
        realtorName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user is a member of the organization
      const [membership] = await db
        .select()
        .from(membersTable)
        .where(
          and(
            eq(membersTable.userId, ctx.user.id),
            eq(membersTable.organizationId, input.organizationId)
          )
        )
        .limit(1);

      if (!membership) {
        throw new Error("You are not a member of this organization");
      }

      const [updated] = await db
        .update(organizationPlotsTable)
        .set({
          realtorEmail: input.realtorEmail ?? null,
          realtorName: input.realtorName ?? null,
        })
        .where(
          and(
            eq(organizationPlotsTable.organizationId, input.organizationId),
            eq(organizationPlotsTable.plotId, input.plotId)
          )
        )
        .returning();

      if (!updated) {
        throw new Error('Plot not found in this organization');
      }

      return updated;
    }),

  // Remove plots from an organization (project)
  removePlotsFromOrganization: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        plotIds: z.array(z.string().uuid()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user is a member of the organization
      const [membership] = await db
        .select()
        .from(membersTable)
        .where(
          and(
            eq(membersTable.userId, ctx.user.id),
            eq(membersTable.organizationId, input.organizationId)
          )
        )
        .limit(1);

      if (!membership) {
        throw new Error("You are not a member of this organization");
      }

      // Fetch current selected plot to clear if needed
      const [org] = await db
        .select({ selectedPlotId: organizationsTable.selectedPlotId })
        .from(organizationsTable)
        .where(eq(organizationsTable.id, input.organizationId))
        .limit(1);

      // Delete organization_plot rows for the provided plot IDs
      const deleted = await db
        .delete(organizationPlotsTable)
        .where(
          and(
            eq(organizationPlotsTable.organizationId, input.organizationId),
            inArray(organizationPlotsTable.plotId, input.plotIds)
          )
        )
        .returning({ plotId: organizationPlotsTable.plotId });

      // If the selected plot is among the removed, clear it
      let selectedCleared = false;
      if (org?.selectedPlotId && input.plotIds.includes(org.selectedPlotId)) {
        await db
          .update(organizationsTable)
          .set({ selectedPlotId: null })
          .where(eq(organizationsTable.id, input.organizationId));
        selectedCleared = true;
      }

      return {
        removedCount: deleted.length,
        selectedCleared,
      };
    }),

  deleteOrganization: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [ownerMembership] = await db
        .select({ id: membersTable.id })
        .from(membersTable)
        .where(and(eq(membersTable.organizationId, input.organizationId), eq(membersTable.userId, ctx.user.id), eq(membersTable.role, "owner")))
        .limit(1);

      let isAdmin = false;
      if (!ownerMembership) {
        const [u] = await db
          .select({ role: usersTable.role })
          .from(usersTable)
          .where(eq(usersTable.id, ctx.user.id))
          .limit(1);
        isAdmin = !!u && u.role === "admin";
      }

      if (!ownerMembership && !isAdmin) {
        throw new Error("Only the owner or an admin can delete this project");
      }

      await db
        .update(sessionsTable)
        .set({ activeOrganizationId: null })
        .where(eq(sessionsTable.activeOrganizationId, input.organizationId));

      const deleted = await db
        .delete(organizationsTable)
        .where(eq(organizationsTable.id, input.organizationId))
        .returning({ id: organizationsTable.id });

      if (deleted.length === 0) {
        throw new Error("Organization not found");
      }

      return { id: deleted[0].id };
    }),

  // Realtor outreach: find realtor contacts for plots and optionally send emails
  realtorOutreach: protectedProcedure
    .input(z.object({
      organizationId: z.string(),
      plotIds: z.array(z.string().uuid()).min(1),
      emailSubject: z.string().optional(),
      emailBody: z.string().optional(),
      dryRun: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user is a member of the organization
      const [membership] = await db
        .select()
        .from(membersTable)
        .where(and(
          eq(membersTable.userId, ctx.user.id),
          eq(membersTable.organizationId, input.organizationId)
        ))
        .limit(1);

      if (!membership) {
        throw new Error('You are not a member of this organization');
      }

      if (!input.plotIds.length) {
        throw new Error('No plots provided for outreach');
      }

      // Ensure organization_plot entries exist for provided plot IDs
      const existingOrgPlots = await db
        .select({ plotId: organizationPlotsTable.plotId })
        .from(organizationPlotsTable)
        .where(eq(organizationPlotsTable.organizationId, input.organizationId));

      const existingPlotIds = new Set(existingOrgPlots.map(p => p.plotId));
      const newPlotIds = input.plotIds.filter(id => !existingPlotIds.has(id));

      if (newPlotIds.length > 0) {
        await db.insert(organizationPlotsTable).values(
          newPlotIds.map(plotId => ({
            organizationId: input.organizationId,
            plotId,
            status: 'interested' as const,
          }))
        );
      }

      // Fetch plot records
      const plots = await db
        .select({
          id: enrichedPlots.id,
          price: enrichedPlots.price,
          size: enrichedPlots.size,
        })
        .from(enrichedPlots)
        .where(inArray(enrichedPlots.id, input.plotIds));

      if (plots.length !== input.plotIds.length) {
        throw new Error('Some plot IDs are invalid');
      }

      // Realtor contact lookup based on external unique IDs has been removed.
      // Use assigned contacts on organization_plots if present.

      // Load assigned contacts for these plots (if any)
      const orgPlotContacts = await db
        .select({
          plotId: organizationPlotsTable.plotId,
          realtorEmail: organizationPlotsTable.realtorEmail,
          realtorName: organizationPlotsTable.realtorName,
        })
        .from(organizationPlotsTable)
        .where(
          and(
            eq(organizationPlotsTable.organizationId, input.organizationId),
            inArray(organizationPlotsTable.plotId, input.plotIds)
          )
        );

      const contactsByPlot = new Map<string, { realtorEmail: string | null; realtorName: string | null }>();
      for (const c of orgPlotContacts) {
        contactsByPlot.set(c.plotId, { realtorEmail: c.realtorEmail ?? null, realtorName: c.realtorName ?? null });
      }

      // Helper to detect drizzle execute return shape
      function hasRows<T>(v: unknown): v is { rows: T[] } {
        return typeof v === 'object' && v !== null && 'rows' in v;
      }

      type RealtorJoinRow = {
        id: number;
        company_name: string;
        email: string | null;
        telephone: string | null;
        website_url: string;
        role: string;
        contact_name: string;
        source_file: string | null;
      };

      const hasEmailProvider = !!process.env.RESEND_API_KEY;
      const defaultSubject = input.emailSubject || 'Inquiry about your land listing';
      const defaultBody = input.emailBody || 'Hello,\n\nI am interested in your land listing. Could we discuss availability, zoning, and next steps?\n\nBest regards,';

      const results: Array<{
        plotId: string;
        realtorEmail: string | null;
        realtorName: string | null;
        suggestedRealtors?: Array<{ email: string | null; name: string; company: string; role: string }>; 
        sent: boolean;
        error?: string;
      }> = [];

      for (const plot of plots) {
        const assigned = contactsByPlot.get(plot.id) || { realtorEmail: null, realtorName: null };

        // Lookup suggested contacts from new tables
        const raw = await db.execute(sql<RealtorJoinRow>`
          SELECT 
            r.id,
            r.company_name,
            r.email,
            r.telephone,
            r.website_url,
            psr.role,
            psr.name AS contact_name,
            psr.source_file
          FROM plots_stage_realtors psr
          JOIN realtors r ON r.id = psr.realtor_id
          WHERE psr.plot_id = ${plot.id}
        `);
        const rows: RealtorJoinRow[] = hasRows<RealtorJoinRow>(raw) ? raw.rows : (raw as unknown as RealtorJoinRow[]) ?? [];
        // Build suggestions; prefer entries with an email
        const suggestions = rows.map(r => ({
          email: r.email,
          name: (r.contact_name || r.company_name) as string,
          company: r.company_name,
          role: r.role,
        }));

        // Determine effective selection for preview
        let realtorEmail: string | null = assigned.realtorEmail ?? null;
        let realtorName: string | null = assigned.realtorName ?? null;
        if (!realtorEmail) {
          const firstWithEmail = suggestions.find(s => !!s.email);
          if (firstWithEmail) {
            realtorEmail = firstWithEmail.email!;
            realtorName = firstWithEmail.name;
          }
        }

        let sent = false;
        let error: string | undefined;

        // If not dryRun, try to send email via Resend API if configured
        if (!input.dryRun) {
          if (!realtorEmail) {
            error = 'No realtor email found';
          } else if (!hasEmailProvider) {
            error = 'Email provider not configured (set RESEND_API_KEY)';
          } else {
            try {
              const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
              const plotUrl = `${baseUrl}/plot/${plot.id}`;
              const effectiveBody = defaultBody.includes('{{plot_url}}')
                ? defaultBody.replace(/\{\{plot_url\}\}/g, plotUrl)
                : `${defaultBody}\n\nView plot: ${plotUrl}`;
              const payload = {
                from: 'Yonder <no-reply@yonder.land>',
                to: [realtorEmail],
                subject: defaultSubject,
                html: `<p>${effectiveBody
                  .split('\n')
                  .map(line => line.trim())
                  .filter(Boolean)
                  .map(line => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
                  .join('</p><p>')}</p>`
              };

              const resp = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
              });

              if (!resp.ok) {
                const text = await resp.text();
                throw new Error(`Resend API error: ${resp.status} ${text}`);
              }

              sent = true;

              // Update organization plot record with contact + status
              await db
                .update(organizationPlotsTable)
                .set({
                  realtorEmail: realtorEmail,
                  realtorName: realtorName || null,
                  status: 'outreach_sent',
                })
                .where(and(
                  eq(organizationPlotsTable.organizationId, input.organizationId),
                  eq(organizationPlotsTable.plotId, plot.id)
                ));
            } catch (e) {
              error = e instanceof Error ? e.message : 'Unknown email error';
            }
          }
        }

        // If dry run or send failed but we have contact info, upsert contact fields without changing status
        if ((input.dryRun || !sent) && realtorEmail) {
          await db
            .update(organizationPlotsTable)
            .set({
              realtorEmail: realtorEmail,
              realtorName: realtorName || null,
            })
            .where(and(
              eq(organizationPlotsTable.organizationId, input.organizationId),
              eq(organizationPlotsTable.plotId, plot.id)
            ));
        }

        results.push({
          plotId: plot.id,
          realtorEmail,
          realtorName,
          suggestedRealtors: suggestions,
          sent,
          ...(error ? { error } : {}),
        });
      }

      return {
        organizationId: input.organizationId,
        totalPlots: input.plotIds.length,
        contactsFound: results.filter(r => !!r.realtorEmail).length,
        emailsSent: results.filter(r => r.sent).length,
        dryRun: input.dryRun,
        emailProviderConfigured: hasEmailProvider,
        results,
      };
    }),
  // PDM Request procedures (for regular users)
  createPdmRequest: protectedProcedure
    .input(
      z.object({
        chatId: z.string().optional(),
        organizationId: z.string().optional(),
        plotId: z.string().uuid(),
        municipalityId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Idempotent create: unique on (municipalityId, plotId, organizationId, userId)
      const [existing] = await db
        .select()
        .from(pdmRequestsTable)
        .where(
          and(
            eq(pdmRequestsTable.municipalityId, input.municipalityId),
            eq(pdmRequestsTable.plotId, input.plotId),
            eq(pdmRequestsTable.userId, ctx.user.id),
            input.organizationId
              ? eq(pdmRequestsTable.organizationId, input.organizationId)
              : isNull(pdmRequestsTable.organizationId)
          )
        )
        .limit(1);

      if (existing) {
        return {
          id: existing.id,
          status: existing.status,
          alreadyExists: true,
        };
      }

      const [created] = await db
        .insert(pdmRequestsTable)
        .values({
          chatId: input.chatId,
          organizationId: input.organizationId || null,
          plotId: input.plotId,
          municipalityId: input.municipalityId,
          userId: ctx.user.id,
          status: "pending",
        })
        .returning();

      return { id: created.id, status: created.status, alreadyExists: false };
    }),

  myPdmRequestStatus: protectedProcedure
    .input(
      z.object({
        plotId: z.string().uuid(),
        municipalityId: z.number(),
        organizationId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const [row] = await db
        .select({ id: pdmRequestsTable.id, status: pdmRequestsTable.status })
        .from(pdmRequestsTable)
        .where(
          and(
            eq(pdmRequestsTable.municipalityId, input.municipalityId),
            eq(pdmRequestsTable.plotId, input.plotId),
            eq(pdmRequestsTable.userId, ctx.user.id),
            input.organizationId
              ? eq(pdmRequestsTable.organizationId, input.organizationId)
              : isNull(pdmRequestsTable.organizationId)
          )
        )
        .limit(1);
      if (!row) return { requested: false };
      return { requested: true, status: row.status };
    }),
});
