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

  if (!user[0] || (user[0].role !== 'realtor' && user[0].role !== 'admin')) {
    throw new Error('Realtor or admin access required');
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
          // Claimed status
          plotClaimedByUserId: enrichedPlots.claimedByUserId,
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
            claimedByUserId: row.plotClaimedByUserId,
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
      // Any user with realtor or admin role can update plot locations
      await requireRealtor(ctx.user.id);

      const { plotId, realLatitude, realLongitude, realAddress } = input;

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

      // Get realtor's full user info (name, email)
      const [user] = await db
        .select({ 
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
        })
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

      // Update the plot with the realtor's contact info (claim the plot)
      const plotId = updated.plotId;
      if (plotId) {
        await db
          .update(enrichedPlotsStage)
          .set({
            claimedByUserId: user.id,
            claimedByName: user.name,
            claimedByEmail: user.email,
            claimedAt: new Date().toISOString(),
          })
          .where(eq(enrichedPlotsStage.id, plotId));

        // Refresh materialized view if using prod tables
        const useProdTables = (process.env.PLOTS_TABLE_ENV || 'stage').toLowerCase() === 'prod';
        if (useProdTables) {
          await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY enriched_plots`);
        }
      }

      return updated;
    }),

  // Realtor accepts/claims a plot from their company's listings
  acceptCompanyPlot: protectedProcedure
    .input(
      z.object({
        plotId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireRealtor(ctx.user.id);

      // Get realtor's full user info
      const [user] = await db
        .select({ 
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
        })
        .from(usersTable)
        .where(eq(usersTable.id, ctx.user.id))
        .limit(1);

      if (!user) {
        throw new Error('User not found');
      }

      const email = String(user.email || '').toLowerCase();
      const domain = email.includes('@') ? email.split('@')[1] : '';

      if (!domain) {
        throw new Error('Invalid email domain');
      }

      // Verify the plot belongs to the realtor's company (is agency or source)
      const companyPlot = await db.execute(
        sql`SELECT 1 FROM plots_stage_realtors psr
            JOIN realtors r ON r.id = psr.realtor_id
            WHERE psr.plot_id = ${input.plotId}
              AND psr.role IN ('agency', 'source')
              AND (r.website_url ILIKE ${'%' + domain + '%'} OR r.email ILIKE ${'%@' + domain})
            LIMIT 1`
      );

      if (!hasRowsResult(companyPlot) || companyPlot.rows.length === 0) {
        throw new Error('Plot not found in your company listings');
      }

      // Claim the plot by setting realtor contact info
      await db
        .update(enrichedPlotsStage)
        .set({
          claimedByUserId: user.id,
          claimedByName: user.name,
          claimedByEmail: user.email,
          claimedAt: new Date().toISOString(),
        })
        .where(eq(enrichedPlotsStage.id, input.plotId));

      // Refresh materialized view if using prod tables
      const useProdTables = (process.env.PLOTS_TABLE_ENV || 'stage').toLowerCase() === 'prod';
      if (useProdTables) {
        try {
          await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY enriched_plots`);
        } catch (refreshError) {
          // If concurrent refresh fails (no unique index), try non-concurrent
          console.warn('Concurrent refresh failed, trying non-concurrent:', refreshError);
          try {
            await db.execute(sql`REFRESH MATERIALIZED VIEW enriched_plots`);
          } catch (e) {
            console.error('Failed to refresh materialized view:', e);
          }
        }
      }

      return { success: true, plotId: input.plotId };
    }),

  // Realtor unclaims a plot from their company's listings
  unacceptCompanyPlot: protectedProcedure
    .input(
      z.object({
        plotId: z.string().uuid(),
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

      const email = String(user.email || '').toLowerCase();
      const domain = email.includes('@') ? email.split('@')[1] : '';

      if (!domain) {
        throw new Error('Invalid email domain');
      }

      // Verify the plot belongs to the realtor's company (is agency or source)
      const companyPlot = await db.execute(
        sql`SELECT 1 FROM plots_stage_realtors psr
            JOIN realtors r ON r.id = psr.realtor_id
            WHERE psr.plot_id = ${input.plotId}
              AND psr.role IN ('agency', 'source')
              AND (r.website_url ILIKE ${'%' + domain + '%'} OR r.email ILIKE ${'%@' + domain})
            LIMIT 1`
      );

      if (!hasRowsResult(companyPlot) || companyPlot.rows.length === 0) {
        throw new Error('Plot not found in your company listings');
      }

      // Clear the claim info
      await db
        .update(enrichedPlotsStage)
        .set({
          claimedByUserId: null,
          claimedByName: null,
          claimedByEmail: null,
          claimedByPhone: null,
          claimedAt: null,
        })
        .where(eq(enrichedPlotsStage.id, input.plotId));

      // Refresh materialized view if using prod tables
      const useProdTables = (process.env.PLOTS_TABLE_ENV || 'stage').toLowerCase() === 'prod';
      if (useProdTables) {
        try {
          await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY enriched_plots`);
        } catch (refreshError) {
          // If concurrent refresh fails (no unique index), try non-concurrent
          console.warn('Concurrent refresh failed, trying non-concurrent:', refreshError);
          try {
            await db.execute(sql`REFRESH MATERIALIZED VIEW enriched_plots`);
          } catch (e) {
            console.error('Failed to refresh materialized view:', e);
          }
        }
      }

      return { success: true, plotId: input.plotId };
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
          // Claimed realtor info
          claimedByUserId: enrichedPlotsStage.claimedByUserId,
          claimedByName: enrichedPlotsStage.claimedByName,
          claimedByEmail: enrichedPlotsStage.claimedByEmail,
          claimedByPhone: enrichedPlotsStage.claimedByPhone,
          claimedAt: enrichedPlotsStage.claimedAt,
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

  // Get plots where the realtor's company is the main agency or source
  getMyCompanyPlots: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(20),
        searchPlotId: z.string().optional(),
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

      const email = String(user.email || '').toLowerCase();
      const domain = email.includes('@') ? email.split('@')[1] : '';

      if (!domain) {
        return {
          companyName: null,
          items: [],
          pagination: {
            page: input.page,
            limit: input.limit,
            totalCount: 0,
            totalPages: 0,
          },
        };
      }

      const { page, limit, searchPlotId } = input;
      const offset = (page - 1) * limit;

      // Get company name for display
      const companyResult = await db.execute(sql`
        SELECT DISTINCT r.company_name
        FROM realtors r
        WHERE r.website_url ILIKE ${'%' + domain + '%'} OR r.email ILIKE ${'%@' + domain}
        LIMIT 1
      `);
      const companyRows = hasRowsResult(companyResult) ? companyResult.rows : [];
      const companyName = (companyRows[0] as { company_name?: string })?.company_name || null;

      // Build search condition
      const searchCondition = searchPlotId 
        ? sql`AND ep.id::text ILIKE ${'%' + searchPlotId + '%'}`
        : sql``;

      // Find plots where a realtor matching this email domain is the agency or source
      // Using DISTINCT ON to ensure each plot appears only once (prefer 'agency' role over 'source')
      const plotsResult = await db.execute(sql`
        SELECT DISTINCT ON (ep.id)
          ep.id as plot_id,
          ep.price,
          ep.size,
          ep.images,
          ep.latitude,
          ep.longitude,
          ep.enrichment_data as "enrichmentData",
          ep.real_latitude as "realLatitude",
          ep.real_longitude as "realLongitude",
          ep.real_address as "realAddress",
          ep.claimed_by_user_id as "claimedByUserId",
          ep.claimed_at as "claimedAt",
          m.name as municipality_name,
          m.district as municipality_district,
          m.country as municipality_country,
          r.company_name,
          psr.role
        FROM plots_stage_realtors psr
        JOIN realtors r ON r.id = psr.realtor_id
        JOIN enriched_plots ep ON ep.id = psr.plot_id
        LEFT JOIN municipalities m ON m.id = ep.municipality_id
        WHERE psr.role IN ('agency', 'source')
          AND (r.website_url ILIKE ${'%' + domain + '%'} OR r.email ILIKE ${'%@' + domain})
          ${searchPlotId ? sql`AND ep.id::text ILIKE ${'%' + searchPlotId + '%'}` : sql``}
        ORDER BY ep.id DESC, psr.role ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `);

      // Count total
      const countResult = await db.execute(sql`
        SELECT COUNT(DISTINCT ep.id) as count
        FROM plots_stage_realtors psr
        JOIN realtors r ON r.id = psr.realtor_id
        JOIN enriched_plots ep ON ep.id = psr.plot_id
        WHERE psr.role IN ('agency', 'source')
          AND (r.website_url ILIKE ${'%' + domain + '%'} OR r.email ILIKE ${'%@' + domain})
          ${searchPlotId ? sql`AND ep.id::text ILIKE ${'%' + searchPlotId + '%'}` : sql``}
      `);

      const rows = hasRowsResult(plotsResult) ? plotsResult.rows : [];
      const countRows = hasRowsResult(countResult) ? countResult.rows : [];
      const totalCount = Number((countRows[0] as { count: string })?.count || 0);

      type PlotRow = {
        plot_id: string;
        price: string | null;
        size: string | null;
        images: string[] | null;
        latitude: number;
        longitude: number;
        enrichmentData: Record<string, unknown> | null;
        realLatitude: number | null;
        realLongitude: number | null;
        realAddress: string | null;
        claimedByUserId: string | null;
        claimedAt: string | null;
        municipality_name: string | null;
        municipality_district: string | null;
        municipality_country: string | null;
        company_name: string;
        role: string;
      };

      return {
        companyName,
        items: (rows as PlotRow[]).map((row) => ({
          plot: {
            id: row.plot_id,
            price: row.price,
            size: row.size,
            images: row.images,
            latitude: row.latitude,
            longitude: row.longitude,
            enrichmentData: row.enrichmentData,
            realLatitude: row.realLatitude,
            realLongitude: row.realLongitude,
            realAddress: row.realAddress,
            claimedByUserId: row.claimedByUserId,
            claimedAt: row.claimedAt,
          },
          municipality: {
            name: row.municipality_name ?? null,
            district: row.municipality_district ?? null,
            country: row.municipality_country ?? 'PT',
          },
          realtorInfo: {
            companyName: row.company_name,
            role: row.role,
          },
        })),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    }),

  // Search for any plot by ID or listing URL (not restricted to company)
  searchAnyPlot: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireRealtor(ctx.user.id);

      const { query } = input;
      const trimmedQuery = query.trim();

      // Search by exact plot ID or by listing URL containing the query
      const plotsResult = await db.execute(sql`
        SELECT
          ep.id as plot_id,
          ep.price,
          ep.size,
          ep.images,
          ep.latitude,
          ep.longitude,
          ep.enrichment_data as "enrichmentData",
          ep.real_latitude as "realLatitude",
          ep.real_longitude as "realLongitude",
          ep.real_address as "realAddress",
          ep.claimed_by_user_id as "claimedByUserId",
          ep.claimed_at as "claimedAt",
          ep.primary_listing_link as "primaryListingLink",
          m.name as municipality_name,
          m.district as municipality_district,
          m.country as municipality_country
        FROM enriched_plots ep
        LEFT JOIN municipalities m ON m.id = ep.municipality_id
        WHERE ep.id::text = ${trimmedQuery}
           OR ep.primary_listing_link ILIKE ${'%' + trimmedQuery + '%'}
        LIMIT 1
      `);

      const rows = hasRowsResult(plotsResult) ? plotsResult.rows : [];
      
      if (rows.length === 0) {
        return { plot: null };
      }

      type PlotRow = {
        plot_id: string;
        price: string | null;
        size: string | null;
        images: string[] | null;
        latitude: number;
        longitude: number;
        enrichmentData: Record<string, unknown> | null;
        realLatitude: number | null;
        realLongitude: number | null;
        realAddress: string | null;
        claimedByUserId: string | null;
        claimedAt: string | null;
        primaryListingLink: string | null;
        municipality_name: string | null;
        municipality_district: string | null;
        municipality_country: string | null;
      };

      const row = rows[0] as PlotRow;

      return {
        plot: {
          id: row.plot_id,
          price: row.price,
          size: row.size,
          images: row.images,
          latitude: row.latitude,
          longitude: row.longitude,
          enrichmentData: row.enrichmentData,
          realLatitude: row.realLatitude,
          realLongitude: row.realLongitude,
          realAddress: row.realAddress,
          claimedByUserId: row.claimedByUserId,
          claimedAt: row.claimedAt,
          primaryListingLink: row.primaryListingLink,
          municipality: {
            name: row.municipality_name ?? null,
            district: row.municipality_district ?? null,
            country: row.municipality_country ?? 'PT',
          },
        },
      };
    }),

  // Check if a plot belongs to the realtor's company
  checkPlotOwnership: protectedProcedure
    .input(
      z.object({
        plotId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireRealtor(ctx.user.id);

      // Get realtor's email domain
      const [user] = await db
        .select({ email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, ctx.user.id))
        .limit(1);

      if (!user) {
        throw new Error('User not found');
      }

      const email = String(user.email || '').toLowerCase();
      const domain = email.includes('@') ? email.split('@')[1] : '';

      if (!domain) {
        return { belongsToCompany: false, companyName: null };
      }

      // Check if plot is linked to a realtor from this domain
      const result = await db.execute(sql`
        SELECT r.company_name
        FROM plots_stage_realtors psr
        JOIN realtors r ON r.id = psr.realtor_id
        WHERE psr.plot_id = ${input.plotId}
          AND psr.role IN ('agency', 'source')
          AND (r.website_url ILIKE ${'%' + domain + '%'} OR r.email ILIKE ${'%@' + domain})
        LIMIT 1
      `);

      const rows = hasRowsResult(result) ? result.rows : [];
      
      if (rows.length > 0) {
        return {
          belongsToCompany: true,
          companyName: (rows[0] as { company_name: string }).company_name,
        };
      }

      return { belongsToCompany: false, companyName: null };
    }),

  // Claim any plot (not restricted to company - used from Search Any Plot)
  claimAnyPlot: protectedProcedure
    .input(
      z.object({
        plotId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireRealtor(ctx.user.id);

      // Get realtor's full user info
      const [user] = await db
        .select({ 
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
        })
        .from(usersTable)
        .where(eq(usersTable.id, ctx.user.id))
        .limit(1);

      if (!user) {
        throw new Error('User not found');
      }

      // Verify plot exists
      const plotExists = await db.execute(
        sql`SELECT 1 FROM enriched_plots WHERE id = ${input.plotId} LIMIT 1`
      );

      if (!hasRowsResult(plotExists) || plotExists.rows.length === 0) {
        throw new Error('Plot not found');
      }

      // Claim the plot by setting realtor contact info
      await db
        .update(enrichedPlotsStage)
        .set({
          claimedByUserId: user.id,
          claimedByName: user.name,
          claimedByEmail: user.email,
          claimedAt: new Date().toISOString(),
        })
        .where(eq(enrichedPlotsStage.id, input.plotId));

      // Refresh materialized view if using prod tables
      const useProdTables = (process.env.PLOTS_TABLE_ENV || 'stage').toLowerCase() === 'prod';
      if (useProdTables) {
        try {
          await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY enriched_plots`);
        } catch (refreshError) {
          console.warn('Concurrent refresh failed, trying non-concurrent:', refreshError);
          try {
            await db.execute(sql`REFRESH MATERIALIZED VIEW enriched_plots`);
          } catch (e) {
            console.error('Failed to refresh materialized view:', e);
          }
        }
      }

      return { success: true, plotId: input.plotId };
    }),

  // Unclaim any plot (used from Search Any Plot)
  unclaimAnyPlot: protectedProcedure
    .input(
      z.object({
        plotId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireRealtor(ctx.user.id);

      // Verify plot exists and is claimed by this user
      const plotCheck = await db.execute(
        sql`SELECT claimed_by_user_id FROM enriched_plots WHERE id = ${input.plotId} LIMIT 1`
      );

      if (!hasRowsResult(plotCheck) || plotCheck.rows.length === 0) {
        throw new Error('Plot not found');
      }

      const plot = plotCheck.rows[0] as { claimed_by_user_id: string | null };
      if (plot.claimed_by_user_id !== ctx.user.id) {
        throw new Error('You can only unclaim plots you have claimed');
      }

      // Unclaim the plot
      await db
        .update(enrichedPlotsStage)
        .set({
          claimedByUserId: null,
          claimedByName: null,
          claimedByEmail: null,
          claimedByPhone: null,
          claimedAt: null,
        })
        .where(eq(enrichedPlotsStage.id, input.plotId));

      // Refresh materialized view if using prod tables
      const useProdTables = (process.env.PLOTS_TABLE_ENV || 'stage').toLowerCase() === 'prod';
      if (useProdTables) {
        try {
          await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY enriched_plots`);
        } catch (refreshError) {
          console.warn('Concurrent refresh failed, trying non-concurrent:', refreshError);
          try {
            await db.execute(sql`REFRESH MATERIALIZED VIEW enriched_plots`);
          } catch (e) {
            console.error('Failed to refresh materialized view:', e);
          }
        }
      }

      return { success: true, plotId: input.plotId };
    }),

  // Get plots claimed by this realtor that are NOT in any project request
  getMyClaimedPlots: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireRealtor(ctx.user.id);

      const { page, limit } = input;
      const offset = (page - 1) * limit;

      // Get realtor's email for checking project assignments
      const [user] = await db
        .select({ email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, ctx.user.id))
        .limit(1);

      if (!user) {
        throw new Error('User not found');
      }

      const email = String(user.email || '').toLowerCase();
      const domain = email.includes('@') ? email.split('@')[1] : '';

      // Get plots claimed by this user that are NOT in organization_plots with matching realtor email
      const plotsResult = await db.execute(sql`
        SELECT 
          ep.id,
          ep.price,
          ep.size,
          ep.images,
          ep.latitude,
          ep.longitude,
          ep.enrichment_data as "enrichmentData",
          ep.real_latitude as "realLatitude",
          ep.real_longitude as "realLongitude",
          ep.real_address as "realAddress",
          ep.claimed_by_user_id as "claimedByUserId",
          ep.claimed_at as "claimedAt",
          ep.primary_listing_link as "primaryListingLink",
          m.name as municipality_name,
          m.district as municipality_district,
          m.country as municipality_country
        FROM enriched_plots ep
        LEFT JOIN municipalities m ON m.id = ep.municipality_id
        WHERE ep.claimed_by_user_id = ${ctx.user.id}
          AND NOT EXISTS (
            SELECT 1 FROM organization_plots op 
            WHERE op.plot_id = ep.id 
              AND (op.realtor_email = ${user.email} OR op.realtor_email ILIKE ${'%@' + domain})
          )
        ORDER BY ep.claimed_at DESC NULLS LAST
        LIMIT ${limit}
        OFFSET ${offset}
      `);

      // Count total
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM enriched_plots ep
        WHERE ep.claimed_by_user_id = ${ctx.user.id}
          AND NOT EXISTS (
            SELECT 1 FROM organization_plots op 
            WHERE op.plot_id = ep.id 
              AND (op.realtor_email = ${user.email} OR op.realtor_email ILIKE ${'%@' + domain})
          )
      `);

      const rows = hasRowsResult(plotsResult) ? plotsResult.rows : [];
      const countRows = hasRowsResult(countResult) ? countResult.rows : [];
      const totalCount = Number((countRows[0] as { count: string })?.count || 0);

      type PlotRow = {
        id: string;
        price: string | null;
        size: string | null;
        images: string[] | null;
        latitude: number;
        longitude: number;
        enrichmentData: Record<string, unknown> | null;
        realLatitude: number | null;
        realLongitude: number | null;
        realAddress: string | null;
        claimedByUserId: string | null;
        claimedAt: string | null;
        primaryListingLink: string | null;
        municipality_name: string | null;
        municipality_district: string | null;
        municipality_country: string | null;
      };

      return {
        items: (rows as PlotRow[]).map((row) => ({
          plot: {
            id: row.id,
            price: row.price,
            size: row.size,
            images: row.images,
            latitude: row.latitude,
            longitude: row.longitude,
            enrichmentData: row.enrichmentData,
            realLatitude: row.realLatitude,
            realLongitude: row.realLongitude,
            realAddress: row.realAddress,
            claimedByUserId: row.claimedByUserId,
            claimedAt: row.claimedAt,
            primaryListingLink: row.primaryListingLink,
          },
          municipality: {
            name: row.municipality_name ?? null,
            district: row.municipality_district ?? null,
            country: row.municipality_country ?? 'PT',
          },
        })),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    }),

  // Admin: Get plots with verified coordinates (realLatitude and realLongitude not null)
  adminGetVerifiedPlots: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);

      const { page, limit } = input;
      const offset = (page - 1) * limit;

      const plotsResult = await db
        .select({
          id: enrichedPlotsStage.id,
          latitude: enrichedPlotsStage.latitude,
          longitude: enrichedPlotsStage.longitude,
          price: enrichedPlotsStage.price,
          size: enrichedPlotsStage.size,
          realLatitude: enrichedPlotsStage.realLatitude,
          realLongitude: enrichedPlotsStage.realLongitude,
          municipalityId: enrichedPlotsStage.municipalityId,
          municipalityName: municipalities.name,
          municipalityCountry: municipalities.country,
        })
        .from(enrichedPlotsStage)
        .leftJoin(municipalities, eq(enrichedPlotsStage.municipalityId, municipalities.id))
        .where(
          and(
            sql`${enrichedPlotsStage.realLatitude} IS NOT NULL`,
            sql`${enrichedPlotsStage.realLongitude} IS NOT NULL`
          )
        )
        .orderBy(desc(enrichedPlotsStage.realLatitude))
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(enrichedPlotsStage)
        .where(
          and(
            sql`${enrichedPlotsStage.realLatitude} IS NOT NULL`,
            sql`${enrichedPlotsStage.realLongitude} IS NOT NULL`
          )
        );

      return {
        items: plotsResult.map((plot) => ({
          id: plot.id,
          latitude: plot.latitude,
          longitude: plot.longitude,
          price: plot.price,
          size: plot.size,
          realLatitude: plot.realLatitude,
          realLongitude: plot.realLongitude,
          municipality: plot.municipalityName
            ? { name: plot.municipalityName, country: plot.municipalityCountry }
            : null,
        })),
        pagination: {
          page,
          limit,
          totalCount: Number(count),
          totalPages: Math.ceil(Number(count) / limit),
        },
      };
    }),
});
