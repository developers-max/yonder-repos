"use client";

import { Badge } from "@/app/_components/ui/badge";
import { Button } from "@/app/_components/ui/button";
import {
  Waves,
  Coffee,
  ShoppingCart,
  Bus,
  UtensilsCrossed,
  Building2,
  Plane,
  Store,
  FileText,
  Download,
  Check,
  MapPin,
  Settings,
  Lock
} from 'lucide-react';
import Link from 'next/link';
import type { EnrichmentData } from '@/server/trpc/router/plot/plots';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/server/trpc';
import PlotsMap from './plots-map';
import { trpc } from '@/trpc/client';
import { useSession } from '@/lib/auth/auth-client';
import { CadastralPolygonEditor, type CadastralGeometry } from '@/app/_components/map';
import { DynamicPlotAnalysis } from './dynamic-plot-analysis';

type PlotRouterOutput = inferRouterOutputs<AppRouter>;
type Plot = PlotRouterOutput['plots']['getPlot'] & {
  id: string;
  latitude: number;
  longitude: number;
  price: number;
  size: number | null;
  plotReportJson?: unknown;
  municipality: {
    id: number;
    name: string;
    district: string | null;
    country: string | null;
    website: string | null;
    pdmDocuments: {
      documents?: Array<{
        id: string;
        documentType: string;
        url: string;
        name?: string;
      }>;
    } | null;
  } | null;
};

// Realtors returned by backend for a plot
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

interface PlotDetailsOverviewProps {
  plot: Plot;
  hasRealCoordinates?: boolean;
  isAdmin?: boolean;
}

// Get country code from plot's municipality (defaults to PT)
function getCountryFromPlot(plot: Plot): 'PT' | 'ES' {
  const country = plot.municipality?.country;
  if (country === 'ES' || country === 'PT') return country;
  return 'PT'; // Default to Portugal
}

export default function PlotDetailsOverview({
  plot,
  hasRealCoordinates = true,
  isAdmin = false,
}: PlotDetailsOverviewProps) {
  const { data: session } = useSession();
  const organizationId = session?.session?.activeOrganizationId;
  const utils = trpc.useUtils();

  // Fetch extracted building regulations using LLM
  const { data: regulations, isLoading: regulationsLoading } = trpc.plots.extractPlotRegulations.useQuery(
    { plotId: plot.id },
    { 
      enabled: !!plot.plotReportJson,
      staleTime: 1000 * 60 * 60, // Cache for 1 hour
    }
  );

  const createReq = trpc.projects.createPdmRequest.useMutation({
    onSuccess: () => {
      // Invalidate the status query to refresh the UI
      utils.projects.myPdmRequestStatus.invalidate();
    },
  });

  const { data: myReq } = trpc.projects.myPdmRequestStatus.useQuery(
    plot?.municipality?.id
      ? {
          plotId: plot.id,
          municipalityId: plot.municipality.id,
          organizationId: organizationId || undefined,
        }
      : (null as unknown as { plotId: string; municipalityId: number }),
    { enabled: !!plot?.municipality?.id }
  );

  const handleRequestPdm = async () => {
    if (!plot?.municipality?.id) return;
    await createReq.mutateAsync({
      chatId: undefined,
      organizationId: organizationId || undefined,
      plotId: plot.id,
      municipalityId: plot.municipality.id,
    });
  };
  // Get enrichment info helper
  const getEnrichmentInfo = (enrichmentData: EnrichmentData) => {
    if (!enrichmentData) return [];

    const info = [];

    if (enrichmentData.beach?.distance) {
      info.push({
        type: "Beach",
        distance: enrichmentData.beach.distance,
        icon: Waves,
      });
    }
    if (enrichmentData.cafe?.distance) {
      info.push({
        type: "Café",
        distance: enrichmentData.cafe.distance,
        icon: Coffee,
      });
    }
    if (enrichmentData.supermarket?.distance) {
      info.push({
        type: "Supermarket",
        distance: enrichmentData.supermarket.distance,
        icon: ShoppingCart,
      });
    }
    if (enrichmentData.public_transport?.distance) {
      info.push({
        type: "Transport",
        distance: enrichmentData.public_transport.distance,
        icon: Bus,
      });
    }
    if (enrichmentData.convenience_store?.distance) {
      info.push({
        type: "Store",
        distance: enrichmentData.convenience_store.distance,
        icon: Store,
      });
    }
    if (enrichmentData.restaurant_or_fastfood?.distance) {
      info.push({
        type: "Restaurant",
        distance: enrichmentData.restaurant_or_fastfood.distance,
        icon: UtensilsCrossed,
      });
    }
    if (enrichmentData.nearest_main_town?.distance) {
      info.push({
        type: "Town",
        distance: enrichmentData.nearest_main_town.distance,
        icon: Building2,
      });
    }
    if (enrichmentData.airport?.distance) {
      info.push({
        type: "Airport",
        distance: enrichmentData.airport.distance,
        icon: Plane,
      });
    }
    if (enrichmentData.coastline?.distance) {
      info.push({
        type: "Coast",
        distance: enrichmentData.coastline.distance,
        icon: Waves,
      });
    }

    return info.sort((a, b) => a.distance - b.distance);
  };

  const enrichmentInfo = plot.enrichmentData ? getEnrichmentInfo(plot.enrichmentData as EnrichmentData) : [];
  const zoning = (plot.enrichmentData as EnrichmentData | null)?.zoning;
  const realtors: RealtorForPlot[] = ((plot as unknown) as { realtors?: RealtorForPlot[] }).realtors ?? [];

  // Fallback: use assigned realtor from user's active organization project (if logged in)
  //const { data: orgPlots } = trpc.projects.getOrganizationPlots.useQuery(
  //  { organizationId: organizationId || '' },
  //  { enabled: !!organizationId }
  //);
  //const orgAssigned = orgPlots?.find(p => p.plotId === plot.id);
  //const assignedRealtorName = orgAssigned?.realtorName || null;

  // Filter realtors: only agency or source roles with email
  const filteredRealtors = realtors.filter(
    r => (r.role === 'agency' || r.role === 'source') && r.email
  );
  
  // Remove duplicates based on company name
  const uniqueCompanies = new Map<string, RealtorForPlot>();
  filteredRealtors.forEach(realtor => {
    const companyKey = realtor.company_name || realtor.contact_name;
    if (!uniqueCompanies.has(companyKey)) {
      uniqueCompanies.set(companyKey, realtor);
    }
  });
 // const uniqueRealtors = Array.from(uniqueCompanies.values());
  
  // Prioritize agencies over sources
  //const agencies = uniqueRealtors.filter(r => r.role === 'agency');
  //const sources = uniqueRealtors.filter(r => r.role === 'source');
  //const firstRealtor = (agencies.length > 0 ? agencies[0] : sources[0]) ?? null;

  //const displayName = assignedRealtorName || firstRealtor?.company_name || firstRealtor?.contact_name || '—';
  //const displayWebsite = firstRealtor?.website_url || null;

  const cadastralData = (plot.enrichmentData as EnrichmentData | null)?.cadastral as Record<string, unknown> | null;
  const parcelData = cadastralData?.parcel as Record<string, unknown> | undefined;
  const getString = (value: unknown) => (typeof value === 'string' && value.trim().length > 0 ? value : null);
  const getNumber = (value: unknown) => {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const cadastralReference =
    getString(cadastralData?.["cadastral_reference"]) ||
    getString(parcelData?.["cadastral_reference"]);
  const parcelAreaValue =
    getNumber(parcelData?.["area_value"]) ??           // Spain: parcel.area_value
    getNumber(cadastralData?.["parcel_area"]) ??       // Fallback
    getNumber(cadastralData?.["parcel_area_m2"]);      // Portugal: parcel_area_m2 at top level
  const parcelLabel =
    getString(parcelData?.["label"]) ||                // Spain: parcel.label
    getString(cadastralData?.["parcel_label"]) ||      // Fallback
    getString(cadastralData?.["label"]);

  // Determine if this is Spain (for POUM terminology) based on district patterns
  // Spanish districts typically include "Barcelona", "Madrid", "Valencia", etc.
  const isSpain = plot.municipality?.district?.includes('Barcelona') || 
                  plot.municipality?.district?.includes('Madrid') ||
                  plot.municipality?.district?.includes('Valencia') ||
                  plot.municipality?.district?.includes('Sevilla') ||
                  plot.municipality?.district?.includes('Catalunya') ||
                  plot.municipality?.district?.includes('Cataluña');
  
  const planningDocName = isSpain ? 'POUM' : 'PDM';

  // Extract cadastral geometry for polygon editor (Portugal BUPi data)
  const cadastralGeometry = (() => {
    const geometry = cadastralData?.geometry as { type?: string; coordinates?: number[][][] } | undefined;
    if (geometry?.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
      return geometry as CadastralGeometry;
    }
    return null;
  })();

  // Handler for polygon save (TODO: implement API call to save updated geometry)
  const handlePolygonSave = (geometry: CadastralGeometry) => {
    console.log('Polygon saved:', geometry);
    // TODO: Call API to update plot geometry
  };

  const renderLockedValue = (value: string | null | undefined) => {
    return value ?? 'N/A';
  };

  return (
    <div className="space-y-6 md:space-y-8">

      {/* Cadastral Snapshot */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-gray-200 p-4 bg-white">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Cadastral Reference</div>
            <div className="text-xl font-semibold text-gray-900">
              {!isAdmin && !hasRealCoordinates ? (
                <span className="flex items-center gap-2 text-base text-gray-500">
                  <Lock className="w-4 h-4" />
                  <span className="text-sm italic font-normal">Requires verified plot coordinates</span>
                </span>
              ) : (
                cadastralReference || 'N/A'
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 p-4 bg-white">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Parcel Area</div>
            <div className="text-xl font-semibold text-gray-900">
              {!isAdmin && !hasRealCoordinates ? (
                <span className="flex items-center gap-2 text-base text-gray-500">
                  <Lock className="w-4 h-4" />
                  <span className="text-sm italic font-normal">Requires verified plot coordinates</span>
                </span>
              ) : (
                parcelAreaValue ? `${parcelAreaValue.toLocaleString()} m²` : 'N/A'
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 p-4 bg-white">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Plot Label</div>
            <div className="text-xl font-semibold text-gray-900">
              {!isAdmin && !hasRealCoordinates ? (
                <span className="flex items-center gap-2 text-base text-gray-500">
                  <Lock className="w-4 h-4" />
                  <span className="text-sm italic font-normal">Requires verified plot coordinates</span>
                </span>
              ) : (
                parcelLabel || 'N/A'
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Amenities & Surrounding Area - Moved to Area Information section in plot-details.tsx */}
      {/* {enrichmentInfo.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6 space-y-3 md:space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Nearby Amenities</h3>
          <div className="space-y-2">
            {enrichmentInfo.map((info, i) => {
              const Icon = info.icon;
              const distanceText = info.distance >= 1000 
                ? `${(info.distance / 1000).toFixed(1)}km`
                : `${info.distance}m`;
              
              return (
                <div key={i} className="flex items-center justify-between py-1.5 md:py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2 md:gap-3">
                    <Icon className="w-4 md:w-5 h-4 md:h-5 text-gray-700" />
                    <span className="text-sm md:text-base text-gray-900">{info.type}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-600 bg-gray-50 px-3 py-1 rounded-md">
                    {distanceText}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )} */}

      {/* Dynamic AI-Powered Plot Analysis - Replaces static Zoning and Building Regulations sections */}
      <DynamicPlotAnalysis plotId={plot.id} />

      {/* Cadastre Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Cadastre</h3>
              <p className="text-sm text-gray-600">Official parcel boundaries, cadastral ID, and registration data</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link
                href={`/admin/plots?plotId=${plot.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
                Edit
              </Link>
            )}
          </div>
        </div>

        {!isAdmin && !hasRealCoordinates ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Lock className="w-4 h-4" />
            <span className="text-sm italic">Requires verified plot coordinates</span>
          </div>
        ) : (plot.enrichmentData as EnrichmentData | null)?.cadastral ? (
          <>
            {/* Cadastre Map with Parcel Boundaries */}
            <div className="mb-6 rounded-lg overflow-hidden">
              <CadastralPolygonEditor
                initialGeometry={cadastralGeometry || undefined}
                center={{
                  latitude: plot.latitude,
                  longitude: plot.longitude,
                }}
                onSave={handlePolygonSave}
                readOnly={true}
                showArea={false}
                height="384px"
                minimal={true}
                showCadastreLayer={true}
                country={getCountryFromPlot(plot)}
              />
            </div>

            {/* Cadastral Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">Property Type</div>
                <div className="text-base font-semibold text-gray-900">
                  {renderLockedValue((() => {
                    // Try building current_use from cadastral data (Spain)
                    const buildingData = cadastralData?.building as Record<string, unknown> | undefined;
                    const currentUse = getString(buildingData?.current_use);
                    if (currentUse) return currentUse;
                    
                    // Try buildings array (Spain - multiple buildings)
                    const buildings = cadastralData?.buildings as Array<Record<string, unknown>> | undefined;
                    const firstBuildingUse = getString(buildings?.[0]?.current_use);
                    if (firstBuildingUse) return firstBuildingUse;
                    
                    // Fallback to zoning label if available
                    const zoningLabel = getString(zoning?.label) || getString(zoning?.label_en);
                    if (zoningLabel) {
                      // Take the part before the "|" to shorten it
                      const shortened = zoningLabel.split('|')[0]?.trim();
                      return shortened || zoningLabel;
                    }
                    
                    return 'N/A';
                  })())}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Cadastral Value</div>
                <div className="text-base font-semibold text-gray-900">
                  {renderLockedValue(plot.price ? `€${plot.price.toLocaleString()}` : 'N/A')}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Last Updated</div>
                <div className="text-base font-semibold text-gray-900">
                  {renderLockedValue((() => {
                    // DEBUG: Log cadastral data structure
                    if (cadastralData) {
                      console.log('[DEBUG] cadastralData keys:', Object.keys(cadastralData));
                      console.log('[DEBUG] cadastralData:', JSON.stringify(cadastralData, null, 2));
                    }
                    
                    // Try parcel beginning_lifespan (Spain - nested under parcel)
                    const beginLifespan = getString(parcelData?.beginning_lifespan) || 
                                          getString(parcelData?.valid_from);
                    if (beginLifespan) {
                      const date = new Date(beginLifespan);
                      if (!isNaN(date.getTime())) {
                        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                      }
                    }
                    
                    // Try registration_date (Portugal - top level of cadastral)
                    const registrationDate = getString(cadastralData?.registration_date) ||
                                              getString(cadastralData?.beginlifespanversion) ||
                                              getString(cadastralData?.["beginLifespanVersion"]) ||
                                              getString(cadastralData?.validfrom) ||
                                              getString(cadastralData?.["validFrom"]);
                    if (registrationDate) {
                      const date = new Date(registrationDate);
                      if (!isNaN(date.getTime())) {
                        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                      }
                    }

                    // Fallback: check properties sub-object (raw API response structure)
                    const props = cadastralData?.properties as Record<string, unknown> | undefined;
                    const propsDate = getString(props?.beginlifespanversion) ||
                                       getString(props?.validfrom);
                    if (propsDate) {
                      const date = new Date(propsDate);
                      if (!isNaN(date.getTime())) {
                        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                      }
                    }
                    
                    return 'N/A';
                  })())}
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 pt-4 border-t border-gray-100">
              Cadastral data includes official boundary coordinates, property classification, and assessed values from the Spanish Cadastre database.
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-500">No cadastral data available for this plot.</p>
        )}
      </div>
    </div>
  );
}

