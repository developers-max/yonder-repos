'use client';

import { trpc } from '@/trpc/client';
import { PlotStatusBadge } from '@/app/_components/ui/plot-status-badge';
import { Button } from '@/app/_components/ui/button';
import { Card, CardContent } from '@/app/_components/ui/card';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/app/_components/ui/dropdown-menu';
import { realtorOutreachTemplate, defaultSubject } from '@/app/api/smartlead/templates/realtor-outreach';
import { 
  Star,
  Loader2,
  MapPin,
  Square,
  ArrowRight
} from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { authClient } from '@/lib/auth/auth-client';
import { useToast } from '@/app/_components/ui/toast-provider';
import PlotActionMenu from '../plot/plot-action-menu';
import { RealtorOutreachModal } from '../plot/realtor-outreach-modal';
import type { AppRouter } from '@/server/trpc';
import type { inferRouterOutputs } from '@trpc/server';

interface ProjectContentProps {
  onPlotClick?: (plotId: string) => void;
}

export default function ProjectContent({ onPlotClick }: ProjectContentProps) {
  // Get active organization and user data
  const { data: activeOrganization } = authClient.useActiveOrganization();
  //const { data: session } = authClient.useSession();
  const organizationId = activeOrganization?.id;

  // Get organization project data
  const { data: projectData, isLoading: isProjectLoading, error: projectError } = trpc.projects.getOrganizationProject.useQuery({ 
    organizationId: organizationId || ""
  }, {
    enabled: !!organizationId
  });

  // Get organization plots
  const { data: projectPlots, isLoading: isPlotsLoading, error: plotsError } = trpc.projects.getOrganizationPlots.useQuery({ 
    organizationId: organizationId || ""
  }, {
    enabled: !!organizationId
  });

  // Invalidate and refresh on external refresh event
  const utils = trpc.useUtils();
  useEffect(() => {
    const handler = () => {
      if (!organizationId) return;
      utils.projects.getOrganizationProject.invalidate({ organizationId });
      utils.projects.getOrganizationPlots.invalidate({ organizationId });
    };
    window.addEventListener('refreshProjectData', handler);
    return () => window.removeEventListener('refreshProjectData', handler);
  }, [organizationId, utils]);

  // Removed unused initiateOutreachMutation to satisfy ESLint no-unused-vars

  // Reusable toast API (placed before mutations to avoid use-before-define warnings)
  const { info, error: errorToast, dismiss } = useToast();

  // Realtor outreach preview mutation (dry run)
  const realtorOutreachPreview = trpc.projects.realtorOutreach.useMutation();

  // Remove plots from project mutation
  const removePlotsMutation = trpc.projects.removePlotsFromOrganization.useMutation({
    onSuccess: (data) => {
      info(`Successfully removed ${data.removedCount} plot${data.removedCount !== 1 ? 's' : ''} from project`);
      // Invalidate queries to refresh the UI
      if (organizationId) {
        utils.projects.getOrganizationPlots.invalidate({ organizationId });
        utils.projects.getOrganizationProject.invalidate({ organizationId });
      }
      // Clear selection after removal
      setSelectedPlots([]);
    },
    onError: (error) => {
      errorToast(error.message || 'Failed to remove plots from project');
    }
  });

  // Types for realtor outreach results
  type RouterOutputs = inferRouterOutputs<AppRouter>;
  type RealtorOutreachResult = RouterOutputs['projects']['realtorOutreach'];
  type OrgPlot = RouterOutputs['projects']['getOrganizationPlots'][number];

  // Type guard for left-joined plot detail fields
  const hasPlotDetails = (p: OrgPlot | undefined | null): p is OrgPlot & {
    plotPrice: string | null;
    plotSize: string | null;
    plotLatitude: number | null;
    plotLongitude: number | null;
    plotImages: unknown;
  } => !!p &&
    typeof p === 'object' &&
    'plotPrice' in p &&
    'plotSize' in p &&
    'plotLatitude' in p &&
    'plotLongitude' in p &&
    'plotImages' in p;

  // Realtor outreach dialog state
  const [isRealtorDialogOpen, setIsRealtorDialogOpen] = useState(false);
  const [realtorPreviewData, setRealtorPreviewData] = useState<RealtorOutreachResult | null>(null);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({}); // plotId -> selected
  const [emailSubject, setEmailSubject] = useState(defaultSubject);
  const [emailBody, setEmailBody] = useState(realtorOutreachTemplate);
 // const [userEmail, setUserEmail] = useState(session?.user?.email || '');

  const selectableCount = useMemo(() => (realtorPreviewData?.results || []).filter(r => !!r.realtorEmail).length, [realtorPreviewData]);
  const selectedCount = useMemo(() => Object.values(rowSelection).filter(Boolean).length, [rowSelection]);

  const openRealtorDialogWith = useCallback((data: RealtorOutreachResult) => {
    setRealtorPreviewData(data);
    // Preselect rows with available email and not already sent
    const initial: Record<string, boolean> = {};
    for (const r of data.results) {
      if (r.realtorEmail && !r.sent) initial[r.plotId] = true;
    }
    setRowSelection(initial);
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')).replace(/\/$/, '');
    if (data.results.length === 1) {
      // Format URL to avoid spam filters - replace https:// with https[colon]// and add spaces
      const url = `${baseUrl}/plot/${data.results[0].plotId}`;
      const formattedUrl = url.replace(/https?:\/\//g, (match) => match.replace(':', '[colon]'));
      setEmailBody(realtorOutreachTemplate.replace('{{plot_url}}', formattedUrl));
    } else {
      setEmailBody(realtorOutreachTemplate);
    }
    setIsRealtorDialogOpen(true);
  }, []);

  // Listen for global 'realtorOutreachRequested' to preview contacts (dry run)
  useEffect(() => {
    const handler = async (event: Event) => {
      const { detail } = event as CustomEvent<{ selectedPlotIds?: string[] }>;
      const plotIds = detail?.selectedPlotIds ?? [];
      if (!organizationId || plotIds.length === 0) return;

      const inProgress = info(`Fetching realtor contacts for ${plotIds.length} selected plot${plotIds.length !== 1 ? 's' : ''}...`, { duration: 0 });
      try {
        const preview = await realtorOutreachPreview.mutateAsync({
          organizationId,
          plotIds,
          dryRun: true,
        });
        dismiss(inProgress.id);
        openRealtorDialogWith(preview);
      } catch (err) {
        console.error('Failed to preview realtor contacts:', err);
        dismiss(inProgress.id);
        errorToast('Failed to fetch realtor contacts. Please try again.');
      }
    };
    window.addEventListener('realtorOutreachRequested', handler as EventListener);
    return () => window.removeEventListener('realtorOutreachRequested', handler as EventListener);
  }, [organizationId, realtorOutreachPreview, info, dismiss, errorToast, openRealtorDialogWith]);

  // Listen for global 'generateReportRequested' to generate plot report
  useEffect(() => {
    const handler = async (event: Event) => {
      const { detail } = event as CustomEvent<{ plotId?: string }>;
      const plotId = detail?.plotId;
      if (!plotId) return;

      const statusToast = info('Generating plot report...', { duration: 0 });
      
      try {
        // Download through backend proxy - it handles everything (check DB, generate if needed, stream)
        console.log('[project-content] Downloading PDF through backend proxy');
        const pdfResponse = await fetch(`/api/plot-report-pdf/${plotId}`);
        
        console.log('[project-content] PDF response status:', pdfResponse.status);
        if (!pdfResponse.ok) {
          if (pdfResponse.status === 404) {
            throw new Error('Plot not found.');
          }
          throw new Error(`Failed to download PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
        }

        // Update toast
        dismiss(statusToast.id);
        const downloadToast = info('Downloading PDF...', { duration: 0 });

        const pdfBlob = await pdfResponse.blob();
        
        // Create a blob URL for the PDF
        const blobUrl = window.URL.createObjectURL(pdfBlob);
        
        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = blobUrl;
        downloadLink.download = `plot-report-${plotId.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Clean up the blob URL after a delay
        setTimeout(() => {
          window.URL.revokeObjectURL(blobUrl);
        }, 1000);
        
        // Dismiss loading toasts
        dismiss(statusToast.id);
        dismiss(downloadToast.id);

        // Show success message
        info(`Report downloaded as PDF!`, { duration: 5000 });
      } catch (err) {
        console.error('Failed to fetch report:', err);
        dismiss(statusToast.id);
        errorToast('Failed to fetch report. Please try again.');
      }
    };
    window.addEventListener('generateReportRequested', handler as EventListener);
    return () => window.removeEventListener('generateReportRequested', handler as EventListener);
  }, [info, dismiss, errorToast]);

  // Toggle all selection in the modal table
  const handleToggleAll = useCallback((checked: boolean) => {
    const next: Record<string, boolean> = {};
    if (checked) {
      for (const r of realtorPreviewData?.results || []) {
        if (r.realtorEmail) next[r.plotId] = true;
      }
    }
    setRowSelection(next);
  }, [realtorPreviewData]);

  // Sending handled inside RealtorOutreachModal via SmartLead API

  const isLoading = isProjectLoading || isPlotsLoading;
  const loadError = projectError || plotsError;

  const [selectedPlots, setSelectedPlots] = useState<string[]>([]);

  // Read organization metadata safely (no any)
  const rawMeta: unknown = projectData?.metadata ?? null;
  const getMetaString = (key: string): string | null => {
    if (rawMeta && typeof rawMeta === 'object') {
      const v = (rawMeta as Record<string, unknown>)[key];
      return typeof v === 'string' ? v : null;
    }
    return null;
  };
  const projectDescription = getMetaString('description');
  const projectType = getMetaString('type');
  const projectWebsite = getMetaString('website');
  const projectImageCached = getMetaString('imageUrl');

  // Project image state/effect must be before any early returns
  const [projectImageUrl, setProjectImageUrl] = useState<string | null>(null);
  const [projectImageLoading, setProjectImageLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (projectImageCached) {
        setProjectImageUrl(projectImageCached);
        setProjectImageLoading(false);
        return;
      }
      if (!projectWebsite) {
        setProjectImageUrl(null);
        return;
      }
      setProjectImageLoading(true);
      try {
        const resp = await fetch('/api/project-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: projectWebsite, type: projectType ?? undefined, name: activeOrganization?.name || undefined, description: projectDescription || undefined }),
        });
        const data = await resp.json().catch(() => ({} as { url?: unknown }));
        if (!cancelled) setProjectImageUrl(typeof (data as { url?: unknown }).url === 'string' ? (data as { url?: string }).url! : null);
      } catch {
        if (!cancelled) setProjectImageUrl(null);
      } finally {
        if (!cancelled) setProjectImageLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [projectWebsite, projectType, projectImageCached, activeOrganization?.name, projectDescription]);

  // Helper to safely coerce unknown/nullable images into string[]
  const toStringArray = (val: unknown): string[] =>
    Array.isArray(val) ? (val.filter((x): x is string => typeof x === 'string')) : [];

  if (!organizationId) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Star className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-2">No Project Selected</h3>
          <p className="text-sm text-muted-foreground">
            Please select a project from the dropdown above
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <p className="text-sm text-destructive">Failed to load project: {loadError.message}</p>
        </div>
      </div>
    );
  }

  if (!projectData) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Star className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-2">No Project Data</h3>
          <p className="text-sm text-muted-foreground">
            This project doesn&apos;t have any data yet
          </p>
        </div>
      </div>
    );
  }

  const allPlotIds = projectPlots?.map(pp => pp.plotId) ?? [];
  const allSelected = allPlotIds.length > 0 && selectedPlots.length === allPlotIds.length;
  const toggleSelectAll = () => {
    setSelectedPlots(allSelected ? [] : allPlotIds);
  };

  return (
    <>
      <div className="space-y-4 md:space-y-6">
      {/* Project Header */}

      {/* Project Info */}
      <div className="space-y-3">
        <h2 className="text-lg md:text-xl font-semibold text-foreground">
          {projectData.name || activeOrganization?.name || '—'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {/* Left column: Project Image */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-2">Project Image</div>
            {projectImageUrl ? (
              <div className="mt-2 relative w-full h-48 rounded-md overflow-hidden border">
                <Image
                  src={projectImageUrl}
                  alt="Project image"
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground">
                {projectWebsite
                  ? projectImageLoading
                    ? 'Generating image…'
                    : 'No image found'
                  : 'Add a website to your project to generate an image.'}
              </div>
            )}
          </div>

          {/* Right column: Project details */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Project Type</div>
              <div className="font-semibold">{projectType || '—'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Description</div>
              <div className="text-sm">{projectDescription || '—'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Website</div>
              <div className="text-sm break-words">
                {projectWebsite ? (
                  <a
                    href={projectWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    {projectWebsite}
                  </a>
                ) : (
                  '—'
                )}
              </div>
            </div>
            <div>
              <Button disabled variant="outline" className="mt-1">
                Add documents
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Project Status */}
      <div className="space-y-2 md:space-y-3">
        <h3 className="font-medium text-foreground">Project Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Status</div>
            <div className="font-semibold">{projectData.status || 'Active'}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Selected Plot</div>
            <div className="font-semibold">{projectData.selectedPlotId ? 'Yes' : 'None'}</div>
          </div>
        </div>
      </div>

      {/* Plot Summary */}
      <div className="space-y-3">
        <h3 className="font-medium text-foreground">Plot Summary</h3>
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Total Plots</div>
              <div className="font-semibold">{projectPlots?.length || 0}</div>
            </div>
            <Button
              onClick={() => {
                if (typeof window !== 'undefined' && projectPlots && projectPlots.length > 0) {
                  const allPlotIds = projectPlots.map(pp => pp.plotId);
                  window.dispatchEvent(new CustomEvent('realtorOutreachRequested', { 
                    detail: { selectedPlotIds: allPlotIds } 
                  }));
                }
              }}
              disabled={!projectPlots || projectPlots.length === 0}
              variant="outline"
              size="sm"
            >
              Realtor Outreach
            </Button>
          </div>
        </div>
      </div>

      {/* Selected Plot Section */}
      {projectData.selectedPlotId && projectPlots && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <h3 className="font-medium text-foreground">Selected Plot</h3>
          </div>
          {(() => {
            const selectedPlot = projectPlots.find(pp => pp.plotId === projectData.selectedPlotId);
            if (!selectedPlot) return null;
            const selectedImages = hasPlotDetails(selectedPlot)
              ? toStringArray(selectedPlot.plotImages)
              : [];
            
            return (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-3 md:p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                    {/* Image */}
                    <div className="aspect-square rounded-lg overflow-hidden">
                      {selectedImages.length > 0 ? (
                        <div className="relative w-full h-full">
                          <Image 
                            fill
                            quality={100}
                            unoptimized
                            src={selectedImages[0]} 
                            alt="Selected plot"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <MapPin className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="sm:col-span-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-lg font-semibold">
                          €{hasPlotDetails(selectedPlot) && selectedPlot.plotPrice
                            ? parseFloat(selectedPlot.plotPrice).toLocaleString()
                            : 'N/A'}
                        </div>
                        <div className="flex items-center gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7">
                                Action
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                if (typeof window !== 'undefined') {
                                  window.dispatchEvent(new CustomEvent('realtorOutreachRequested', { detail: { selectedPlotIds: [selectedPlot.plotId] } }));
                                }
                              }}>
                                Realtor Outreach
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {onPlotClick && (
                            <Button 
                              onClick={() => onPlotClick(selectedPlot.plotId)}
                              variant="outline" 
                              size="sm"
                            >
                              View Details
                              <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Square className="w-3 h-3" />
                          <span>
                            {hasPlotDetails(selectedPlot) && selectedPlot.plotSize
                              ? parseFloat(selectedPlot.plotSize).toLocaleString() + 'm²'
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span>
                            {hasPlotDetails(selectedPlot) && typeof selectedPlot.plotLatitude === 'number' && typeof selectedPlot.plotLongitude === 'number'
                              ? `${selectedPlot.plotLatitude.toFixed(3)}, ${selectedPlot.plotLongitude.toFixed(3)}`
                              : 'N/A'}
                          </span>
                        </div>
                      </div>
                      
                      <PlotStatusBadge 
                        status={selectedPlot.status || 'interested'}
                        size="sm"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </div>
      )}

       {/* All Project Plots */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-foreground">All Plots in Project</h3>
          {projectPlots && projectPlots.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{selectedPlots.length} selected</span>
            </div>
          )}
        </div>
        {projectPlots && projectPlots.length > 0 ? (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {/* Control row aligned with content (leaves a placeholder for checkbox column) */}
            <div className="grid grid-cols-[2rem_1fr] gap-2 items-center">
              {/* Placeholder to align with the checkbox column */}
              <div />
              {/* Controls */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={toggleSelectAll} className="h-7">
                  {allSelected ? 'Clear All' : 'Select All'}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7" disabled={selectedPlots.length === 0}>
                      Action
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      disabled={selectedPlots.length === 0}
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(new CustomEvent('realtorOutreachRequested', { detail: { selectedPlotIds: selectedPlots } }));
                        }
                      }}
                    >
                      Realtor Outreach
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={selectedPlots.length === 0}
                      onClick={() => {
                        if (!organizationId) return;
                        if (confirm(`Are you sure you want to remove ${selectedPlots.length} plot${selectedPlots.length !== 1 ? 's' : ''} from your project?`)) {
                          removePlotsMutation.mutate({
                            organizationId,
                            plotIds: selectedPlots
                          });
                        }
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      Remove from Project
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {projectPlots.map((projectPlot) => {
              const isSelected = projectPlot.plotId === projectData.selectedPlotId;
              const isChecked = selectedPlots.includes(projectPlot.plotId);
              const projectPlotImages = hasPlotDetails(projectPlot)
                ? toStringArray(projectPlot.plotImages)
                : [];
              
              return (
                <div key={projectPlot.id} className="grid grid-cols-[2rem_1fr] gap-2 items-start">
                  {/* Left column: checkbox, fixed width and centered */}
                  <div className="flex justify-center pt-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPlots((prev) => Array.from(new Set([...prev, projectPlot.plotId])));
                        } else {
                          setSelectedPlots((prev) => prev.filter(id => id !== projectPlot.plotId));
                        }
                      }}
                      className="w-4 h-4 accent-primary cursor-pointer"
                    />
                  </div>
                  <Card 
                    className={`cursor-pointer transition-all duration-200 hover:shadow-md w-full min-w-0 ${
                      isSelected ? 'ring-2 ring-primary/20 bg-primary/5' : ''
                    } ${isChecked ? 'ring-2 ring-primary/30' : ''}`}
                    onClick={() => onPlotClick?.(projectPlot.plotId)}
                  >
                    <CardContent className="p-3 md:p-4">
                      <div className="flex gap-3 md:gap-4">
                        {/* Image */}
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden flex-shrink-0">
                          {projectPlotImages.length > 0 ? (
                            <div className="relative w-full h-full">
                              <Image 
                                fill
                                quality={100}
                                unoptimized
                                src={projectPlotImages[0]} 
                                alt="Plot image"
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              <MapPin className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="font-semibold">
                              €{hasPlotDetails(projectPlot) && projectPlot.plotPrice
                                ? parseFloat(projectPlot.plotPrice).toLocaleString()
                                : 'N/A'}
                            </div>
                            <div className="flex items-center gap-2">
                              {isSelected && (
                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                              )}
                              <PlotActionMenu
                                plotId={projectPlot.plotId}
                                isSelected={isSelected}
                                organizationId={organizationId}
                                align="end"
                              />
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Square className="w-3 h-3" />
                              <span>{hasPlotDetails(projectPlot) && projectPlot.plotSize
                                ? parseFloat(projectPlot.plotSize).toLocaleString() + 'm²'
                                : 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span>
                                {hasPlotDetails(projectPlot) && typeof projectPlot.plotLatitude === 'number' && typeof projectPlot.plotLongitude === 'number'
                                  ? `${projectPlot.plotLatitude.toFixed(3)}, ${projectPlot.plotLongitude.toFixed(3)}`
                                  : 'N/A'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <PlotStatusBadge 
                              status={projectPlot.status || 'interested'}
                              size="sm"
                            />
                            <span className="text-xs text-muted-foreground">
                              Added {new Date(projectPlot.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 bg-muted/30 rounded-lg">
            <p className="text-sm text-muted-foreground mb-4">
              No plots in your project yet.
              <br />
              Try initiating outreach to add plots to your project.
            </p>
            <Button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('switchToBrowseTab'));
                }
              }}
              variant="default"
              size="sm"
            >
              Select Plots
            </Button>
          </div>
        )}
      </div>

      {/* Realtor Outreach Modal */}
      <RealtorOutreachModal
        open={isRealtorDialogOpen}
        onOpenChange={setIsRealtorDialogOpen}
        previewData={realtorPreviewData}
        selectedCount={selectedCount}
        selectableCount={selectableCount}
        emailSubject={emailSubject}
        onEmailSubjectChange={setEmailSubject}
        emailBody={emailBody}
        onEmailBodyChange={setEmailBody}
        rowSelection={rowSelection}
        onToggleAll={handleToggleAll}
        onRowToggle={(plotId, checked) => setRowSelection(prev => ({ ...prev, [plotId]: checked }))}
        organizationId={organizationId || ""}
      />
      </div>
    </>
  );
}