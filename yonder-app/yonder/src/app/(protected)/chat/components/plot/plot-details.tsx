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
  MapPin,
  Sparkles,
  Mail,
  User,
  Plus,
  Minus,
} from 'lucide-react';
import PlotDetailsOverview from './plot-details-overview';
import PlotDetailsProgress from './plot-details-progress';
import { authClient } from '@/lib/auth/auth-client';

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
  const [landDataLocked, setLandDataLocked] = useState(true);
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
              {/* Plot Information Title */}
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900">Plot Information</h2>
              </div>

              {/* Hero Section with Address, Image, Price & Realtor in a single column */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden p-4 md:p-6 space-y-4 md:space-y-6">
                {/* Address with Action Buttons - Stack on mobile */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-3 mb-1 md:mb-2">
                      <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
                        {addressLoading ? "Loading address..." : (shortAddress || "Plot Information")}
                      </h1>
                      {strongPlot.type ? (
                        <span className="inline-flex items-center self-start sm:self-auto px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {strongPlot.type.replace(/_/g, ' ')}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm md:text-base text-gray-600">
                      {plot.size ? `${plot.size.toLocaleString()}m²` : 'Size N/A'} - Starting at €{plot.price ? plot.price.toLocaleString() : 'N/A'}
                    </p>
                    
                  </div>
                  {!isPlotAlreadyAdded ? (
                    <Button
                      onClick={handleAddPlot}
                      disabled={addPlotMutation.isPending || !organizationId}
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add to Project
                    </Button>
                  ) : (
                    <Button
                      onClick={handleRemovePlot}
                      disabled={removePlotMutation.isPending || !organizationId}
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Minus className="w-4 h-4 mr-2" />
                      Remove from Project
                    </Button>
                  )}
                </div>

                {/* Image Carousel */}
                <div>
                  <div className="rounded-2xl overflow-hidden border border-gray-200">
                    <ImageCarousel images={strongPlot.images || []} alt="Plot image" />
                  </div>
                </div>

                {/* Details Section - Address, Price, and Time on Market */}
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Left: Address and Price - 75% width */}
                  <div className="border border-gray-200 rounded-xl p-4 space-y-2 md:w-3/4">
                    {/* Full Address */}
                    {!addressLoading && fullAddress && (
                      <div className="flex items-start gap-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{fullAddress}</span>
                      </div>
                    )}
                    
                    {/* Price per m² and Coordinates */}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                      {plot.price && plot.size && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">€{Math.round(plot.price / plot.size).toLocaleString()}/m²</span>
                        </div>
                      )}
                      {strongPlot.latitude && strongPlot.longitude && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <span>{strongPlot.latitude.toFixed(6)}, {strongPlot.longitude.toFixed(6)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Time on Market - 25% width */}
                  {strongPlot.timeInMarket !== null && strongPlot.timeInMarket !== undefined && (
                    <div className="border border-gray-200 rounded-xl p-4 md:w-1/4 flex flex-col justify-center">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Time on Market</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {strongPlot.timeInMarket} {strongPlot.timeInMarket === 1 ? 'day' : 'days'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Description and Contact Realtor Row */}
                {(() => {
                  const realtors = ((strongPlot as unknown) as { realtors?: Array<{company_name: string; contact_name: string; email: string | null; telephone: string | null; role: string}> }).realtors ?? [];
                  const filteredRealtors = realtors.filter(r => (r.role === 'agency' || r.role === 'source') && r.email);
                  const uniqueCompanies = new Map();
                  filteredRealtors.forEach(realtor => {
                    const companyKey = realtor.company_name || realtor.contact_name;
                    if (!uniqueCompanies.has(companyKey)) {
                      uniqueCompanies.set(companyKey, realtor);
                    }
                  });
                  const uniqueRealtors = Array.from(uniqueCompanies.values()) as typeof filteredRealtors;
                  const agencies = uniqueRealtors.filter(r => r.role === 'agency');
                  const sources = uniqueRealtors.filter(r => r.role === 'source');
                  const firstRealtor = (agencies.length > 0 ? agencies[0] : sources[0]) ?? null;

                  if (!strongPlot.description && !firstRealtor) return null;

                  return (
                    <div className="flex flex-col md:flex-row gap-4">
                      {/* Description Section - 75% width */}
                      {strongPlot.description && (
                        <div className="border border-gray-200 rounded-xl p-4 md:w-3/4">
                          <div className="text-sm text-gray-700 max-h-32 overflow-y-auto pr-2 leading-relaxed">
                            {String(strongPlot.description)}
                          </div>
                        </div>
                      )}

                      {firstRealtor && (
                        <div className="border border-gray-200 rounded-xl p-4 md:w-1/4">
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contact Realtor</div>
                          <div className="space-y-3 text-sm text-gray-900">
                            <div className="font-semibold flex flex-wrap items-center gap-2">
                              <User className="w-4 h-4 text-gray-500" />
                              <span>{firstRealtor.contact_name}</span>
                              {firstRealtor.company_name && (
                                <span className="text-gray-500">· {firstRealtor.company_name}</span>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
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
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Generate AI Report Section (Locked) */}
              <div className="mt-6 md:mt-8 space-y-3">
                <div className="flex justify-center gap-3">
                  {isAdmin && (
                    <Button 
                      onClick={() => setLandDataLocked(!landDataLocked)}
                      variant="outline"
                      size="sm"
                    >
                      {landDataLocked ? 'Unlock (Testing)' : 'Lock (Testing)'}
                    </Button>
                  )}
                  <Button className="bg-black text-white hover:bg-gray-800">
                    Upgrade to Unlock Land Data and Actionable Insights
                  </Button>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Land Data for This Report</h3>
                <div className="relative bg-gray-50 rounded-xl border border-gray-200">
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-5 h-5 text-gray-700" />
                          <h2 className="text-lg font-semibold text-gray-900">
                            Generate AI Report
                          </h2>
                        </div>
                        <p className="text-sm text-gray-600">
                          Transform raw data into actionable insights with our AI-powered analysis
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => {
                            if (typeof window !== 'undefined') {
                              window.dispatchEvent(
                                new CustomEvent('generateReportRequested', { detail: { plotId } })
                              );
                            }
                          }}
                          className="bg-black text-white hover:bg-gray-800"
                          size="default"
                          disabled={landDataLocked}
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Report
                        </Button>
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
              <PlotDetailsOverview plot={strongPlot} landDataLocked={landDataLocked} />
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
