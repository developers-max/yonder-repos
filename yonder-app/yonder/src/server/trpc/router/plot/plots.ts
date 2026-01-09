import { publicProcedure, router } from '../../trpc';
import { db } from "@/lib/db";
import { enrichedPlots, municipalities, organizationPlotsTable, regulations } from "@/lib/db/schema";
import { and, desc, eq, gte, lte, sql, asc } from "drizzle-orm";
import { z } from "zod";
import { extractBuildingRegulations, BuildingRegulationsSchema } from './extract-regulations';
import { generatePlotDescription } from './generate-description';
import { extractGeneralZoningRules, GeneralZoningRulesSchema } from './extract-general-zoning';
import { analyzePlotData, PlotAnalysisSchema } from './analyze-plot-data';

// Type for enrichment data structure
export type EnrichmentData = {
  cafe?: { 
    distance?: number; 
    nearest_point?: { lat: number; lon: number; name?: string; type: string } 
  };
  beach?: { 
    distance?: number; 
    nearest_point?: { lat: number; lon: number; name?: string; type: string } 
  };
  airport?: { 
    distance?: number; 
    nearest_point?: { lat: number; lon: number; name?: string; type: string } 
  };
  coastline?: { 
    distance?: number; 
    nearest_point?: { lat: number; lon: number; name?: string; type: string } 
  };
  supermarket?: { 
    distance?: number; 
    nearest_point?: { lat: number; lon: number; name?: string; type: string } 
  };
  public_transport?: { 
    distance?: number; 
    nearest_point?: { lat: number; lon: number; name?: string; type: string } 
  };
  convenience_store?: { 
    distance?: number; 
    nearest_point?: { lat: number; lon: number; name?: string; type: string } 
  };
  nearest_main_town?: { 
    distance?: number; 
    nearest_point?: { lat: number; lon: number; name?: string; type: string } 
  };
  restaurant_or_fastfood?: { 
    distance?: number; 
    nearest_point?: { lat: number; lon: number; name?: string; type: string } 
  };
  // Zoning information enrichment
  zoning?: {
    srs?: string;
    label?: string;
    label_en?: string;
    source?: string;
    typename?: string;
    picked_field?: string;
    feature_count?: number;
    sample_properties?: Record<string, unknown>;
  };
  // Cadastral information enrichment
  cadastral?: {
    cadastral_reference: string;
    address?: string;
    postal_code?: string | null;
    municipality?: string;
    province?: string;
    distance_meters?: number;
    parcel?: {
      cadastral_reference: string;
      area_value: number;
      label: string;
      beginning_lifespan?: string;
      reference_point?: {
        type: string;
        coordinates: [number, number];
      };
    };
    parcels?: unknown[];
    parcel_count?: number;
    buildings?: unknown[];
    building_count?: number;
    map_images?: {
      wms_url?: string;
      viewer_url?: string;
      embeddable_html?: string;
      description?: string;
    };
  };
  // Layer enrichment data
  layers?: {
    timestamp?: string;
    coordinates?: { lat: number; lng: number };
    country?: string;
    areaM2?: number;
    boundingBox?: unknown;
    layersByCategory?: Record<string, unknown[]>;
    layersRaw?: unknown[];
  };
};

type RealtorForPlot = {
  id: number;
  company_name: string;
  country: string;
  website_url: string;
  email: string | null;
  telephone: string | null;
  role: string;
  contact_name: string;
  source_file: string | null;
};

// Filter schema for the side panel
// Using .nullish() instead of .optional() to accept both null and undefined values
export const plotFiltersSchema = z.object({
  minPrice: z.number().nullish(),
  maxPrice: z.number().nullish(),
  minSize: z.number().nullish(),
  maxSize: z.number().nullish(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  radiusKm: z.number().nullish().default(50),
  // Map bounds as alternative to lat/lng/radius
  bounds: z.object({
    north: z.number(),
    south: z.number(),
    east: z.number(),
    west: z.number(),
  }).nullish(),
  maxDistanceToBeach: z.number().nullish(),
  maxDistanceToCafe: z.number().nullish(),
  maxDistanceToSupermarket: z.number().nullish(),
  maxDistanceToPublicTransport: z.number().nullish(),
  maxDistanceToRestaurant: z.number().nullish(),
  maxDistanceToMainTown: z.number().nullish(),
  // Zoning filters
  zoningLabelContains: z.string().nullish(),
  zoningLabelEnContains: z.string().nullish(),
  zoningTypenameContains: z.string().nullish(),
  zoningPickedFieldContains: z.string().nullish(),
  zoningSourceContains: z.string().nullish(),
  zoningTextContains: z.string().nullish(),
  page: z.number().default(1),
  limit: z.number().default(20),
  sortBy: z.enum(['price', 'size', 'distance']).default('price'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type PlotFilters = z.infer<typeof plotFiltersSchema>;

export const plotsRouter = router({
  // Search plots with organization data for outreach component
  searchPlotsWithOrganizationData: publicProcedure
    .input(plotFiltersSchema.extend({
      organizationId: z.string(), // Required for this endpoint
    }))
    .query(async ({ input }) => {
      const {
        minPrice,
        maxPrice,
        minSize,
        maxSize,
        latitude,
        longitude,
        radiusKm = 50,
        bounds,
        maxDistanceToBeach,
        maxDistanceToCafe,
        maxDistanceToSupermarket,
        maxDistanceToPublicTransport,
        maxDistanceToRestaurant,
        maxDistanceToMainTown,
        // Zoning filters
        zoningLabelContains,
        zoningLabelEnContains,
        zoningTypenameContains,
        zoningPickedFieldContains,
        zoningSourceContains,
        zoningTextContains,
        page = 1,
        limit = 20,
        sortBy = 'price',
        sortOrder = 'asc'
      } = input;

      const offset = (page - 1) * limit;
      const conditions = [];

      try {
        // Basic filters (same as regular search)
        if (minPrice != null) {
          conditions.push(gte(enrichedPlots.price, minPrice.toString()));
        }
        if (maxPrice != null) {
          conditions.push(lte(enrichedPlots.price, maxPrice.toString()));
        }
        if (minSize != null) {
          conditions.push(gte(enrichedPlots.size, minSize.toString()));
        }
        if (maxSize != null) {
          conditions.push(lte(enrichedPlots.size, maxSize.toString()));
        }

        // Location-based filtering
        if (bounds) {
          conditions.push(
            sql`ST_Within(${enrichedPlots.geom}, ST_SetSRID(ST_MakeEnvelope(${bounds.west}, ${bounds.south}, ${bounds.east}, ${bounds.north}), 4326))`
          );
        } else if (latitude && longitude && radiusKm != null) {
          conditions.push(
            sql`ST_DistanceSphere(${enrichedPlots.geom}, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)) <= ${radiusKm * 1000}`
          );
        }

        // Enrichment data filters (same as regular search)
        if (maxDistanceToBeach != null) {
          conditions.push(
            sql`${enrichedPlots.enrichmentData}->'beach'->>'distance' IS NOT NULL AND (${enrichedPlots.enrichmentData}->'beach'->>'distance')::integer <= ${maxDistanceToBeach}`
          );
        }
        if (maxDistanceToCafe != null) {
          conditions.push(
            sql`${enrichedPlots.enrichmentData}->'cafe'->>'distance' IS NOT NULL AND (${enrichedPlots.enrichmentData}->'cafe'->>'distance')::integer <= ${maxDistanceToCafe}`
          );
        }
        if (maxDistanceToSupermarket != null) {
          conditions.push(
            sql`${enrichedPlots.enrichmentData}->'supermarket'->>'distance' IS NOT NULL AND (${enrichedPlots.enrichmentData}->'supermarket'->>'distance')::integer <= ${maxDistanceToSupermarket}`
          );
        }
        if (maxDistanceToPublicTransport != null) {
          conditions.push(
            sql`${enrichedPlots.enrichmentData}->'public_transport'->>'distance' IS NOT NULL AND (${enrichedPlots.enrichmentData}->'public_transport'->>'distance')::integer <= ${maxDistanceToPublicTransport}`
          );
        }
        if (maxDistanceToRestaurant != null) {
          conditions.push(
            sql`${enrichedPlots.enrichmentData}->'restaurant_or_fastfood'->>'distance' IS NOT NULL AND (${enrichedPlots.enrichmentData}->'restaurant_or_fastfood'->>'distance')::integer <= ${maxDistanceToRestaurant}`
          );
        }
        if (maxDistanceToMainTown != null) {
          conditions.push(
            sql`${enrichedPlots.enrichmentData}->'nearest_main_town'->>'distance' IS NOT NULL AND (${enrichedPlots.enrichmentData}->'nearest_main_town'->>'distance')::integer <= ${maxDistanceToMainTown}`
          );
        }
        // Zoning enrichment filters
        if (zoningLabelContains) {
          conditions.push(
            sql`${enrichedPlots.enrichmentData}->'zoning'->>'label' ILIKE ${'%' + zoningLabelContains + '%'}`
          );
        }
        if (zoningLabelEnContains) {
          conditions.push(
            sql`${enrichedPlots.enrichmentData}->'zoning'->>'label_en' ILIKE ${'%' + zoningLabelEnContains + '%'}`
          );
        }
        if (zoningTypenameContains) {
          conditions.push(
            sql`${enrichedPlots.enrichmentData}->'zoning'->>'typename' ILIKE ${'%' + zoningTypenameContains + '%'}`
          );
        }
        if (zoningPickedFieldContains) {
          conditions.push(
            sql`${enrichedPlots.enrichmentData}->'zoning'->>'picked_field' ILIKE ${'%' + zoningPickedFieldContains + '%'}`
          );
        }
        if (zoningSourceContains) {
          conditions.push(
            sql`${enrichedPlots.enrichmentData}->'zoning'->>'source' ILIKE ${'%' + zoningSourceContains + '%'}`
          );
        }
        if (zoningTextContains) {
          conditions.push(
            sql`${enrichedPlots.enrichmentData}::text ILIKE ${'%' + zoningTextContains + '%'}`
          );
        }

        // Query with organization data
        const baseQuery = db
          .select({
            id: enrichedPlots.id,
            latitude: enrichedPlots.latitude,
            longitude: enrichedPlots.longitude,
            price: enrichedPlots.price,
            size: enrichedPlots.size,
            enrichmentData: enrichedPlots.enrichmentData,
            images: enrichedPlots.images,
            organizationPlotId: organizationPlotsTable.id,
            organizationPlotStatus: organizationPlotsTable.status,
            // Add distance calculation if center point is provided (not for bounds)
            ...(!bounds && latitude && longitude ? {
              distanceKm: sql<number>`ST_DistanceSphere(${enrichedPlots.geom}, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)) / 1000`
            } : {})
          })
          .from(enrichedPlots)
          .leftJoin(organizationPlotsTable, 
            and(
              eq(organizationPlotsTable.plotId, enrichedPlots.id),
              eq(organizationPlotsTable.organizationId, input.organizationId)
            )
          );

        // Apply conditions
        let query = baseQuery;
        if (conditions.length > 0) {
          query = query.where(and(...conditions)) as typeof baseQuery;
        }

        // Apply sorting
        if (sortBy === 'price') {
          query = query.orderBy(sortOrder === 'asc' ? asc(enrichedPlots.price) : desc(enrichedPlots.price)) as typeof baseQuery;
        } else if (sortBy === 'size') {
          query = query.orderBy(sortOrder === 'asc' ? asc(enrichedPlots.size) : desc(enrichedPlots.size)) as typeof baseQuery;
        } else if (sortBy === 'distance' && !bounds && latitude && longitude) {
          query = query.orderBy(
            sortOrder === 'asc' 
              ? sql`ST_DistanceSphere(${enrichedPlots.geom}, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326))`
              : sql`ST_DistanceSphere(${enrichedPlots.geom}, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)) DESC`
          ) as typeof baseQuery;
        }

        // Get results with pagination
        const results = await query.limit(limit).offset(offset);

        // Get total count for pagination
        const baseCountQuery = db.select({ count: sql<number>`count(*)`.as('count') }).from(enrichedPlots);
        const totalCountResult = conditions.length > 0 
          ? await baseCountQuery.where(and(...conditions))
          : await baseCountQuery;
        const totalCount = totalCountResult[0]?.count ?? 0;

        return {
          plots: results.map(plot => ({
            id: plot.id,
            latitude: plot.latitude,
            longitude: plot.longitude,
            price: plot.price ? parseFloat(plot.price) : 0,
            size: plot.size ? parseFloat(plot.size) : null,
            enrichmentData: plot.enrichmentData as EnrichmentData | null,
            images: plot.images,
            distanceKm: 'distanceKm' in plot ? plot.distanceKm : null,
            organizationPlotId: plot.organizationPlotId,
            organizationPlotStatus: plot.organizationPlotStatus as string | null,
          })),
          pagination: {
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            hasNextPage: page < Math.ceil(totalCount / limit),
            hasPrevPage: page > 1
          },
          filters: input
        };
      } catch (error) {
        console.error('Error in searchPlotsWithOrganizationData:', error);
        throw error;
      }
    }),

  // Get a single plot by ID
  getPlot: publicProcedure
    .input(z.object({
      id: z.string().uuid()
    }))
    .query(async ({ input }) => {
      try {
        const plot = await db
          .select({
            id: enrichedPlots.id,
            latitude: enrichedPlots.latitude,
            longitude: enrichedPlots.longitude,
            price: enrichedPlots.price,
            size: enrichedPlots.size,
            enrichmentData: enrichedPlots.enrichmentData,
            images: enrichedPlots.images,
            plotReportJson: enrichedPlots.plotReportJson,
            description: enrichedPlots.description,
            timeInMarket: enrichedPlots.timeInMarket,
            status: enrichedPlots.status,
            type: enrichedPlots.type,
            // Realtor-verified location data
            realLatitude: enrichedPlots.realLatitude,
            realLongitude: enrichedPlots.realLongitude,
            realAddress: enrichedPlots.realAddress,
            // Claimed realtor contact info
            claimedByUserId: enrichedPlots.claimedByUserId,
            claimedByName: enrichedPlots.claimedByName,
            claimedByEmail: enrichedPlots.claimedByEmail,
            claimedByPhone: enrichedPlots.claimedByPhone,
            claimedAt: enrichedPlots.claimedAt,
            primaryListingLink: enrichedPlots.primaryListingLink,
            municipality: {
              id: municipalities.id,
              name: municipalities.name,
              district: municipalities.district,
              country: municipalities.country,
              website: municipalities.website,
              pdmDocuments: municipalities.pdmDocuments,
            }
          })
          .from(enrichedPlots)
          .leftJoin(municipalities, eq(enrichedPlots.municipalityId, municipalities.id))
          .where(eq(enrichedPlots.id, input.id))
          .limit(1);

        if (!plot[0]) {
          throw new Error('Plot not found');
        }

        // Fetch realtors associated with this plot from new tables
        const realtorsRaw = await db.execute(sql<RealtorForPlot>`
          SELECT 
            r.id,
            r.company_name,
            r.country,
            r.website_url,
            r.email,
            r.telephone,
            psr.role,
            psr.name AS contact_name,
            psr.source_file
          FROM plots_stage_realtors psr
          JOIN realtors r ON r.id = psr.realtor_id
          WHERE psr.plot_id = ${input.id}
        `);
        // avoid any; handle both { rows: T[] } and T[] shapes
        function hasRows<T>(v: unknown): v is { rows: T[] } {
          return typeof v === 'object' && v !== null && 'rows' in v;
        }
        const realtors: RealtorForPlot[] = hasRows<RealtorForPlot>(realtorsRaw)
          ? realtorsRaw.rows
          : (realtorsRaw as unknown as RealtorForPlot[]) ?? [];
          
        return {
          id: plot[0].id,
          latitude: plot[0].latitude,
          longitude: plot[0].longitude,
          price: plot[0].price ? parseFloat(plot[0].price) : 0,
          size: plot[0].size ? parseFloat(plot[0].size) : null,
          enrichmentData: plot[0].enrichmentData as EnrichmentData | null,
          images: plot[0].images || [],
          plotReportJson: plot[0].plotReportJson,
          description: plot[0].description,
          timeInMarket: plot[0].timeInMarket,
          status: plot[0].status,
          type: plot[0].type,
          // Realtor-verified location data
          realLatitude: plot[0].realLatitude,
          realLongitude: plot[0].realLongitude,
          realAddress: plot[0].realAddress,
          // Claimed realtor contact info
          claimedByUserId: plot[0].claimedByUserId,
          claimedByName: plot[0].claimedByName,
          claimedByEmail: plot[0].claimedByEmail,
          claimedByPhone: plot[0].claimedByPhone,
          claimedAt: plot[0].claimedAt,
          primaryListingLink: plot[0].primaryListingLink,
          municipality: plot[0].municipality,
          realtors,
        };
      } catch (error) {
        console.error('Error in getPlot:', error);
        throw error;
      }
    }),

  // Extract building regulations from plot report JSON using LLM
  extractPlotRegulations: publicProcedure
    .input(z.object({
      plotId: z.string().uuid()
    }))
    .output(BuildingRegulationsSchema)
    .query(async ({ input }) => {
      try {
        const plot = await db
          .select({
            plotReportJson: enrichedPlots.plotReportJson,
          })
          .from(enrichedPlots)
          .where(eq(enrichedPlots.id, input.plotId))
          .limit(1);

        if (!plot[0] || !plot[0].plotReportJson) {
          // Return nulls if no report found
          return {
            maxBuildingHeight: null,
            maxCoverage: null,
            setbackRequirements: null,
            maxFloors: null,
            parkingRequired: null,
            greenSpace: null,
          };
        }

        // Use LLM to extract regulations
        const regulations = await extractBuildingRegulations(plot[0].plotReportJson);
        return regulations;
      } catch (error) {
        console.error('[extractPlotRegulations] Error:', error);
        throw error;
      }
    }),

  // Extract general zoning rules from municipality PDM summary using LLM
  // Implements permanent server-side caching in database (no expiry)
  // Cache is only invalidated when PDM/regulation file is updated
  extractGeneralZoningFromMunicipality: publicProcedure
    .input(z.object({
      municipalityId: z.number()
    }))
    .output(GeneralZoningRulesSchema)
    .query(async ({ input }) => {
      try {
        // Query regulations table for this municipality's summary and cached data
        const regulation = await db
          .select({
            id: regulations.id,
            summary: regulations.summary,
            cachedZoningRules: regulations.cachedZoningRules,
            zoningRulesCachedAt: regulations.zoningRulesCachedAt,
          })
          .from(regulations)
          .where(eq(regulations.municipalityId, input.municipalityId))
          .limit(1);

        if (!regulation[0] || !regulation[0].summary) {
          // Return nulls if no regulation summary found
          return {
            areaClassification: null,
            typicalPlotSize: null,
            generalHeightLimit: null,
            buildingStyle: null,
            futurePlans: null,
            keyPoints: null,
            additionalNotes: null,
          };
        }

        const reg = regulation[0];

        // Check if we have cached data (permanent cache, no expiry)
        if (reg.cachedZoningRules) {
          console.log(`[extractGeneralZoningFromMunicipality] Using cached data for municipality ${input.municipalityId}`);
          return reg.cachedZoningRules as z.infer<typeof GeneralZoningRulesSchema>;
        }

        // Cache miss - use LLM to extract general zoning rules
        console.log(`[extractGeneralZoningFromMunicipality] No cache found, calling LLM for municipality ${input.municipalityId}`);
        const zoningRules = await extractGeneralZoningRules(reg.summary!);

        // Store the result in permanent cache
        await db
          .update(regulations)
          .set({
            cachedZoningRules: zoningRules as any,
            zoningRulesCachedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(regulations.id, reg.id));

        console.log(`[extractGeneralZoningFromMunicipality] Cached zoning rules for municipality ${input.municipalityId}`);
        return zoningRules;
      } catch (error) {
        console.error('[extractGeneralZoningFromMunicipality] Error:', error);
        throw error;
      }
    }),

  // Search plots with filters for the side panel
  searchPlots: publicProcedure
    .input(plotFiltersSchema)
    .query(async ({ input }) => {
      const {
        minPrice,
        maxPrice,
        minSize,
        maxSize,
        latitude,
        longitude,
        radiusKm = 50,
        bounds,
        maxDistanceToBeach,
        maxDistanceToCafe,
        maxDistanceToSupermarket,
        maxDistanceToPublicTransport,
        maxDistanceToRestaurant,
        maxDistanceToMainTown,
        // Zoning filters
        zoningLabelContains,
        zoningLabelEnContains,
        zoningTypenameContains,
        zoningPickedFieldContains,
        zoningSourceContains,
        zoningTextContains,
        page = 1,
        limit = 20,
        sortBy = 'price',
        sortOrder = 'asc'
      } = input;

      const offset = (page - 1) * limit;
      const conditions = [];

      try {
        // Basic filters
        if (minPrice != null) {
          conditions.push(gte(enrichedPlots.price, minPrice.toString()));
        }
        if (maxPrice != null) {
          conditions.push(lte(enrichedPlots.price, maxPrice.toString()));
        }
        if (minSize != null) {
          conditions.push(gte(enrichedPlots.size, minSize.toString()));
        }
        if (maxSize != null) {
          conditions.push(lte(enrichedPlots.size, maxSize.toString()));
        }

        // Location-based filtering
        if (bounds) {
          // Use bounding box for map view
          conditions.push(
            sql`ST_Within(${enrichedPlots.geom}, ST_SetSRID(ST_MakeEnvelope(${bounds.west}, ${bounds.south}, ${bounds.east}, ${bounds.north}), 4326))`
          );
        } else if (latitude && longitude && radiusKm != null) {
          // Use radius search for center-based view
          conditions.push(
            sql`ST_DistanceSphere(${enrichedPlots.geom}, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)) <= ${radiusKm * 1000}`
          );
        }

        // Enrichment data filters
        if (maxDistanceToBeach != null) {
          conditions.push(
            sql`${enrichedPlots.enrichmentData}->'beach'->>'distance' IS NOT NULL AND (${enrichedPlots.enrichmentData}->'beach'->>'distance')::integer <= ${maxDistanceToBeach}`
          );
        }
        if (maxDistanceToCafe != null) {
          conditions.push(
            sql`${enrichedPlots.enrichmentData}->'cafe'->>'distance' IS NOT NULL AND (${enrichedPlots.enrichmentData}->'cafe'->>'distance')::integer <= ${maxDistanceToCafe}`
          );
        }
        if (maxDistanceToSupermarket != null) {
          conditions.push(
            sql`${enrichedPlots.enrichmentData}->'supermarket'->>'distance' IS NOT NULL AND (${enrichedPlots.enrichmentData}->'supermarket'->>'distance')::integer <= ${maxDistanceToSupermarket}`
          );
        }
        if (maxDistanceToPublicTransport != null) {
          conditions.push(
            sql`${enrichedPlots.enrichmentData}->'public_transport'->>'distance' IS NOT NULL AND (${enrichedPlots.enrichmentData}->'public_transport'->>'distance')::integer <= ${maxDistanceToPublicTransport}`
          );
        }
        if (maxDistanceToRestaurant != null) {
          conditions.push(
            sql`${enrichedPlots.enrichmentData}->'restaurant_or_fastfood'->>'distance' IS NOT NULL AND (${enrichedPlots.enrichmentData}->'restaurant_or_fastfood'->>'distance')::integer <= ${maxDistanceToRestaurant}`
          );
        }
        if (maxDistanceToMainTown != null) {
          conditions.push(
            sql`${enrichedPlots.enrichmentData}->'nearest_main_town'->>'distance' IS NOT NULL AND (${enrichedPlots.enrichmentData}->'nearest_main_town'->>'distance')::integer <= ${maxDistanceToMainTown}`
          );
        }

        // Zoning enrichment filters
        if (zoningLabelContains) {
          conditions.push(
            sql`${enrichedPlots.enrichmentData}->'zoning'->>'label' ILIKE ${'%' + zoningLabelContains + '%'}`
          );
        }
        if (zoningLabelEnContains) {
          conditions.push(
            sql`${enrichedPlots.enrichmentData}->'zoning'->>'label_en' ILIKE ${'%' + zoningLabelEnContains + '%'}`
          );
        }
        if (zoningTypenameContains) {
          conditions.push(
            sql`${enrichedPlots.enrichmentData}->'zoning'->>'typename' ILIKE ${'%' + zoningTypenameContains + '%'}`
          );
        }
        if (zoningPickedFieldContains) {
          conditions.push(
            sql`${enrichedPlots.enrichmentData}->'zoning'->>'picked_field' ILIKE ${'%' + zoningPickedFieldContains + '%'}`
          );
        }
        if (zoningSourceContains) {
          conditions.push(
            sql`${enrichedPlots.enrichmentData}->'zoning'->>'source' ILIKE ${'%' + zoningSourceContains + '%'}`
          );
        }
        if (zoningTextContains) {
          conditions.push(
            sql`${enrichedPlots.enrichmentData}::text ILIKE ${'%' + zoningTextContains + '%'}`
          );
        }

        // Build the base query (no organization data)
        const baseQuery = db
          .select({
            id: enrichedPlots.id,
            latitude: enrichedPlots.latitude,
            longitude: enrichedPlots.longitude,
            price: enrichedPlots.price,
            size: enrichedPlots.size,
            enrichmentData: enrichedPlots.enrichmentData,
            images: enrichedPlots.images,
            // Add distance calculation if center point is provided (not for bounds)
            ...(!bounds && latitude && longitude ? {
              distanceKm: sql<number>`ST_DistanceSphere(${enrichedPlots.geom}, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)) / 1000`
            } : {})
          })
          .from(enrichedPlots);

        // Apply conditions
        let query = baseQuery;
        if (conditions.length > 0) {
          query = query.where(and(...conditions)) as typeof baseQuery;
        }

        // Apply sorting
        if (sortBy === 'price') {
          query = query.orderBy(sortOrder === 'asc' ? asc(enrichedPlots.price) : desc(enrichedPlots.price)) as typeof baseQuery;
        } else if (sortBy === 'size') {
          query = query.orderBy(sortOrder === 'asc' ? asc(enrichedPlots.size) : desc(enrichedPlots.size)) as typeof baseQuery;
        } else if (sortBy === 'distance' && !bounds && latitude && longitude) {
          query = query.orderBy(
            sortOrder === 'asc' 
              ? sql`ST_DistanceSphere(${enrichedPlots.geom}, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326))`
              : sql`ST_DistanceSphere(${enrichedPlots.geom}, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)) DESC`
          ) as typeof baseQuery;
        }

        // Get results with pagination
        const results = await query.limit(limit).offset(offset);

        // Get total count for pagination
        const baseCountQuery = db.select({ count: sql<number>`count(*)`.as('count') }).from(enrichedPlots);
        const totalCountResult = conditions.length > 0 
          ? await baseCountQuery.where(and(...conditions))
          : await baseCountQuery;
        const totalCount = totalCountResult[0]?.count ?? 0;

        return {
          plots: results.map(plot => ({
            id: plot.id,
            latitude: plot.latitude,
            longitude: plot.longitude,
            price: plot.price ? parseFloat(plot.price) : 0,
            size: plot.size ? parseFloat(plot.size) : null,
            enrichmentData: plot.enrichmentData as EnrichmentData | null,
            images: plot.images,
            distanceKm: 'distanceKm' in plot ? plot.distanceKm : null,
          })),
          pagination: {
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            hasNextPage: page < Math.ceil(totalCount / limit),
            hasPrevPage: page > 1
          },
          filters: input
        };
      } catch (error) {
        console.error('Error in searchPlots:', error);
        throw error;
      }
    }),

  // Generate AI description for a plot
  generatePlotDescription: publicProcedure
    .input(z.object({ plotId: z.string() }))
    .query(async ({ input }) => {
      const plot = await db.query.enrichedPlots.findFirst({
        where: eq(enrichedPlots.id, input.plotId),
      });

      if (!plot) {
        throw new Error('Plot not found');
      }

      // Get municipality data if available
      let municipalityData: { name: string; district: string | null } | null = null;
      if (plot.municipalityId) {
        const muni = await db.query.municipalities.findFirst({
          where: eq(municipalities.id, plot.municipalityId),
        });
        if (muni) {
          municipalityData = { name: muni.name, district: muni.district };
        }
      }

      const enrichmentData = plot.enrichmentData as EnrichmentData | null;
      
      // Build amenities list
      const amenities: Array<{ type: string; distance: number }> = [];
      if (enrichmentData?.cafe?.distance) {
        amenities.push({ type: 'Café', distance: enrichmentData.cafe.distance });
      }
      if (enrichmentData?.supermarket?.distance) {
        amenities.push({ type: 'Supermarket', distance: enrichmentData.supermarket.distance });
      }
      if (enrichmentData?.public_transport?.distance) {
        amenities.push({ type: 'Public Transport', distance: enrichmentData.public_transport.distance });
      }
      if (enrichmentData?.restaurant_or_fastfood?.distance) {
        amenities.push({ type: 'Restaurant', distance: enrichmentData.restaurant_or_fastfood.distance });
      }
      if (enrichmentData?.beach?.distance) {
        amenities.push({ type: 'Beach', distance: enrichmentData.beach.distance });
      }

      const description = await generatePlotDescription({
        location: {
          municipality: municipalityData?.name,
          district: municipalityData?.district || undefined,
        },
        zoning: enrichmentData?.zoning,
        amenities: amenities.sort((a, b) => a.distance - b.distance).slice(0, 3),
        price: plot.price ? Number(plot.price) : undefined,
        size: plot.size ? Number(plot.size) : undefined,
      });

      return { description };
    }),

  // Analyze plot data using GPT-5-nano for dynamic insights
  analyzePlotData: publicProcedure
    .input(z.object({ 
      plotId: z.string(),
    }))
    .query(async ({ input }) => {
      const plot = await db.query.enrichedPlots.findFirst({
        where: eq(enrichedPlots.id, input.plotId),
      });

      if (!plot) {
        throw new Error('Plot not found');
      }

      // Get municipality data if available
      let municipalityData: { name: string; district: string | null; country: string | null } | undefined;
      if (plot.municipalityId) {
        const municipality = await db.query.municipalities.findFirst({
          where: eq(municipalities.id, plot.municipalityId),
        });
        if (municipality) {
          municipalityData = {
            name: municipality.name,
            district: municipality.district,
            country: municipality.country,
          };
        }
      }

      // plotReportJson is stored directly in enrichedPlots table
      const plotReportJson = plot.plotReportJson || null;

      const analysis = await analyzePlotData({
        plotReportJson,
        enrichmentData: plot.enrichmentData,
        municipalityData,
        plotInfo: {
          latitude: plot.latitude,
          longitude: plot.longitude,
          size: plot.size ? Number(plot.size) : null,
          price: plot.price ? Number(plot.price) : 0,
        },
      });

      return analysis;
    }),
}); 