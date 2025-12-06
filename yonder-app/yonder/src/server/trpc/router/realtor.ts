import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { db } from '../../../lib/db';
import {
  usersTable,
  organizationsTable,
  organizationPlotsTable,
  enrichedPlots,
  enrichedPlotsStage,
  plots,
  plotsStage,
  municipalities,
} from '../../../lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { enrichLocation } from '../../../lib/utils/remote-clients/yonder-enrich-client';

function hasRowsResult(val: unknown): val is { rows: unknown[] } {
  if (typeof val !== 'object' || val === null) return false;
  const obj = val as Record<string, unknown>;
  return Array.isArray(obj.rows);
}

async function requireRealtor(userId: string) {
  const user = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user[0] || user[0].role !== 'realtor') {
    throw new Error('Realtor access required');
  }
}

async function requireAdmin(userId: string) {
  const user = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user[0] || user[0].role !== 'admin') {
    throw new Error('Admin access required');
  }
}

export const realtorRouter = router({
  // Safe check for realtor status without throwing
  isRealtor: protectedProcedure.query(async ({ ctx }) => {
    const user = await db
      .select({ role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, ctx.user.id))
      .limit(1);
    return { isRealtor: !!user[0] && user[0].role === 'realtor' };
  }),

  // Get plots assigned to this realtor by email
  getAssignedOutreachRequests: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(20),
        status: z
          .enum([
            'interested',
            'outreach_sent',
            'realtor_replied',
            'viewing_scheduled',
            'offer_made',
            'purchased',
            'declined',
          ])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireRealtor(ctx.user.id);

      // Get realtor's email
      const [user] = await db
        .select({ email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, ctx.user.id))
        .limit(1);

      if (!user) {
        throw new Error('User not found');
      }

      // Determine if the user's email domain matches a known realtor company domain
      const email = String(user.email || '').toLowerCase();
      const domain = email.includes('@') ? email.split('@')[1] : '';
      let useDomainMatch = false;
      if (domain) {
        try {
          const existsRes = await db.execute(
            sql`SELECT 1 FROM realtors WHERE (website_url ILIKE ${'%' + domain + '%'} OR email ILIKE ${'%' + '@' + domain}) LIMIT 1`
          );
          const hasRows = hasRowsResult(existsRes) && existsRes.rows.length > 0;
          useDomainMatch = !!hasRows;
        } catch {
          useDomainMatch = false;
        }
      }

      const { page, limit, status } = input;
      const offset = (page - 1) * limit;

      const whereStatus = status
        ? eq(organizationPlotsTable.status, status)
        : sql`1=1`;

      // Prefer matching by realtor company domain when available; otherwise fall back to exact email match
      const whereAssignee = useDomainMatch
        ? sql`${organizationPlotsTable.realtorEmail} ILIKE ${'%' + '@' + domain}`
        : eq(organizationPlotsTable.realtorEmail, user.email);

      // Get assigned plots with project info
      const assigned = await db
        .select({
          organization: organizationsTable,
          orgPlot: organizationPlotsTable,
          plotId: enrichedPlots.id,
          plotPrice: enrichedPlots.price,
          plotSize: enrichedPlots.size,
          plotImages: enrichedPlots.images,
          municipalityName: municipalities.name,
          municipalityDistrict: municipalities.district,
          municipalityCountry: municipalities.country,
          plotLatitude: enrichedPlots.latitude,
          plotLongitude: enrichedPlots.longitude,
          plotEnrichmentData: enrichedPlots.enrichmentData,
          // Extract address directly from JSONB using PostgreSQL operators
          plotAddress: sql<string | null>`${enrichedPlots.enrichmentData}->'cadastral'->>'address'`.as('plot_address'),
          // Realtor-provided accurate location data (hidden from free users)
          plotRealLatitude: enrichedPlots.realLatitude,
          plotRealLongitude: enrichedPlots.realLongitude,
          plotRealAddress: enrichedPlots.realAddress,
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
        .leftJoin(
          municipalities,
          eq(enrichedPlots.municipalityId, municipalities.id)
        )
        .where(and(whereAssignee, whereStatus))
        .orderBy(desc(organizationPlotsTable.createdAt))
        .limit(limit)
        .offset(offset);

      // Count
      const [{ count }] = await db
        .select({ count: sql`count(*)`.as('count') })
        .from(organizationPlotsTable)
        .where(and(whereAssignee, whereStatus));

      return {
        items: assigned.map((row) => ({
          project: row.organization,
          plot: {
            id: row.plotId,
            price: row.plotPrice,
            size: row.plotSize,
            images: row.plotImages,
            latitude: row.plotLatitude,
            longitude: row.plotLongitude,
            enrichmentData: row.plotEnrichmentData,
            address: row.plotAddress,
            realLatitude: row.plotRealLatitude,
            realLongitude: row.plotRealLongitude,
            realAddress: row.plotRealAddress,
          },
          organizationPlot: row.orgPlot,
          municipality: {
            name: row.municipalityName ?? null,
            district: row.municipalityDistrict ?? null,
            country: row.municipalityCountry ?? 'PT',
          },
        })),
        pagination: {
          page,
          limit,
          totalCount: Number(count),
          totalPages: Math.ceil(Number(count) / limit),
        },
      };
    }),

  // Realtor updates plot's accurate location data (separate from public coordinates)
  updatePlotLocation: protectedProcedure
    .input(
      z.object({
        plotId: z.string().uuid(),
        realLatitude: z.number().min(-90).max(90).optional(),
        realLongitude: z.number().min(-180).max(180).optional(),
        realAddress: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireRealtor(ctx.user.id);

      const { plotId, realLatitude, realLongitude, realAddress } = input;

      // Verify the realtor has access to this plot
      const [user] = await db
        .select({ email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, ctx.user.id))
        .limit(1);

      if (!user) {
        throw new Error('User not found');
      }

      // Check if realtor is assigned to this plot
      const email = String(user.email || '').toLowerCase();
      const domain = email.includes('@') ? email.split('@')[1] : '';
      let domainAuthorized = false;
      if (domain) {
        try {
          const existsRes = await db.execute(
            sql`SELECT 1 FROM realtors WHERE (website_url ILIKE ${'%' + domain + '%'} OR email ILIKE ${'%' + '@' + domain}) LIMIT 1`
          );
          const hasRows = hasRowsResult(existsRes) && existsRes.rows.length > 0;
          domainAuthorized = !!hasRows;
        } catch {
          domainAuthorized = false;
        }
      }

      const whereAssignee = domainAuthorized
        ? sql`${organizationPlotsTable.realtorEmail} ILIKE ${'%' + '@' + domain}`
        : eq(organizationPlotsTable.realtorEmail, user.email);

      const assignedPlot = await db
        .select({ id: organizationPlotsTable.id })
        .from(organizationPlotsTable)
        .where(and(eq(organizationPlotsTable.plotId, plotId), whereAssignee))
        .limit(1);

      if (!assignedPlot[0]) {
        throw new Error('You do not have access to update this plot');
      }

      // Build update object for realtor-provided accurate location data
      const updates: Record<string, unknown> = {};
      
      if (realLatitude !== undefined) {
        updates.realLatitude = realLatitude;
      }
      
      if (realLongitude !== undefined) {
        updates.realLongitude = realLongitude;
      }

      if (realAddress !== undefined) {
        updates.realAddress = realAddress;
      }

      if (Object.keys(updates).length === 0) {
        throw new Error('No updates provided');
      }

      // Update enriched_plots_stage with realtor-provided accurate data
      // Note: This does NOT modify the public latitude/longitude/address
      const [updated] = await db
        .update(enrichedPlotsStage)
        .set(updates)
        .where(eq(enrichedPlotsStage.id, plotId))
        .returning();

      // Refresh the materialized view to reflect changes
      // Only refresh if we're using the materialized view (prod mode)
      const useProdTables = (process.env.PLOTS_TABLE_ENV || 'stage').toLowerCase() === 'prod';
      if (useProdTables) {
        await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY enriched_plots`);
      }

      // Call the enrichment webservice with the new coordinates
      // Only call if both coordinates were provided
      if (realLatitude !== undefined && realLongitude !== undefined) {
        try {
          const enrichmentData = await enrichLocation({
            latitude: realLatitude,
            longitude: realLongitude,
            plot_id: plotId,
            store_results: true,
          });
          
          console.log('Plot enrichment updated successfully:', {
            plotId,
            enrichments_run: enrichmentData.enrichments_run,
            enrichments_failed: enrichmentData.enrichments_failed,
          });

          // Clear the plot report data so it gets regenerated with new enrichment data
          // Only clear if enrichments were successful (at least one enrichment ran)
          if (enrichmentData.enrichments_run.length > 0) {
            await db
              .update(enrichedPlotsStage)
              .set({
                plotReportUrl: null,
                plotReportJson: null,
              })
              .where(eq(enrichedPlotsStage.id, plotId));
            
            console.log('Plot report data cleared for regeneration');
          }

          // Refresh materialized view again to include the enrichment data updates
          // The enrichment service updates enriched_plots_stage, so we need another refresh
          if (useProdTables) {
            await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY enriched_plots`);
            console.log('Materialized view refreshed after enrichment');
          }
        } catch (error) {
          // Log but don't fail the request if enrichment service is down
          console.error('Failed to call enrichment service:', error);
        }
      }

      return {
        success: true,
        plot: updated,
      };
    }),

  // Realtor accepts an assigned outreach request for a specific organization_plot
  acceptAssignedOutreachRequest: protectedProcedure
    .input(
      z.object({
        organizationPlotId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireRealtor(ctx.user.id);

      // Get realtor's email
      const [user] = await db
        .select({ email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, ctx.user.id))
        .limit(1);

      if (!user) {
        throw new Error('User not found');
      }

      // Determine if the user's email domain matches a known realtor company domain
      const email = String(user.email || '').toLowerCase();
      const domain = email.includes('@') ? email.split('@')[1] : '';
      let domainAuthorized = false;
      if (domain) {
        try {
          const existsRes = await db.execute(
            sql`SELECT 1 FROM realtors WHERE (website_url ILIKE ${'%' + domain + '%'} OR email ILIKE ${'%' + '@' + domain}) LIMIT 1`
          );
          const hasRows = hasRowsResult(existsRes) && existsRes.rows.length > 0;
          domainAuthorized = !!hasRows;
        } catch {
          domainAuthorized = false;
        }
      }

      // Update only if this organization_plot is assigned to this realtor
      const [updated] = await db
        .update(organizationPlotsTable)
        .set({ status: 'realtor_replied' })
        .where(
          and(
            eq(organizationPlotsTable.id, input.organizationPlotId),
            domainAuthorized
              ? sql`(${organizationPlotsTable.realtorEmail} = ${user.email} OR ${organizationPlotsTable.realtorEmail} ILIKE ${'%' + '@' + domain})`
              : eq(organizationPlotsTable.realtorEmail, user.email)
          )
        )
        .returning();

      if (!updated) {
        throw new Error('Assigned outreach request not found or not authorized');
      }

      return updated;
    }),

  // Update plot cadastral geometry (polygon boundary)
  updatePlotGeometry: protectedProcedure
    .input(
      z.object({
        plotId: z.string(),
        geometry: z.object({
          type: z.literal('Polygon'),
          coordinates: z.array(z.array(z.array(z.number()))),
        }).nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireRealtor(ctx.user.id);

      const { plotId, geometry } = input;

      // Get realtor's email
      const [user] = await db
        .select({ email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, ctx.user.id))
        .limit(1);

      if (!user) {
        throw new Error('User not found');
      }

      // Check if realtor is assigned to this plot
      const email = String(user.email || '').toLowerCase();
      const domain = email.includes('@') ? email.split('@')[1] : '';
      let domainAuthorized = false;
      if (domain) {
        try {
          const existsRes = await db.execute(
            sql`SELECT 1 FROM realtors WHERE (website_url ILIKE ${'%' + domain + '%'} OR email ILIKE ${'%' + '@' + domain}) LIMIT 1`
          );
          const hasRows = hasRowsResult(existsRes) && existsRes.rows.length > 0;
          domainAuthorized = !!hasRows;
        } catch {
          domainAuthorized = false;
        }
      }

      const whereAssignee = domainAuthorized
        ? sql`${organizationPlotsTable.realtorEmail} ILIKE ${'%' + '@' + domain}`
        : eq(organizationPlotsTable.realtorEmail, user.email);

      const assignedPlot = await db
        .select({ id: organizationPlotsTable.id })
        .from(organizationPlotsTable)
        .where(and(eq(organizationPlotsTable.plotId, plotId), whereAssignee))
        .limit(1);

      if (!assignedPlot[0]) {
        throw new Error('You do not have access to update this plot');
      }

      // Get current enrichment data
      const [currentPlot] = await db
        .select({ enrichmentData: enrichedPlotsStage.enrichmentData })
        .from(enrichedPlotsStage)
        .where(eq(enrichedPlotsStage.id, plotId))
        .limit(1);

      // Merge geometry into enrichment data under cadastral
      const currentEnrichment = (currentPlot?.enrichmentData || {}) as Record<string, unknown>;
      const currentCadastral = (currentEnrichment.cadastral || {}) as Record<string, unknown>;
      
      const updatedCadastral = {
        ...currentCadastral,
        geometry: geometry,
        geometry_source: geometry ? 'realtor_drawn' : null,
        geometry_updated_at: geometry ? new Date().toISOString() : null,
      };

      const updatedEnrichment = {
        ...currentEnrichment,
        cadastral: updatedCadastral,
      };

      // Update enriched_plots_stage with the new geometry
      const [updated] = await db
        .update(enrichedPlotsStage)
        .set({
          enrichmentData: updatedEnrichment,
          // Clear report so it regenerates with new geometry
          plotReportUrl: null,
          plotReportJson: null,
        })
        .where(eq(enrichedPlotsStage.id, plotId))
        .returning();

      // Refresh the materialized view
      const useProdTables = (process.env.PLOTS_TABLE_ENV || 'stage').toLowerCase() === 'prod';
      if (useProdTables) {
        await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY enriched_plots`);
      }

      console.log('Plot geometry updated:', {
        plotId,
        hasGeometry: !!geometry,
        vertexCount: geometry?.coordinates?.[0]?.length || 0,
      });

      return {
        success: true,
        plot: updated,
      };
    }),

  // ==================== ADMIN ENDPOINTS ====================

  // Admin: Get plot by ID with full enrichment data
  adminGetPlot: protectedProcedure
    .input(z.object({ plotId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);

      const [plot] = await db
        .select({
          id: enrichedPlotsStage.id,
          latitude: enrichedPlotsStage.latitude,
          longitude: enrichedPlotsStage.longitude,
          price: enrichedPlotsStage.price,
          size: enrichedPlotsStage.size,
          enrichmentData: enrichedPlotsStage.enrichmentData,
          images: enrichedPlotsStage.images,
          realLatitude: enrichedPlotsStage.realLatitude,
          realLongitude: enrichedPlotsStage.realLongitude,
          realAddress: enrichedPlotsStage.realAddress,
          municipalityId: enrichedPlotsStage.municipalityId,
        })
        .from(enrichedPlotsStage)
        .where(eq(enrichedPlotsStage.id, input.plotId))
        .limit(1);

      if (!plot) {
        throw new Error('Plot not found');
      }

      // Get municipality info if available
      let municipality = null;
      if (plot.municipalityId) {
        const [muni] = await db
          .select({ id: municipalities.id, name: municipalities.name, district: municipalities.district, country: municipalities.country })
          .from(municipalities)
          .where(eq(municipalities.id, plot.municipalityId))
          .limit(1);
        municipality = muni || null;
      }

      return {
        ...plot,
        municipality,
      };
    }),

  // Admin: Update plot location (no assignment check)
  adminUpdatePlotLocation: protectedProcedure
    .input(
      z.object({
        plotId: z.string(),
        realLatitude: z.number().optional(),
        realLongitude: z.number().optional(),
        realAddress: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);

      const { plotId, realLatitude, realLongitude, realAddress } = input;

      const updates: Record<string, unknown> = {};
      
      if (realLatitude !== undefined) {
        updates.realLatitude = realLatitude;
      }
      
      if (realLongitude !== undefined) {
        updates.realLongitude = realLongitude;
      }

      if (realAddress !== undefined) {
        updates.realAddress = realAddress;
      }

      if (Object.keys(updates).length === 0) {
        throw new Error('No updates provided');
      }

      const [updated] = await db
        .update(enrichedPlotsStage)
        .set(updates)
        .where(eq(enrichedPlotsStage.id, plotId))
        .returning();

      if (!updated) {
        throw new Error('Plot not found');
      }

      // Refresh materialized view
      const useProdTables = (process.env.PLOTS_TABLE_ENV || 'stage').toLowerCase() === 'prod';
      if (useProdTables) {
        await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY enriched_plots`);
      }

      // Call the enrichment webservice with the new coordinates to update amenities
      // Only call if both coordinates were provided
      if (realLatitude !== undefined && realLongitude !== undefined) {
        try {
          const enrichmentData = await enrichLocation({
            latitude: realLatitude,
            longitude: realLongitude,
            plot_id: plotId,
            store_results: true,
          });
          
          console.log('Admin: Plot enrichment updated successfully:', {
            plotId,
            enrichments_run: enrichmentData.enrichments_run,
            enrichments_failed: enrichmentData.enrichments_failed,
          });

          // Clear the plot report data so it gets regenerated with new enrichment data
          if (enrichmentData.enrichments_run.length > 0) {
            await db
              .update(enrichedPlotsStage)
              .set({
                plotReportUrl: null,
                plotReportJson: null,
              })
              .where(eq(enrichedPlotsStage.id, plotId));
            
            console.log('Admin: Plot report data cleared for regeneration');
          }

          // Refresh materialized view again to include the enrichment data updates
          if (useProdTables) {
            await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY enriched_plots`);
            console.log('Admin: Materialized view refreshed after enrichment');
          }
        } catch (error) {
          // Log but don't fail the request if enrichment service is down
          console.error('Admin: Failed to call enrichment service:', error);
        }
      }

      console.log('Admin updated plot location:', { plotId, ...updates });

      return { success: true, plot: updated };
    }),

  // Admin: Update plot geometry (no assignment check)
  adminUpdatePlotGeometry: protectedProcedure
    .input(
      z.object({
        plotId: z.string(),
        geometry: z.object({
          type: z.literal('Polygon'),
          coordinates: z.array(z.array(z.array(z.number()))),
        }).nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);

      const { plotId, geometry } = input;

      // Get current enrichment data
      const [currentPlot] = await db
        .select({ enrichmentData: enrichedPlotsStage.enrichmentData })
        .from(enrichedPlotsStage)
        .where(eq(enrichedPlotsStage.id, plotId))
        .limit(1);

      if (!currentPlot) {
        throw new Error('Plot not found');
      }

      // Merge geometry into enrichment data
      const currentEnrichment = (currentPlot.enrichmentData || {}) as Record<string, unknown>;
      const currentCadastral = (currentEnrichment.cadastral || {}) as Record<string, unknown>;
      
      const updatedCadastral = {
        ...currentCadastral,
        geometry: geometry,
        geometry_source: geometry ? 'admin_drawn' : null,
        geometry_updated_at: geometry ? new Date().toISOString() : null,
      };

      const updatedEnrichment = {
        ...currentEnrichment,
        cadastral: updatedCadastral,
      };

      const [updated] = await db
        .update(enrichedPlotsStage)
        .set({
          enrichmentData: updatedEnrichment,
          plotReportUrl: null,
          plotReportJson: null,
        })
        .where(eq(enrichedPlotsStage.id, plotId))
        .returning();

      // Refresh materialized view
      const useProdTables = (process.env.PLOTS_TABLE_ENV || 'stage').toLowerCase() === 'prod';
      if (useProdTables) {
        await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY enriched_plots`);
      }

      console.log('Admin updated plot geometry:', {
        plotId,
        hasGeometry: !!geometry,
        vertexCount: geometry?.coordinates?.[0]?.length || 0,
      });

      return { success: true, plot: updated };
    }),
});
