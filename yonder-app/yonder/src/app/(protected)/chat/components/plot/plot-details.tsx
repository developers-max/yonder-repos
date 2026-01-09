"use client";

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { useReverseGeocode } from "@/lib/hooks/useReverseGeocode";
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/server/trpc';
import { Button } from '@/app/_components/ui/button';
import { ImageCarousel } from '@/app/_components/ui/image-carousel';
import {
  ArrowLeft,
  Share2,
  Check,
  Info,
  Sparkles,
  Mail,
  User,
  Plus,
  Minus,
  FileText,
  AlertTriangle,
  Lock,
  Image as ImageIcon,
  MapPin,
  ExternalLink,
  Waves,
  ShoppingCart,
  Building2,
  TrendingUp,
  Clock,
  Home,
  Ruler,
  Coffee,
  Bus,
  Store,
  UtensilsCrossed,
  Plane,
  Map,
  Maximize2,
  ArrowUpCircle,
  Palette,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { EnrichmentData } from '@/server/trpc/router/plot/plots';
import PlotDetailsOverview from './plot-details-overview';
import PlotDetailsProgress from './plot-details-progress';
import { authClient } from '@/lib/auth/auth-client';
import { UnverifiedPlotBanner } from '@/app/_components/plot/unverified-plot-banner';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type StrongPlot = RouterOutputs['plots']['getPlot'] & {
  id: string;
  latitude: number;
  longitude: number;
  price: number;
  size: number | null;
  images: string[];
  description: string | null;
  timeInMarket: number | null;
  status: string | null;
  type: string | null;
  enrichmentData: EnrichmentData | null;
  // Realtor-verified location data
  realLatitude: number | null;
  realLongitude: number | null;
  realAddress: string | null;
  // Claimed realtor contact info
  claimedByUserId: string | null;
  claimedByName: string | null;
  claimedByEmail: string | null;
  claimedByPhone: string | null;
  claimedAt: string | null;
  // Primary listing link
  primaryListingLink: string | null;
  // Municipality data
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

// Plot details component
interface PlotDetailsProps {
  plotId: string;
  onBack: () => void;
  standalone?: boolean;
}


export default function PlotDetails({
  plotId,
  onBack,
  standalone = false,
}: PlotDetailsProps) {
  const [copySuccess, setCopySuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "progress">(
    "overview"
  );
  const {
    data: plot,
    isLoading,
    error,
  } = trpc.plots.getPlot.useQuery({ id: plotId });

  // Add-to-project logic
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const { data: session } = authClient.useSession();
  
  // Admin check for testing buttons
  const { data: adminCheck } = trpc.admin.isAdmin.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !!session?.user?.id,
  });
  const isAdmin = adminCheck?.isAdmin ?? false;
  
  // Realtor check for unverified plot banner
  const { data: realtorCheck } = trpc.realtor.isRealtor.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !!session?.user?.id,
  });
  const isRealtor = realtorCheck?.isRealtor ?? false;
  const organizationId = activeOrganization?.id;
  const utils = trpc.useUtils();
  const { data: orgPlots } = trpc.projects.getOrganizationPlots.useQuery(
    { organizationId: organizationId || "" },
    { enabled: !!organizationId }
  );
  const addPlotMutation = trpc.projects.selectPlotForOrganization.useMutation({
    onSuccess: () => {
      if (organizationId) {
        utils.projects.getOrganizationPlots.invalidate({ organizationId });
      }
    },
  });
  const removePlotMutation = trpc.projects.removePlotsFromOrganization.useMutation({
    onSuccess: () => {
      if (organizationId) {
        utils.projects.getOrganizationPlots.invalidate({ organizationId });
        utils.projects.getOrganizationProject.invalidate({ organizationId });
      }
    },
  });
  const isPlotAlreadyAdded = !!orgPlots?.some(p => p.plotId === plotId);
  const handleAddPlot = async () => {
    if (!organizationId) return;
    try {
      await addPlotMutation.mutateAsync({ organizationId, plotId });
    } catch (err) {
      console.error('Failed to add plot:', err);
    }
  };
  const handleRemovePlot = async () => {
    if (!organizationId) return;
    const proceed = window.confirm('Remove this plot from your project?');
    if (!proceed) return;
    try {
      await removePlotMutation.mutateAsync({ organizationId, plotIds: [plotId] });
    } catch (err) {
      console.error('Failed to remove plot:', err);
    }
  };


  const plotWithCoords = plot as StrongPlot | undefined;
  const {
    shortAddress,
    fullAddress,
    isLoading: addressLoading,
  } = useReverseGeocode(
    plotWithCoords?.latitude ?? null,
    plotWithCoords?.longitude ?? null
  );

  // Fetch general zoning rules from municipality PDM summary using LLM
  const municipalityId = (plot as StrongPlot | undefined)?.municipality?.id;
  const { data: generalZoning, isLoading: generalZoningLoading } = trpc.plots.extractGeneralZoningFromMunicipality.useQuery(
    { municipalityId: municipalityId || 0 },
    { 
      enabled: !!municipalityId,
      staleTime: 1000 * 60 * 60 * 24, // Cache for 24 hours
    }
  );

  // Accordion state for zoning sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/plot/${plotId}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between">
            {!standalone && (
              <Button onClick={onBack} variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to search
              </Button>
            )}
            <Button
              onClick={handleShare}
              variant="outline"
              size="sm"
              className={!standalone ? "" : "ml-auto"}
            >
              {copySuccess ? (
                <Check className="w-4 h-4 mr-1 text-green-600" />
              ) : (
                <Share2 className="w-4 h-4 mr-1" />
              )}
              {copySuccess ? "Copied!" : "Share"}
            </Button>
          </div>
        </div>
        <div className="p-6 pt-4 space-y-4">
          <div className="bg-muted animate-pulse aspect-[4/3] rounded-lg"></div>
          <div className="space-y-2">
            <div className="bg-muted animate-pulse h-4 w-3/4 rounded"></div>
            <div className="bg-muted animate-pulse h-4 w-1/2 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !plot) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between">
            {!standalone && (
              <Button onClick={onBack} variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to search
              </Button>
            )}
            <Button
              onClick={handleShare}
              variant="outline"
              size="sm"
              className={!standalone ? "" : "ml-auto"}
            >
              {copySuccess ? (
                <Check className="w-4 h-4 mr-1 text-green-600" />
              ) : (
                <Share2 className="w-4 h-4 mr-1" />
              )}
              {copySuccess ? "Copied!" : "Share"}
            </Button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-destructive mb-2">Failed to load plot details</p>
            <p className="text-muted-foreground text-sm">
              {error?.message || "Plot not found"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const strongPlot = plot as StrongPlot;

  return (
    <div
      className={`relative overflow-hidden ${
        standalone ? "h-screen" : "h-full"
      }`}
    >
      {/* Header - Mobile optimized */}
      {
        (
        <div className="absolute top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg">
          <div className="p-3 md:p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
                {!standalone && (
                  <Button onClick={onBack} variant="ghost" size="sm" className="flex-shrink-0 px-2 md:px-3">
                    <ArrowLeft className="w-4 h-4 md:mr-1" />
                    <span className="hidden md:inline">Back to search</span>
                  </Button>
                )}

                {/* Tab Navigation - Touch friendly */}
                {
                  (
                  <div className="flex items-center space-x-0.5 border border-gray-200 rounded-full p-0.5 bg-background">
                    <button
                      onClick={() => setActiveTab("overview")}
                      className={`flex items-center gap-1 md:gap-1.5 h-9 md:h-8 px-3 md:px-2.5 rounded-full text-sm transition-all ${
                        activeTab === "overview"
                          ? "bg-black text-white shadow-sm"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      }`}
                    >
                      <Info className="w-4 h-4" />
                      <span className="hidden sm:inline">Overview</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("progress")}
                      className={`flex items-center gap-1 md:gap-1.5 h-9 md:h-8 px-3 md:px-2.5 rounded-full text-sm transition-all ${
                        activeTab === "progress"
                          ? "bg-black text-white shadow-sm"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      }`}
                    >
                      <span>Progress</span>
                    </button>
                  </div>
                  )
                }
              </div>

              <Button onClick={handleShare} variant="outline" size="sm" className="flex-shrink-0 px-2 md:px-3">
                {copySuccess ? (
                  <Check className="w-4 h-4 md:mr-1 text-green-600" />
                ) : (
                  <Share2 className="w-4 h-4 md:mr-1" />
                )}
                <span className="hidden md:inline">{copySuccess ? "Copied!" : "Share"}</span>
              </Button>
            </div>
          </div>
        </div>
        )
      }

      {/* Content - Mobile optimized padding */}
      <div
        className={`h-full overflow-y-auto pt-14 md:pt-16`}
      >
        <div className="p-3 md:p-6 pt-3 md:pt-4 space-y-4 md:space-y-6">
          {/* Plot Information - only show for overview or standalone */}
          {(standalone || activeTab === "overview") && (
            <>
              {/* Plot Verification Banner - Visible to realtors and admins */}
              {(isRealtor || isAdmin) && (
                <UnverifiedPlotBanner 
                  plotId={plotId} 
                  isVerified={strongPlot.realLatitude != null && strongPlot.realLongitude != null}
                  isClaimed={strongPlot.claimedByUserId != null}
                />
              )}

              {/* Listing Card - Idealista Style */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2 text-gray-900">
                    <FileText className="w-4 h-4" />
                    <span className="font-medium text-sm">Listing</span>
                  </div>
                  <span className="text-xs font-medium text-gray-500 border border-gray-200 rounded px-2 py-1">
                    Public Info
                  </span>
                </div>

                {/* Image Gallery */}
                <div className="p-4">
                  <div className="relative">
                    {/* Image Carousel */}
                    <div className="rounded-xl overflow-hidden">
                      <ImageCarousel images={strongPlot.images || []} alt="Plot image" />
                    </div>
                    
                    {/* Action Buttons Overlay */}
                    <div className="absolute top-2 right-2 md:top-3 md:right-3 flex items-center gap-1.5 md:gap-2 z-10">
                      <Button 
                        onClick={handleShare} 
                        variant="outline" 
                        size="icon"
                        className="bg-white/90 backdrop-blur-sm hover:bg-white h-8 w-8 md:h-9 md:w-9"
                      >
                        {copySuccess ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Share2 className="w-4 h-4" />
                        )}
                      </Button>
                      {!isPlotAlreadyAdded ? (
                        <Button
                          onClick={handleAddPlot}
                          disabled={addPlotMutation.isPending || !organizationId}
                          className="bg-white/90 backdrop-blur-sm hover:bg-white text-gray-900 h-8 md:h-9 px-2 md:px-3"
                          size="sm"
                        >
                          <Plus className="w-4 h-4 md:mr-1" />
                          <span className="hidden md:inline">Add to project</span>
                        </Button>
                      ) : (
                        <Button
                          onClick={handleRemovePlot}
                          disabled={removePlotMutation.isPending || !organizationId}
                          variant="outline"
                          size="sm"
                          className="bg-white/90 backdrop-blur-sm hover:bg-red-50 text-red-600 h-8 md:h-9 px-2 md:px-3"
                        >
                          <Minus className="w-4 h-4 md:mr-1" />
                          <span className="hidden md:inline">Remove</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Photos Tab */}
                  <div className="flex items-center gap-6 mt-4 border-b border-gray-100 pb-3">
                    <button className="flex items-center gap-1.5 text-sm text-gray-900 font-medium">
                      <ImageIcon className="w-4 h-4" />
                      Photos {strongPlot.images?.length || 0}
                    </button>
                  </div>
                </div>

                {/* Content: Two Column Layout */}
                <div className="px-4 pb-4">
                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Left Column - Plot Details */}
                    <div className="flex-1 space-y-3">
                      {/* Title with Type Badge */}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                            {addressLoading ? '...' : (shortAddress || 'Unknown Location')}
                          </h1>
                          {strongPlot.type && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              {strongPlot.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-500 mt-1 text-sm md:text-base">
                          {!addressLoading && fullAddress ? fullAddress : (shortAddress || 'Location not available')}
                        </p>
                      </div>

                      {/* Price and Size Row */}
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="text-2xl md:text-3xl font-bold text-gray-900">
                          €{plot.price ? plot.price.toLocaleString() : 'N/A'}
                        </span>
                        <span className="text-sm md:text-base text-gray-500">
                          {plot.size ? `${plot.size.toLocaleString()} m²` : ''}
                          {plot.price && plot.size && ` · €${Math.round(plot.price / plot.size).toLocaleString()}/m²`}
                        </span>
                      </div>

                      {/* Description */}
                      {strongPlot.description && (
                        <div className="max-h-24 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                          <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
                            {String(strongPlot.description)}
                          </p>
                        </div>
                      )}

                    </div>

                    {/* Right Column - Listed By Card */}
                    {(() => {
                      type RealtorInfo = {company_name: string; contact_name: string; email: string | null; telephone: string | null; role: string};
                      const realtors = ((strongPlot as unknown) as { realtors?: RealtorInfo[] }).realtors ?? [];
                      const filteredRealtors = realtors.filter(r => (r.role === 'agency' || r.role === 'source') && r.email);
                      const uniqueCompanies = Object.create(null) as Record<string, RealtorInfo>;
                      filteredRealtors.forEach(realtor => {
                        const companyKey = realtor.company_name || realtor.contact_name;
                        if (!(companyKey in uniqueCompanies)) {
                          uniqueCompanies[companyKey] = realtor;
                        }
                      });
                      const uniqueRealtors = Object.values(uniqueCompanies);
                      const agencies = uniqueRealtors.filter(r => r.role === 'agency');
                      const sources = uniqueRealtors.filter(r => r.role === 'source');
                      const firstRealtor = (agencies.length > 0 ? agencies[0] : sources[0]) ?? null;

                      if (!firstRealtor) return null;

                      return (
                        <div className="lg:w-72 flex-shrink-0">
                          <div className="border border-gray-200 rounded-xl p-4">
                            <div className="text-xs text-gray-500 mb-3">Listed by</div>
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                <FileText className="w-5 h-5 text-gray-400" />
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900">{firstRealtor.contact_name}</div>
                                {firstRealtor.company_name && (
                                  <div className="text-sm text-gray-500">{firstRealtor.company_name}</div>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => {
                                if (typeof window !== 'undefined') {
                                  window.dispatchEvent(
                                    new CustomEvent('realtorOutreachRequested', { detail: { selectedPlotIds: [plotId] } })
                                  );
                                }
                              }}
                            >
                              <Mail className="w-4 h-4 mr-2" />
                              Contact via Yonder
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Area Information Section */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2 text-gray-900">
                    <MapPin className="w-4 h-4" />
                    <span className="font-medium text-sm">Area Information</span>
                  </div>
                  <span className="text-xs font-medium text-gray-500 border border-gray-200 rounded px-2 py-1">
                    Based on listing area
                  </span>
                </div>

                <div className="p-4 space-y-4">
                  {/* Municipality Card */}
                  {strongPlot.municipality && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Municipality</div>
                          <h3 className="font-semibold text-gray-900">{strongPlot.municipality.name}</h3>
                          <p className="text-sm text-gray-500">
                            {strongPlot.municipality.district}{strongPlot.municipality.country ? `, ${strongPlot.municipality.country}` : ''}
                          </p>
                        </div>
                        {strongPlot.municipality.website && (
                          <a 
                            href={strongPlot.municipality.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                          >
                            Official website
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Area Statistics Card */}
                  <div className="bg-gray-50 rounded-xl p-3 md:p-4">
                    <div className="mb-2 md:mb-3">
                      <h3 className="font-semibold text-gray-900 text-sm md:text-base">Area Statistics</h3>
                      <p className="text-xs text-gray-500">Regional averages for {strongPlot.municipality?.name || 'this area'}</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                      <div className="text-center p-2 md:p-3 bg-white rounded-lg">
                        <Ruler className="w-4 md:w-5 h-4 md:h-5 text-gray-400 mx-auto mb-1" />
                        <div className="text-[10px] md:text-xs text-gray-500">Avg. Price/m²</div>
                        <div className="font-semibold text-gray-900 text-sm md:text-base">
                          {plot.price && plot.size ? `€${Math.round(plot.price / plot.size).toLocaleString()}` : 'N/A'}
                        </div>
                      </div>
                      <div className="text-center p-2 md:p-3 bg-white rounded-lg">
                        <Clock className="w-4 md:w-5 h-4 md:h-5 text-gray-400 mx-auto mb-1" />
                        <div className="text-[10px] md:text-xs text-gray-500">Time on Market</div>
                        <div className="font-semibold text-gray-900 text-sm md:text-base">
                          {strongPlot.timeInMarket ? `${strongPlot.timeInMarket} days` : 'N/A'}
                        </div>
                      </div>
                      <div className="text-center p-2 md:p-3 bg-white rounded-lg">
                        <Home className="w-4 md:w-5 h-4 md:h-5 text-gray-400 mx-auto mb-1" />
                        <div className="text-[10px] md:text-xs text-gray-500">Dominant Use</div>
                        <div className="font-semibold text-gray-900 text-xs md:text-sm">
                          {strongPlot.type ? strongPlot.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Residential'}
                        </div>
                      </div>
                      <div className="text-center p-2 md:p-3 bg-white rounded-lg">
                        <TrendingUp className="w-4 md:w-5 h-4 md:h-5 text-gray-400 mx-auto mb-1" />
                        <div className="text-[10px] md:text-xs text-gray-500">Construction</div>
                        <div className="font-semibold text-gray-900 text-sm md:text-base">N/A</div>
                      </div>
                    </div>
                  </div>

                  {/* Nearby Amenities Card - Using real enrichment data */}
                  {(() => {
                    const enrichmentData = strongPlot.enrichmentData as EnrichmentData | null;
                    if (!enrichmentData) return null;
                    
                    const amenities = [];
                    if (enrichmentData.beach?.distance) {
                      amenities.push({ type: "Beach", distance: enrichmentData.beach.distance, icon: Waves });
                    }
                    if (enrichmentData.cafe?.distance) {
                      amenities.push({ type: "Café", distance: enrichmentData.cafe.distance, icon: Coffee });
                    }
                    if (enrichmentData.supermarket?.distance) {
                      amenities.push({ type: "Supermarket", distance: enrichmentData.supermarket.distance, icon: ShoppingCart });
                    }
                    if (enrichmentData.public_transport?.distance) {
                      amenities.push({ type: "Transport", distance: enrichmentData.public_transport.distance, icon: Bus });
                    }
                    if (enrichmentData.convenience_store?.distance) {
                      amenities.push({ type: "Store", distance: enrichmentData.convenience_store.distance, icon: Store });
                    }
                    if (enrichmentData.restaurant_or_fastfood?.distance) {
                      amenities.push({ type: "Restaurant", distance: enrichmentData.restaurant_or_fastfood.distance, icon: UtensilsCrossed });
                    }
                    if (enrichmentData.nearest_main_town?.distance) {
                      amenities.push({ type: "Town", distance: enrichmentData.nearest_main_town.distance, icon: Building2 });
                    }
                    if (enrichmentData.airport?.distance) {
                      amenities.push({ type: "Airport", distance: enrichmentData.airport.distance, icon: Plane });
                    }
                    if (enrichmentData.coastline?.distance) {
                      amenities.push({ type: "Coast", distance: enrichmentData.coastline.distance, icon: Waves });
                    }
                    
                    const sortedAmenities = amenities.sort((a, b) => a.distance - b.distance);
                    
                    if (sortedAmenities.length === 0) return null;
                    
                    return (
                      <div className="bg-gray-50 rounded-xl p-4">
                        <div className="mb-3">
                          <h3 className="font-semibold text-gray-900">Nearby Amenities</h3>
                          <p className="text-xs text-gray-500">Approximate distances based on area centroid</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                          {sortedAmenities.map((amenity, i) => {
                            const Icon = amenity.icon;
                            const distanceText = amenity.distance >= 1000 
                              ? `${(amenity.distance / 1000).toFixed(1)} km`
                              : `${amenity.distance} m`;
                            return (
                              <div key={i} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 text-gray-600">
                                  <Icon className="w-4 h-4" />
                                  <span>{amenity.type}</span>
                                </div>
                                <span className="text-gray-900">{distanceText}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* General Zoning Rules Card - Municipality PDM Analysis */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border-b border-gray-200">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Map className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 text-base">General Zoning Rules</h3>
                            <p className="text-xs text-gray-600 mt-0.5">Municipality-level regulations for this area</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {generalZoningLoading ? (
                      <div className="flex flex-col items-center justify-center py-12 px-4">
                        <Sparkles className="w-8 h-8 animate-pulse text-blue-500 mb-3" />
                        <span className="text-sm font-medium text-gray-700">Extracting zoning rules...</span>
                        <span className="text-xs text-gray-500 mt-1">Analyzing municipality regulations with AI</span>
                      </div>
                    ) : generalZoning && (generalZoning.areaClassification || generalZoning.typicalPlotSize || generalZoning.generalHeightLimit || generalZoning.buildingStyle) ? (
                      <div className="divide-y divide-gray-100">
                        {/* Summary Paragraph - Always Visible */}
                        <div className="p-4 bg-gray-50">
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {(() => {
                              const parts: string[] = [];
                              
                              if (generalZoning.areaClassification) {
                                const zones = generalZoning.areaClassification.split(/[,;]/).map(z => z.trim());
                                parts.push(`This municipality includes ${zones.length} zone type${zones.length > 1 ? 's' : ''} such as ${zones.slice(0, 3).join(', ')}${zones.length > 3 ? ', and others' : ''}.`);
                              }
                              
                              if (generalZoning.typicalPlotSize || generalZoning.generalHeightLimit) {
                                const regulations: string[] = [];
                                if (generalZoning.typicalPlotSize) {
                                  regulations.push(`plot sizes ${generalZoning.typicalPlotSize.split(/[;]/)[0].trim().toLowerCase()}`);
                                }
                                if (generalZoning.generalHeightLimit) {
                                  regulations.push(`height limits ${generalZoning.generalHeightLimit.split(/[;]/)[0].trim().toLowerCase()}`);
                                }
                                parts.push(`Typical regulations include ${regulations.join(' and ')}.`);
                              }
                              
                              if (generalZoning.buildingStyle) {
                                parts.push(`Building style requirements emphasize ${generalZoning.buildingStyle.split(/[;]/)[0].trim().toLowerCase()}.`);
                              }
                              
                              return parts.join(' ');
                            })()}
                          </p>
                        </div>

                        {/* Accordion Sections */}
                        <div>
                          {/* Area Classification */}
                          {generalZoning.areaClassification && (
                            <div className="border-b border-gray-100 last:border-0">
                              <button
                                onClick={() => toggleSection('areaClassification')}
                                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="p-1.5 bg-green-100 rounded-md group-hover:bg-green-200 transition-colors">
                                    <Map className="w-4 h-4 text-green-600" />
                                  </div>
                                  <span className="font-medium text-gray-900 text-sm">Area Classification</span>
                                  <span className="text-xs text-gray-500">({generalZoning.areaClassification.split(/[,;]/).length} zones)</span>
                                </div>
                                {expandedSections.has('areaClassification') ? (
                                  <ChevronUp className="w-5 h-5 text-gray-400" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-gray-400" />
                                )}
                              </button>
                              {expandedSections.has('areaClassification') && (
                                <div className="px-4 pb-4 pt-2">
                                  <ul className="space-y-2 ml-11">
                                    {generalZoning.areaClassification.split(/[,;]/).map((item, idx) => (
                                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                                        <span className="text-green-600 mt-1">•</span>
                                        <span className="leading-relaxed">{item.trim()}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Typical Plot Size */}
                          {generalZoning.typicalPlotSize && (
                            <div className="border-b border-gray-100 last:border-0">
                              <button
                                onClick={() => toggleSection('plotSize')}
                                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="p-1.5 bg-purple-100 rounded-md group-hover:bg-purple-200 transition-colors">
                                    <Maximize2 className="w-4 h-4 text-purple-600" />
                                  </div>
                                  <span className="font-medium text-gray-900 text-sm">Typical Plot Size</span>
                                </div>
                                {expandedSections.has('plotSize') ? (
                                  <ChevronUp className="w-5 h-5 text-gray-400" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-gray-400" />
                                )}
                              </button>
                              {expandedSections.has('plotSize') && (
                                <div className="px-4 pb-4 pt-2">
                                  <ul className="space-y-2 ml-11">
                                    {generalZoning.typicalPlotSize.split(/[;]/).map((item, idx) => (
                                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                                        <span className="text-purple-600 mt-1">•</span>
                                        <span className="leading-relaxed">{item.trim()}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* General Height Limit */}
                          {generalZoning.generalHeightLimit && (
                            <div className="border-b border-gray-100 last:border-0">
                              <button
                                onClick={() => toggleSection('heightLimit')}
                                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="p-1.5 bg-orange-100 rounded-md group-hover:bg-orange-200 transition-colors">
                                    <ArrowUpCircle className="w-4 h-4 text-orange-600" />
                                  </div>
                                  <span className="font-medium text-gray-900 text-sm">General Height Limit</span>
                                </div>
                                {expandedSections.has('heightLimit') ? (
                                  <ChevronUp className="w-5 h-5 text-gray-400" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-gray-400" />
                                )}
                              </button>
                              {expandedSections.has('heightLimit') && (
                                <div className="px-4 pb-4 pt-2">
                                  <ul className="space-y-2 ml-11">
                                    {generalZoning.generalHeightLimit.split(/[;]/).map((item, idx) => (
                                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                                        <span className="text-orange-600 mt-1">•</span>
                                        <span className="leading-relaxed">{item.trim()}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Building Style */}
                          {generalZoning.buildingStyle && (
                            <div className="border-b border-gray-100 last:border-0">
                              <button
                                onClick={() => toggleSection('buildingStyle')}
                                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="p-1.5 bg-pink-100 rounded-md group-hover:bg-pink-200 transition-colors">
                                    <Palette className="w-4 h-4 text-pink-600" />
                                  </div>
                                  <span className="font-medium text-gray-900 text-sm">Building Style</span>
                                </div>
                                {expandedSections.has('buildingStyle') ? (
                                  <ChevronUp className="w-5 h-5 text-gray-400" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-gray-400" />
                                )}
                              </button>
                              {expandedSections.has('buildingStyle') && (
                                <div className="px-4 pb-4 pt-2">
                                  <ul className="space-y-2 ml-11">
                                    {generalZoning.buildingStyle.split(/[;]/).map((item, idx) => (
                                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                                        <span className="text-pink-600 mt-1">•</span>
                                        <span className="leading-relaxed">{item.trim()}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Future Plans */}
                          {generalZoning.futurePlans && generalZoning.futurePlans.length > 0 && (
                            <div className="border-b border-gray-100 last:border-0">
                              <button
                                onClick={() => toggleSection('futurePlans')}
                                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="p-1.5 bg-blue-100 rounded-md group-hover:bg-blue-200 transition-colors">
                                    <TrendingUp className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <span className="font-medium text-gray-900 text-sm">Future Development Plans</span>
                                  <span className="text-xs text-gray-500">({generalZoning.futurePlans.length})</span>
                                </div>
                                {expandedSections.has('futurePlans') ? (
                                  <ChevronUp className="w-5 h-5 text-gray-400" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-gray-400" />
                                )}
                              </button>
                              {expandedSections.has('futurePlans') && (
                                <div className="px-4 pb-4 pt-2">
                                  <ul className="space-y-2.5 ml-11">
                                    {generalZoning.futurePlans.map((plan, idx) => (
                                      <li key={idx} className="flex items-start gap-2.5 text-sm text-gray-700">
                                        <span className="text-blue-500 mt-1">▸</span>
                                        <span className="leading-relaxed">{plan}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Key Points */}
                          {generalZoning.keyPoints && generalZoning.keyPoints.length > 0 && (
                            <div className="border-b border-gray-100 last:border-0">
                              <button
                                onClick={() => toggleSection('keyPoints')}
                                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="p-1.5 bg-amber-100 rounded-md group-hover:bg-amber-200 transition-colors">
                                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                                  </div>
                                  <span className="font-medium text-gray-900 text-sm">Important Considerations</span>
                                  <span className="text-xs text-gray-500">({generalZoning.keyPoints.length})</span>
                                </div>
                                {expandedSections.has('keyPoints') ? (
                                  <ChevronUp className="w-5 h-5 text-gray-400" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-gray-400" />
                                )}
                              </button>
                              {expandedSections.has('keyPoints') && (
                                <div className="px-4 pb-4 pt-2">
                                  <ul className="space-y-2.5 ml-11">
                                    {generalZoning.keyPoints.map((point, idx) => (
                                      <li key={idx} className="flex items-start gap-2.5 text-sm text-gray-700">
                                        <span className="text-amber-500 mt-1">▸</span>
                                        <span className="leading-relaxed">{point}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Additional Notes Footer */}
                        {generalZoning.additionalNotes && (
                          <div className="p-4 bg-blue-50/50 border-t border-blue-100">
                            <div className="flex items-start gap-2">
                              <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-gray-600 leading-relaxed italic">{generalZoning.additionalNotes}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                          {/* Area Classification - Empty */}
                          <div className="bg-white/60 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="p-1.5 bg-gray-100 rounded-md">
                                <Map className="w-4 h-4 text-gray-400" />
                              </div>
                              <div className="text-xs font-medium text-gray-500">Area Classification</div>
                            </div>
                            <div className="font-medium text-gray-400 text-sm">N/A</div>
                          </div>

                          {/* Typical Plot Size - Empty */}
                          <div className="bg-white/60 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="p-1.5 bg-gray-100 rounded-md">
                                <Maximize2 className="w-4 h-4 text-gray-400" />
                              </div>
                              <div className="text-xs font-medium text-gray-500">Typical Plot Size</div>
                            </div>
                            <div className="font-medium text-gray-400 text-sm">N/A</div>
                          </div>

                          {/* General Height Limit - Empty */}
                          <div className="bg-white/60 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="p-1.5 bg-gray-100 rounded-md">
                                <ArrowUpCircle className="w-4 h-4 text-gray-400" />
                              </div>
                              <div className="text-xs font-medium text-gray-500">General Height Limit</div>
                            </div>
                            <div className="font-medium text-gray-400 text-sm">N/A</div>
                          </div>

                          {/* Building Style - Empty */}
                          <div className="bg-white/60 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="p-1.5 bg-gray-100 rounded-md">
                                <Palette className="w-4 h-4 text-gray-400" />
                              </div>
                              <div className="text-xs font-medium text-gray-500">Building Style</div>
                            </div>
                            <div className="font-medium text-gray-400 text-sm">N/A</div>
                          </div>
                        </div>

                        <div className="mt-4 flex items-start gap-3 text-xs text-gray-600 bg-white/80 rounded-lg p-3 border border-gray-200">
                          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" />
                          <span>General zoning rules for this municipality are not yet available. Specific plot rules require verified coordinates.</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Generate AI Report Section (Locked) */}
              <div className="mt-6 md:mt-8 space-y-3">
                {/* Land Data for This Plot Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-gray-700" />
                      <h3 className="text-lg font-semibold text-gray-900">Land Data for This Plot</h3>
                    </div>
                    {!isAdmin && !strongPlot.realLatitude && !strongPlot.realLongitude && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full">
                        <Lock className="w-3.5 h-3.5" />
                        Location Required
                      </span>
                    )}
                  </div>
                  
                  {/* Warning banner - only show when real coordinates are empty and user is not admin */}
                  {!isAdmin && !strongPlot.realLatitude && !strongPlot.realLongitude && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 md:p-4">
                      <div className="flex items-start gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <span className="font-medium text-amber-800 text-sm md:text-base">Exact Location Not Verified</span>
                      </div>
                      <p className="text-xs md:text-sm text-amber-700 ml-6 mb-3">
                        The data below requires precise coordinates to be accurate. Without the real location, we cannot provide parcel-specific zoning, cadastre information, or building regulations.
                      </p>
                      <Button
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            window.dispatchEvent(
                              new CustomEvent('realtorOutreachRequested', { detail: { selectedPlotIds: [plotId] } })
                            );
                          }
                        }}
                        className="ml-6 bg-amber-600 hover:bg-amber-700 text-white text-xs md:text-sm"
                        size="sm"
                      >
                        <Mail className="w-4 h-4 mr-1 md:mr-2" />
                        <span className="hidden sm:inline">Ask Realtor to </span>Verify Location
                      </Button>
                    </div>
                  )}
                </div>

                <div className="relative bg-gray-50 rounded-xl border border-gray-200">
                  <div className="p-4 md:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 md:gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 md:mb-2">
                          <Sparkles className="w-5 h-5 text-gray-700" />
                          <h2 className="text-base md:text-lg font-semibold text-gray-900">
                            Generate AI Report
                          </h2>
                        </div>
                        <p className="text-xs md:text-sm text-gray-600">
                          {!isAdmin && !strongPlot.realLatitude && !strongPlot.realLongitude 
                            ? "Available after location verification"
                            : "Transform raw data into actionable insights with our AI-powered analysis"
                          }
                        </p>
                      </div>
                      <div className="flex items-center">
                        {!isAdmin && !strongPlot.realLatitude && !strongPlot.realLongitude ? (
                          <span className="inline-flex items-center gap-1.5 px-2 md:px-3 py-1.5 text-xs md:text-sm font-medium text-gray-500 bg-white border border-gray-200 rounded-lg">
                            <Lock className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Requires </span>Verified Location
                          </span>
                        ) : (
                          <Button
                            onClick={() => {
                              if (typeof window !== 'undefined') {
                                window.dispatchEvent(
                                  new CustomEvent('generateReportRequested', { detail: { plotId } })
                                );
                              }
                            }}
                            className="bg-black text-white hover:bg-gray-800 w-full sm:w-auto"
                            size="default"
                          >
                            <Sparkles className="w-4 h-4 mr-2" />
                            Generate Report
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Tab Content */}
          <div className="space-y-6">
            {/* Overview Tab Content */}
            {(standalone || activeTab === "overview") && (
              <PlotDetailsOverview 
                plot={strongPlot} 
                hasRealCoordinates={!!(strongPlot.realLatitude || strongPlot.realLongitude)}
                isAdmin={isAdmin}
              />
            )}

            {/* Progress Tab Content */}
            {activeTab === "progress" && (
              <PlotDetailsProgress plotId={plotId} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
