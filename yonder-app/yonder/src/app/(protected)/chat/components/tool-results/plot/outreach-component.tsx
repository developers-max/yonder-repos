'use client';
import { Button } from "@/app/_components/ui/button";
import { PlotStatusBadge } from "@/app/_components/ui/plot-status-badge";
import { Mail, CheckCircle, AlertCircle, Loader2, Check, ArrowLeft, ArrowRight, MapPin, Square } from "lucide-react";
import { trpc } from "@/trpc/client";
import { realtorOutreachTemplate, defaultSubject } from '@/app/api/smartlead/templates/realtor-outreach';
import { useState, useEffect, useCallback, useMemo } from "react";
import type { PlotFilters, EnrichmentData } from "@/server/trpc/router/plot/plots";
import type { InitiateOutreachResult } from "@/lib/ai/tools/initiate-outreach";
import { authClient } from "@/lib/auth/auth-client";
import type { AppRouter } from "@/server/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import Image from "next/image";
import { RealtorOutreachModal } from "../../plot/realtor-outreach-modal";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/app/_components/ui/dialog";


// Use TRPC's built-in type inference
type RouterOutputs = inferRouterOutputs<AppRouter>;
type SearchPlotsResult = RouterOutputs['plots']['searchPlots'];
type SearchPlotsWithOrgResult = RouterOutputs['plots']['searchPlotsWithOrganizationData'];
type PlotWithOrg = SearchPlotsWithOrgResult['plots'][number] & {
  id: string;
  latitude: number;
  longitude: number;
  price: number;
  size: number | null;
  images: string[] | null;
  distanceKm?: number | null;
  organizationPlotId?: string | null;
  organizationPlotStatus?: string | null;
  enrichmentData: EnrichmentData | null;
};

interface PlotSelectionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPlots: Set<string>;
  onPlotSelection: (plotId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onConfirm: () => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
  currentPagePlots: PlotWithOrg[];
  isLoading: boolean;
  maxSelectedPlots: number;
  isPending: boolean;
  error?: string | null;
  formatPrice: (price: number) => string;
  formatSize: (size: number) => string;
  totalCount: number;
}

function PlotSelectionDialog({
  isOpen,
  onOpenChange,
  selectedPlots,
  onPlotSelection,
  onSelectAll,
  onDeselectAll,
  onConfirm,
  currentPage,
  setCurrentPage,
  totalPages,
  currentPagePlots,
  isLoading,
  maxSelectedPlots,
  isPending,
  error,
  formatPrice,
  formatSize,
  totalCount
}: PlotSelectionDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] md:min-w-[800px] h-[90vh] max-w-none overflow-hidden flex flex-col p-4 md:p-6">
        <DialogHeader className="space-y-2 md:space-y-4">
          <DialogTitle className="text-lg md:text-xl">Select plots for your project</DialogTitle>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm">
            <DialogDescription className="text-xs md:text-sm">
              Choose up to {maxSelectedPlots} plots to add to your project
            </DialogDescription>
            <div className="font-medium text-xs md:text-sm">
              {selectedPlots.size} of {maxSelectedPlots} selected
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-3 md:space-y-6">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onSelectAll}
                disabled={selectedPlots.size >= maxSelectedPlots}
                className="text-xs md:text-sm"
              >
                Select page
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onDeselectAll}
                className="text-xs md:text-sm"
              >
                Clear page
              </Button>
            </div>

            <div className="text-xs md:text-sm text-muted-foreground">
              Page {currentPage} of {totalPages} • {totalCount} total
            </div>
          </div>

          {/* Plots Grid */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading plots...</p>
                </div>
              </div>
            ) : currentPagePlots.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-sm text-muted-foreground">No plots found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4 p-1 md:p-4">
                {currentPagePlots.map((plot: PlotWithOrg) => {
                  const isSelected = selectedPlots.has(plot.id);
                  const isInProject = plot.organizationPlotStatus && plot.organizationPlotStatus !== 'removed';
                  const canSelect = (selectedPlots.size < maxSelectedPlots || isSelected) && !isInProject;

                  return (
                    <div
                      key={plot.id}
                      className={`cursor-pointer shadow-md transition-all duration-200 rounded-xl overflow-hidden ${isSelected
                          ? 'ring-2 ring-blue-500 shadow-xl'
                          : canSelect
                            ? 'hover:shadow-xl hover:-translate-y-1'
                            : 'opacity-50 cursor-not-allowed'
                        }`}
                      onClick={() => canSelect && onPlotSelection(plot.id)}
                    >
                      {/* Plot Image */}
                      <div className="relative w-full h-28 md:h-40 bg-gray-100 overflow-hidden">
                        {isSelected && (
                          <div className="absolute top-2 right-2 z-10 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}

                        {/* Status indicator for plots already in project */}
                        {isInProject && (
                          <div className="absolute top-2 left-2 z-10">
                            <PlotStatusBadge 
                              status={plot.organizationPlotStatus || 'interested'} 
                              size="sm"
                              className="shadow-lg"
                            />
                          </div>
                        )}

                        {plot.images && plot.images.length > 0 ? (
                          <Image
                            src={plot.images[0]}
                            alt={`Plot ${plot.id.slice(0, 8)}`}
                            fill
                            unoptimized
                            className="object-cover"
                            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = target.parentElement!.querySelector('.no-image-fallback') as HTMLElement;
                              if (fallback) fallback.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`w-full h-full flex items-center justify-center text-gray-400 ${plot.images && plot.images.length > 0 ? 'hidden' : ''} no-image-fallback`}>
                          <MapPin className="w-8 h-8" />
                        </div>
                      </div>

                      {/* Plot Details */}
                      <div className="p-2 md:p-3 space-y-1 md:space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground">
                            <Square className="w-2.5 h-2.5 md:w-3 md:h-3" />
                            {plot.size && (
                              <span>{formatSize(plot.size)}</span>
                            )}
                          </div>
                        </div>

                        {plot.price && (
                          <div className="text-sm md:text-lg font-semibold text-gray-900">
                            {formatPrice(plot.price)}
                          </div>
                        )}

                        <div className="text-[10px] md:text-xs text-muted-foreground">
                          Plot {plot.id.slice(0, 8)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="space-y-3 md:space-y-4">
          {error && (
            <div className="w-full p-2 md:p-3 bg-red-50 text-red-700 rounded-lg text-xs md:text-sm">
              {error}
            </div>
          )}

          {/* Pagination - On top for mobile */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 w-full md:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>

              <span className="text-xs text-muted-foreground px-2">
                {currentPage} / {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between w-full gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="text-xs md:text-sm"
            >
              Cancel
            </Button>

            {/* Pagination - Centered (desktop only) */}
            {totalPages > 1 && (
              <div className="hidden md:flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>

                <span className="text-sm text-muted-foreground px-2">
                  {currentPage} / {totalPages}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            <Button
              onClick={onConfirm}
              disabled={selectedPlots.size === 0 || isPending}
              className="text-xs md:text-sm"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 animate-spin" />
                  <span className="hidden sm:inline">Adding...</span>
                  <span className="sm:hidden">...</span>
                </>
              ) : (
                <>
                  Add {selectedPlots.size} plot{selectedPlots.size !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface OutreachComponentProps {
  result?: InitiateOutreachResult;  // For tool-response variant
  searchFilters?: Partial<PlotFilters>;  // For panel variant
  variant?: 'panel' | 'tool-response';
  onSuccess?: (result: { newPlotsAdded: number; existingPlotsSkipped: number }) => void;
  onError?: (error: string) => void;
  isLoading?: boolean;  // For panel variant loading state
  plotsData?: SearchPlotsResult;  // For panel variant plot data
}

export function OutreachComponent({
  result,
  searchFilters,
  variant = 'panel',
  onSuccess,
  onError,
  isLoading,
  plotsData
}: OutreachComponentProps) {
  const [localSuccess, setLocalSuccess] = useState<{ newPlotsAdded: number; existingPlotsSkipped: number } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [autoTriggered, setAutoTriggered] = useState(false);

  // Dialog and selection state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPlots, setSelectedPlots] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const plotsPerPage = 25;
  const maxSelectedPlots = 10;

  // Get active organization and user data
  const { data: activeOrganization } = authClient.useActiveOrganization();
  //const { data: session } = authClient.useSession();
  const organizationId = activeOrganization?.id;

  // Realtor outreach modal state
  const [isOutreachModalOpen, setIsOutreachModalOpen] = useState(false);
  const [outreachPreviewData, setOutreachPreviewData] = useState<RouterOutputs['projects']['realtorOutreach'] | null>(null);
  const [emailSubject, setEmailSubject] = useState(defaultSubject);
  const [emailBody, setEmailBody] = useState(realtorOutreachTemplate);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  //const [userEmail, setUserEmail] = useState(session?.user?.email || '');

  // Memoize filters to prevent useCallback dependency changes
  const filters = useMemo(() => {
    return variant === 'tool-response' ? (result?.data?.filters || {}) : (searchFilters || {});
  }, [variant, result?.data?.filters, searchFilters]);

  // Get paginated plots with organization data for the dialog
  const cleanedFilters = useMemo(() => 
    Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== null && value !== undefined)
    ), 
    [filters]
  );

  const { data: dialogPlotsData, isLoading: isLoadingDialog } = trpc.plots.searchPlotsWithOrganizationData.useQuery({
    ...cleanedFilters,
    limit: plotsPerPage,
    page: currentPage,
    organizationId: organizationId!, // Include organization ID to get plot status
  }, {
    enabled: !!organizationId && isDialogOpen // Only enable when dialog is open and organizationId exists
  });

  const utils = trpc.useUtils();
  const initiateOutreachMutation = trpc.projects.initiateOutreach.useMutation({
    onSuccess: () => {
      // Invalidate organization queries to refresh the project content
      if (organizationId) {
        utils.projects.getOrganizationProject.invalidate({ organizationId });
      }
    },
  });

  // Realtor outreach mutation for preview (dry run)
  const realtorOutreachPreviewMutation = trpc.projects.realtorOutreach.useMutation();

  // Use plotsData for display counts, dialogPlotsData for dialog content
  const totalPlotsFound = variant === 'panel' ? (plotsData?.pagination?.totalCount ?? 0) : (result?.data?.filters ? 0 : 0);
  const currentIsLoading = variant === 'panel' ? (isLoading ?? false) : isLoadingDialog || initiateOutreachMutation.isPending;

  // Dialog-specific data
  const currentPagePlots: PlotWithOrg[] = useMemo(() => {
    return (dialogPlotsData?.plots as PlotWithOrg[]) ?? [];
  }, [dialogPlotsData?.plots]);
  const totalPages = Math.ceil((dialogPlotsData?.pagination?.totalCount ?? 0) / plotsPerPage);

  const handleOpenDialog = useCallback(() => {
    if (!organizationId) {
      setLocalError('No active project selected. Please select a project first.');
      return;
    }

    // Only check for available plots in panel variant
    if (variant === 'panel') {
      const availablePlots = plotsData?.plots;
      if (!availablePlots || availablePlots.length === 0) {
        setLocalError('No plots found matching your search criteria.');
        return;
      }
    }

    setIsDialogOpen(true);
    setSelectedPlots(new Set());
    setCurrentPage(1);
    setLocalError(null);
  }, [organizationId, plotsData?.plots, variant]);

  const handlePlotSelection = useCallback((plotId: string) => {
    setSelectedPlots(prev => {
      const newSet = new Set(prev);
      if (newSet.has(plotId)) {
        newSet.delete(plotId);
      } else if (newSet.size < maxSelectedPlots) {
        newSet.add(plotId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedPlots(prev => {
      const newSet = new Set(prev);
      for (const plot of currentPagePlots) {
        if (newSet.size >= maxSelectedPlots) break;
        newSet.add(plot.id);
      }
      return newSet;
    });
  }, [currentPagePlots]);

  const handleDeselectAll = useCallback(() => {
    setSelectedPlots(prev => {
      const newSet = new Set(prev);
      for (const plot of currentPagePlots) {
        newSet.delete(plot.id);
      }
      return newSet;
    });
  }, [currentPagePlots]);

  const handleOpenRealtorOutreach = useCallback(async (plotIds: string[]) => {
    if (!organizationId) {
      setLocalError('No active project selected.');
      return;
    }

    try {
      // Call realtor outreach endpoint with dryRun=true for preview
      const previewData = await realtorOutreachPreviewMutation.mutateAsync({
        organizationId,
        plotIds,
        emailSubject,
        emailBody,
        dryRun: true,
      });

      setOutreachPreviewData(previewData);
      
      // Initialize row selection for plots with available contacts
      const initialSelection: Record<string, boolean> = {};
      previewData.results.forEach(r => {
        if (r.realtorEmail || (r.suggestedRealtors && r.suggestedRealtors.length > 0)) {
          initialSelection[r.plotId] = true;
        }
      });
      setRowSelection(initialSelection);
      
      setIsOutreachModalOpen(true);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to load realtor contacts.';
      setLocalError(errorMsg);
    }
  }, [organizationId, emailSubject, emailBody, realtorOutreachPreviewMutation]);

  // Query to check if there are plots already in the project
  const { data: existingProjectPlots, isLoading: isLoadingProjectPlots } = trpc.projects.getOrganizationPlots.useQuery(
    { organizationId: organizationId! },
    { enabled: !!organizationId && variant === 'tool-response' }
  );

  // Handler to open outreach modal for existing plots in project
  const handleDirectOutreach = useCallback(async () => {
    if (!organizationId) {
      setLocalError('No active project selected. Please select a project first.');
      return;
    }

    setLocalError(null);

    try {
      // Check if there are plots in the project
      if (!existingProjectPlots || existingProjectPlots.length === 0) {
        setLocalError('No plots in your project yet. Please add plots first.');
        return;
      }

      // Get plot IDs from existing project plots
      const plotIds = existingProjectPlots.map(p => p.plotId);

      // Open the realtor outreach modal with existing plots
      await handleOpenRealtorOutreach(plotIds);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to initiate outreach.';
      setLocalError(errorMsg);
    }
  }, [organizationId, existingProjectPlots, handleOpenRealtorOutreach]);

  const handleInitiateOutreach = useCallback(async () => {
    if (selectedPlots.size === 0) {
      setLocalError('Please select at least one plot.');
      return;
    }

    setLocalSuccess(null);
    setLocalError(null);

    try {
      const plotIds = Array.from(selectedPlots);
      const result = await initiateOutreachMutation.mutateAsync({
        plotIds,
        organizationId: organizationId!,
        searchFilters: filters,
      });
      setLocalSuccess(result);
      setIsDialogOpen(false);
      
      // Invalidate the organization plots query to update the button
      await utils.projects.getOrganizationPlots.invalidate({ organizationId: organizationId! });
      
      onSuccess?.(result);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to initiate outreach. Please try again.';
      setLocalError(errorMsg);
      onError?.(errorMsg);
    }
  }, [selectedPlots, initiateOutreachMutation, organizationId, onSuccess, onError, filters, utils]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatSize = (size: number) => {
    if (size >= 1) {
      return `${size.toFixed(1)} acres`;
    } else {
      return `${(size * 43560).toFixed(0)} sq ft`;
    }
  };

  // Auto-switch to project tab for tool-response variant
  useEffect(() => {
    if (variant === 'tool-response' &&
      !autoTriggered &&
      result?.data?.filters &&
      organizationId) {
      setAutoTriggered(true);
      // Dispatch event to switch to project tab
      window.dispatchEvent(new CustomEvent('switchToProjectTab'));
    }
  }, [variant, autoTriggered, result?.data?.filters, organizationId]);

  // Handle tool result errors for tool-response variant
  if (variant === 'tool-response' && result?.error) {
    return (
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl mt-3 overflow-hidden">
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Outreach Setup Failed</h3>
              <p className="text-xs text-gray-500 mt-0.5">{String(result.error.details)}</p>
            </div>
          </div>

          {result.suggestions && result.suggestions.length > 0 && (
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-700 mb-2">Suggestions:</p>
              <ul className="text-xs text-gray-600 space-y-1">
                {result.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="w-1 h-1 bg-gray-400 rounded-full mt-2 flex-shrink-0"></span>
                    {String(suggestion.action)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'tool-response') {
    return (
      <>
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl mt-3 overflow-hidden">
          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Mail className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Initiate Outreach</h3>
                <p className="text-xs text-gray-500 mt-0.5">Setting up realtor outreach</p>
              </div>
            </div>

            {/* Show search criteria */}
            {result?.data?.summary && (
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 mb-4">
                <p className="text-xs font-medium text-gray-700 mb-1">Search Criteria:</p>
                <p className="text-xs text-gray-600">{result.data.summary}</p>
              </div>
            )}

            {/* Default state - show appropriate button based on whether plots exist */}
            {!isLoadingProjectPlots && !initiateOutreachMutation.isPending && !realtorOutreachPreviewMutation.isPending && !localError && (
              <div className="flex justify-center">
                {existingProjectPlots && existingProjectPlots.length > 0 ? (
                  <Button
                    onClick={handleDirectOutreach}
                    disabled={!organizationId}
                    className="w-full"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Open Realtor Outreach ({existingProjectPlots.length} plot{existingProjectPlots.length !== 1 ? 's' : ''})
                  </Button>
                ) : (
                  <Button
                    onClick={handleOpenDialog}
                    disabled={!organizationId}
                    className="w-full"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Select Plots First
                  </Button>
                )}
              </div>
            )}

            {/* Loading States */}
            {(isLoadingProjectPlots || initiateOutreachMutation.isPending || realtorOutreachPreviewMutation.isPending) && (
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 space-y-3">
                <p className="text-sm text-gray-700">
                  {isLoadingProjectPlots ? 'Checking your project...' : 
                   initiateOutreachMutation.isPending ? 'Adding plots to your project...' : 
                   'Loading realtor contacts...'}
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
              </div>
            )}


            {/* Error State */}
            {localError && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4" />
                  {localError}
                </div>
              </div>
            )}

            {/* Success State */}
            {localSuccess && (
              <div className="bg-green-50 border border-green-100 rounded-lg p-4 space-y-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full transition-all duration-500" style={{ width: '100%' }}></div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle className="w-4 h-4" />
                    ✓ {localSuccess.newPlotsAdded} new plots added to your project!
                    {localSuccess.existingPlotsSkipped > 0 &&
                      ` (${localSuccess.existingPlotsSkipped} were already in your project)`
                    }
                  </div>
                  <p className="text-xs text-green-600">
                    Click &ldquo;Open Realtor Outreach&rdquo; above to contact realtors for your plots.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        

        <PlotSelectionDialog
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          selectedPlots={selectedPlots}
          onPlotSelection={handlePlotSelection}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onConfirm={handleInitiateOutreach}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          totalPages={totalPages}
          currentPagePlots={currentPagePlots}
          isLoading={isLoadingDialog}
          maxSelectedPlots={maxSelectedPlots}
          isPending={initiateOutreachMutation.isPending}
          error={localError}
          formatPrice={formatPrice}
          formatSize={formatSize}
          totalCount={dialogPlotsData?.pagination?.totalCount ?? 0}
        />

        <RealtorOutreachModal
          open={isOutreachModalOpen}
          onOpenChange={setIsOutreachModalOpen}
          previewData={outreachPreviewData}
          selectedCount={Object.values(rowSelection).filter(Boolean).length}
          selectableCount={outreachPreviewData?.results.filter(r => r.realtorEmail || (r.suggestedRealtors && r.suggestedRealtors.length > 0)).length ?? 0}
          emailSubject={emailSubject}
          onEmailSubjectChange={setEmailSubject}
          emailBody={emailBody}
          onEmailBodyChange={setEmailBody}
          rowSelection={rowSelection}
          onToggleAll={(checked) => {
            const newSelection: Record<string, boolean> = {};
            outreachPreviewData?.results.forEach(r => {
              if (r.realtorEmail || (r.suggestedRealtors && r.suggestedRealtors.length > 0)) {
                newSelection[r.plotId] = checked;
              }
            });
            setRowSelection(newSelection);
          }}
          onRowToggle={(plotId, checked) => {
            setRowSelection(prev => ({ ...prev, [plotId]: checked }));
          }}
          organizationId={organizationId!}
        />
      </>
    );
  }

  // Panel variant (original functionality)
  return (
    <>
      <div className="px-3 md:px-6 py-2 md:py-3 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs md:text-sm font-medium text-foreground">
              {currentIsLoading ? (
                'Finding plots...'
              ) : totalPlotsFound === 0 ? (
                'No plots found'
              ) : (
                `${totalPlotsFound} plot${totalPlotsFound !== 1 ? 's' : ''} found`
              )}
            </p>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">
              {currentIsLoading ? (
                'Loading...'
              ) : totalPlotsFound === 0 ? (
                'Adjust filters'
              ) : (
                <span className="hidden sm:inline">Select plots to add to your project for outreach</span>
              )}
              {!currentIsLoading && totalPlotsFound > 0 && (
                <span className="sm:hidden">Select plots for outreach</span>
              )}
            </p>
          </div>
          <Button
            onClick={handleOpenDialog}
            disabled={currentIsLoading || totalPlotsFound === 0 || !organizationId}
            size="sm"
            className="shrink-0 text-xs md:text-sm h-8 md:h-9 px-2 md:px-4"
          >
            <Mail className="w-3 h-3 md:w-4 md:h-4 mr-1" />
            <span className="hidden sm:inline">{currentIsLoading ? 'Loading...' : totalPlotsFound === 0 ? 'No Plots' : 'Select Plots'}</span>
            <span className="sm:hidden">{currentIsLoading ? '...' : 'Select'}</span>
          </Button>
        </div>

        {/* Success/Error Messages */}
        {localError && (
          <p className="text-xs md:text-sm text-destructive mt-1.5 md:mt-2">
            {localError}
          </p>
        )}
        {localSuccess && (
          <p className="text-xs md:text-sm text-green-600 mt-1.5 md:mt-2">
            ✓ {localSuccess.newPlotsAdded} new plots added!
            {localSuccess.existingPlotsSkipped > 0 &&
              <span className="hidden sm:inline"> ({localSuccess.existingPlotsSkipped} already in project)</span>
            }
          </p>
        )}
      </div>

            <PlotSelectionDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        selectedPlots={selectedPlots}
        onPlotSelection={handlePlotSelection}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onConfirm={handleInitiateOutreach}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        totalPages={totalPages}
        currentPagePlots={currentPagePlots}
        isLoading={isLoadingDialog}
        maxSelectedPlots={maxSelectedPlots}
        isPending={initiateOutreachMutation.isPending}
        error={localError}
        formatPrice={formatPrice}
        formatSize={formatSize}
        totalCount={dialogPlotsData?.pagination?.totalCount ?? 0}
      />
    </>
  );
} 