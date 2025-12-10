'use client';

import { useState, useRef, Fragment, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { trpc } from '@/trpc/client';
import { Card, CardContent } from '@/app/_components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/app/_components/ui/table';
import Link from 'next/link';
import { MapPin, Pencil, Check, X, ExternalLink, Map, ChevronDown, ChevronUp, ArrowLeft, Search, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import type { AppRouter } from '@/server/trpc';
import type { inferRouterOutputs } from '@trpc/server';
import { useToast } from '@/app/_components/ui/toast-provider';
import { CadastralPolygonEditor, type CadastralGeometry } from '@/app/_components/map';
import { Button } from '@/app/_components/ui/button';

export default function RealtorDashboard() {
  const utils = trpc.useUtils();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlPlotId = searchParams.get('plotId');
  const urlPlotIdProcessedRef = useRef(false);
  
  // Function to clear URL params and search state
  const clearSearchAndUrl = useCallback(() => {
    setShowNotFoundError(false);
    setSearchInputValue('');
    setCompanyPlotsSearch('');
    setAnyPlotSearchInput('');
    setAnyPlotSearchQuery('');
    // Clear the URL parameter
    router.replace('/realtor', { scroll: false });
  }, [router]);
  
  const { data, isLoading } = trpc.realtor.getAssignedOutreachRequests.useQuery({ page: 1, limit: 20 });
  
  // Company plots state
  const [companyPlotsPage, setCompanyPlotsPage] = useState(1);
  const [companyPlotsSearch, setCompanyPlotsSearch] = useState('');
  const [searchInputValue, setSearchInputValue] = useState('');
  const [showNotFoundError, setShowNotFoundError] = useState(false);
  const [searchedPlotId, setSearchedPlotId] = useState<string | null>(null);
  const companyPlotsLimit = 20;

  // Search any plot state (not restricted to company)
  const [anyPlotSearchInput, setAnyPlotSearchInput] = useState('');
  const [anyPlotSearchQuery, setAnyPlotSearchQuery] = useState('');
  const [showOwnershipWarning, setShowOwnershipWarning] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'edit' | 'claim';
    plotId: string;
    plot: any;
  } | null>(null);

  // Query for searching any plot
  const { data: anyPlotData, isLoading: anyPlotLoading } = trpc.realtor.searchAnyPlot.useQuery(
    { query: anyPlotSearchQuery },
    { enabled: !!anyPlotSearchQuery }
  );

  // Query to check plot ownership when needed
  const checkOwnershipQuery = trpc.realtor.checkPlotOwnership.useQuery(
    { plotId: pendingAction?.plotId ?? '' },
    { 
      enabled: !!pendingAction?.plotId,
      refetchOnMount: true,
      staleTime: 0,
    }
  );
  
  const { data: companyPlotsData, isLoading: companyPlotsLoading } = trpc.realtor.getMyCompanyPlots.useQuery({ 
    page: companyPlotsPage, 
    limit: companyPlotsLimit,
    searchPlotId: companyPlotsSearch || undefined,
  });

  // Query for claimed plots not in project requests
  const { data: claimedPlotsData, isLoading: claimedPlotsLoading } = trpc.realtor.getMyClaimedPlots.useQuery({ 
    page: 1, 
    limit: 50,
  });

  // Handle URL plotId parameter - pre-fill "Search Any Plot" and trigger it (only once on mount)
  useEffect(() => {
    if (urlPlotId && !urlPlotIdProcessedRef.current) {
      urlPlotIdProcessedRef.current = true;
      setAnyPlotSearchInput(urlPlotId);
      setAnyPlotSearchQuery(urlPlotId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show error popup if search from URL returns no results (legacy - can be removed)
  useEffect(() => {
    if (searchedPlotId && !companyPlotsLoading && companyPlotsData) {
      if (companyPlotsData.items.length === 0) {
        setShowNotFoundError(true);
      }
      // Reset searchedPlotId after checking
      setSearchedPlotId(null);
    }
  }, [searchedPlotId, companyPlotsLoading, companyPlotsData]);
  
  const toast = useToast();
  const [editingPlotId, setEditingPlotId] = useState<string | null>(null);
  const [expandedMapPlotId, setExpandedMapPlotId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    realLatitude: string;
    realLongitude: string;
  }>({ realLatitude: '', realLongitude: '' });

  const acceptMutation = trpc.realtor.acceptAssignedOutreachRequest.useMutation({
    onSuccess: () => {
      utils.realtor.getAssignedOutreachRequests.invalidate();
    },
  });

  const acceptCompanyPlotMutation = trpc.realtor.acceptCompanyPlot.useMutation({
    onSuccess: () => {
      utils.realtor.getMyCompanyPlots.invalidate();
      toast.success('Plot accepted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to accept plot: ${error.message}`);
    },
  });

  const unacceptCompanyPlotMutation = trpc.realtor.unacceptCompanyPlot.useMutation({
    onSuccess: () => {
      utils.realtor.getMyCompanyPlots.invalidate();
      toast.success('Plot unaccepted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to unaccept plot: ${error.message}`);
    },
  });

  // Mutation to claim any plot (from Search Any Plot section)
  const claimToastRef = useRef<string | null>(null);
  const claimAnyPlotMutation = trpc.realtor.claimAnyPlot.useMutation({
    onMutate: () => {
      const handle = toast.info('Claiming plot...', { duration: 0 });
      claimToastRef.current = handle.id;
    },
    onSuccess: () => {
      if (claimToastRef.current) {
        toast.dismiss(claimToastRef.current);
        claimToastRef.current = null;
      }
      utils.realtor.searchAnyPlot.invalidate();
      utils.realtor.getAssignedOutreachRequests.invalidate();
      utils.realtor.getMyClaimedPlots.invalidate();
      toast.success('Plot claimed successfully');
    },
    onError: (error) => {
      if (claimToastRef.current) {
        toast.dismiss(claimToastRef.current);
        claimToastRef.current = null;
      }
      toast.error(`Failed to claim plot: ${error.message}`);
    },
  });

  // Mutation to unclaim any plot
  const unclaimToastRef = useRef<string | null>(null);
  const unclaimAnyPlotMutation = trpc.realtor.unclaimAnyPlot.useMutation({
    onMutate: () => {
      const handle = toast.info('Unclaiming plot...', { duration: 0 });
      unclaimToastRef.current = handle.id;
    },
    onSuccess: () => {
      if (unclaimToastRef.current) {
        toast.dismiss(unclaimToastRef.current);
        unclaimToastRef.current = null;
      }
      utils.realtor.searchAnyPlot.invalidate();
      utils.realtor.getAssignedOutreachRequests.invalidate();
      utils.realtor.getMyClaimedPlots.invalidate();
      toast.success('Plot unclaimed successfully');
    },
    onError: (error) => {
      if (unclaimToastRef.current) {
        toast.dismiss(unclaimToastRef.current);
        unclaimToastRef.current = null;
      }
      toast.error(`Failed to unclaim plot: ${error.message}`);
    },
  });

  // Track toast ID for progress updates
  const locationToastRef = useRef<string | null>(null);
  const geometryToastRef = useRef<string | null>(null);

  const updateLocationMutation = trpc.realtor.updatePlotLocation.useMutation({
    onMutate: () => {
      // Show initial progress toast
      const handle = toast.info('Saving coordinates...', { duration: 0 });
      locationToastRef.current = handle.id;
      
      // Update to enrichment phase after a delay
      setTimeout(() => {
        if (locationToastRef.current) {
          toast.dismiss(locationToastRef.current);
          const newHandle = toast.info('Updating enrichments & amenities...', { duration: 0 });
          locationToastRef.current = newHandle.id;
        }
      }, 1000);
    },
    onSuccess: () => {
      // Dismiss progress toast
      if (locationToastRef.current) {
        toast.dismiss(locationToastRef.current);
        locationToastRef.current = null;
      }
      utils.realtor.getAssignedOutreachRequests.invalidate();
      setEditingPlotId(null);
      toast.success('Plot location and enrichments updated successfully!');
    },
    onError: (error) => {
      // Dismiss progress toast
      if (locationToastRef.current) {
        toast.dismiss(locationToastRef.current);
        locationToastRef.current = null;
      }
      toast.error(`Failed to update plot location: ${error.message}`);
    },
  });

  const updateGeometryMutation = trpc.realtor.updatePlotGeometry.useMutation({
    onMutate: () => {
      const handle = toast.info('Saving boundary...', { duration: 0 });
      geometryToastRef.current = handle.id;
    },
    onSuccess: () => {
      if (geometryToastRef.current) {
        toast.dismiss(geometryToastRef.current);
        geometryToastRef.current = null;
      }
      utils.realtor.getAssignedOutreachRequests.invalidate();
      toast.success('Plot boundary saved successfully!');
    },
    onError: (error) => {
      if (geometryToastRef.current) {
        toast.dismiss(geometryToastRef.current);
        geometryToastRef.current = null;
      }
      toast.error(`Failed to save plot boundary: ${error.message}`);
    },
  });

  // Execute the pending action after confirmation
  const executePendingAction = useCallback(() => {
    if (!pendingAction) return;
    
    if (pendingAction.type === 'edit') {
      setEditingPlotId(pendingAction.plotId);
      setEditValues({
        realLatitude: pendingAction.plot.realLatitude?.toString() || '',
        realLongitude: pendingAction.plot.realLongitude?.toString() || '',
      });
      setExpandedMapPlotId(pendingAction.plotId);
    } else if (pendingAction.type === 'claim') {
      claimAnyPlotMutation.mutate({ plotId: pendingAction.plotId });
    }
    
    setPendingAction(null);
    setShowOwnershipWarning(false);
  }, [pendingAction, claimAnyPlotMutation]);

  // Handle ownership check result for pending actions
  useEffect(() => {
    if (pendingAction && !checkOwnershipQuery.isLoading && checkOwnershipQuery.data) {
      if (!checkOwnershipQuery.data.belongsToCompany) {
        setShowOwnershipWarning(true);
      } else {
        // Plot belongs to company, proceed with action
        executePendingAction();
      }
    }
  }, [pendingAction, checkOwnershipQuery.isLoading, checkOwnershipQuery.data, executePendingAction]);

  // Handle action with ownership check for any plot
  const handleAnyPlotAction = useCallback((type: 'edit' | 'claim', plotId: string, plot: any) => {
    setPendingAction({ type, plotId, plot });
  }, []);

  if (isLoading && companyPlotsLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded mb-2 w-1/3"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  type GetAssignedOutreachRequestsOutput = inferRouterOutputs<AppRouter>['realtor']['getAssignedOutreachRequests'];
  type CadastralData = {
    address?: string;
    geometry?: {
      type: 'Polygon';
      coordinates: number[][][];
    };
    cadastral_reference?: string;
    label?: string;
    source?: string;
    parcel_area_m2?: number;
  };
  type AssignedItem = {
    project: { id: string; name: string };
    // Drizzle numeric() typically resolves to string | null for pg
    plot: { 
      id: string; 
      price: string | null; 
      size: string | null; 
      images?: string[] | null;
      latitude: number;
      longitude: number;
      enrichmentData?: { cadastral?: CadastralData } | null;
      address?: string | null;
      realLatitude?: number | null;
      realLongitude?: number | null;
      realAddress?: string | null;
      claimedByUserId?: string | null;
    };
    organizationPlot: { id: string; status: string; createdAt: string };
    municipality?: { name: string | null; district: string | null; country: string };
  };
  const typedData = data as GetAssignedOutreachRequestsOutput | undefined;
  const items = ((typedData?.items ?? []) as unknown) as AssignedItem[];

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg md:text-xl font-semibold text-gray-900">Realtor Dashboard</h1>
        <Link href="/chat">
          <Button variant="outline" size="sm" className="text-xs md:text-sm">
            <ArrowLeft className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Back to Chat</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </Link>
      </div>
      {/* Project Requests Section */}
      <div className="space-y-3">
        <h2 className="text-base md:text-lg font-semibold text-gray-800">Project Requests</h2>
        <p className="text-xs md:text-sm text-gray-500">Plots that buyers have added to their projects and assigned to: </p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-4 md:p-6 text-sm text-gray-600">
            No outreach requests assigned to you yet.
          </CardContent>
        </Card>
      ) : (
        <>
        {/* Desktop Table View */}
        <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>Public Coordinates</TableHead>
              <TableHead>Accurate Coordinates</TableHead>
              <TableHead>Municipality</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Size (m²)</TableHead>
              <TableHead>Boundary</TableHead>
              <TableHead>Edit</TableHead>
              <TableHead>Claim</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(({ project, plot, organizationPlot, municipality }) => {
              const accepted = ['realtor_replied', 'viewing_scheduled', 'offer_made', 'purchased'].includes(organizationPlot.status);
              const price = plot.price !== null ? Number(plot.price) : null;
              const size = plot.size !== null ? Number(plot.size) : null;
              const publicCoordinates = `${plot.latitude.toFixed(6)}, ${plot.longitude.toFixed(6)}`;
              const realCoordinates = plot.realLatitude && plot.realLongitude 
                ? `${plot.realLatitude.toFixed(6)}, ${plot.realLongitude.toFixed(6)}` 
                : '-';
              const municipalityName = municipality?.name || '-';
              const isEditing = editingPlotId === plot.id;

              const handleEdit = () => {
                setEditingPlotId(plot.id);
                setEditValues({
                  realLatitude: plot.realLatitude?.toString() || '',
                  realLongitude: plot.realLongitude?.toString() || '',
                });
                // Auto-expand the map when editing starts
                setExpandedMapPlotId(plot.id);
              };

              const handleSave = () => {
                const lat = parseFloat(editValues.realLatitude);
                const lng = parseFloat(editValues.realLongitude);
                
                if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                  alert('Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180.');
                  return;
                }

                updateLocationMutation.mutate({
                  plotId: plot.id,
                  realLatitude: lat,
                  realLongitude: lng,
                });
              };

              const handleCancel = () => {
                setEditingPlotId(null);
              };

              // Extract cadastral geometry from enrichment data
              const cadastralData = plot.enrichmentData?.cadastral;
              const hasGeometry = !!cadastralData?.geometry;
              const isMapExpanded = expandedMapPlotId === plot.id;

              const handleSaveGeometry = (geometry: CadastralGeometry) => {
                updateGeometryMutation.mutate({
                  plotId: plot.id,
                  geometry,
                });
              };

              // Update edit values when marker is dragged (for live display in table)
              const handleMarkerPositionChange = (newCenter: { latitude: number; longitude: number }) => {
                setEditValues({
                  realLatitude: newCenter.latitude.toString(),
                  realLongitude: newCenter.longitude.toString(),
                });
              };

              // Get the current center for the map - use edit values when editing, otherwise stored values
              const currentCenter = isEditing && editValues.realLatitude && editValues.realLongitude
                ? {
                    latitude: parseFloat(editValues.realLatitude) || plot.realLatitude || plot.latitude,
                    longitude: parseFloat(editValues.realLongitude) || plot.realLongitude || plot.longitude,
                  }
                : {
                    latitude: plot.realLatitude || plot.latitude,
                    longitude: plot.realLongitude || plot.longitude,
                  };

              const toggleMapExpanded = () => {
                setExpandedMapPlotId(isMapExpanded ? null : plot.id);
              };

              return (
                <Fragment key={`${project.id}-${plot.id}`}>
                <TableRow className={isMapExpanded ? 'border-b-0' : ''}>
                                    <TableCell>
                    <Link
                      href={`/plot/${plot.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View
                    </Link>
                  </TableCell>
                  <TableCell className="text-gray-600 text-xs">
                    {publicCoordinates}
                  </TableCell>
                  <TableCell className="text-gray-700 text-xs">
                    {isEditing ? (
                      <div className="flex gap-1">
                        <input
                          type="number"
                          step="0.000001"
                          value={editValues.realLatitude}
                          onChange={(e) => setEditValues({ ...editValues, realLatitude: e.target.value })}
                          className="w-24 px-1 py-0.5 text-xs border rounded"
                          placeholder="Latitude"
                        />
                        <input
                          type="number"
                          step="0.000001"
                          value={editValues.realLongitude}
                          onChange={(e) => setEditValues({ ...editValues, realLongitude: e.target.value })}
                          className="w-24 px-1 py-0.5 text-xs border rounded"
                          placeholder="Longitude"
                        />
                      </div>
                    ) : (
                      <span className={realCoordinates === '-' ? 'text-gray-400 italic' : ''}>
                        {realCoordinates}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-700">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      {municipalityName}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-900">{price !== null ? `€${price.toLocaleString()}` : '-'}</TableCell>
                  <TableCell>{size !== null ? `${size}` : '-'}</TableCell>
                  <TableCell>
                    <button
                      onClick={toggleMapExpanded}
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                        hasGeometry 
                          ? 'text-green-600 hover:text-green-700 hover:bg-green-50' 
                          : 'text-orange-600 hover:text-orange-700 hover:bg-orange-50'
                      }`}
                      title={hasGeometry ? 'View/edit boundary' : 'Draw boundary'}
                    >
                      <Map className="w-3 h-3" />
                      {hasGeometry ? 'View' : 'Draw'}
                      {isMapExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <div className="flex gap-1">
                        <button
                          onClick={handleSave}
                          disabled={updateLocationMutation.isPending}
                          className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                          title="Save changes"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleCancel}
                          disabled={updateLocationMutation.isPending}
                          className="p-1 text-red-600 hover:text-red-700 disabled:opacity-50"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleEdit}
                        className="p-1 text-blue-600 hover:text-blue-700"
                        title="Edit location"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {plot.claimedByUserId ? (
                        <>
                          <span className="text-xs text-green-600 font-medium">✓ Claimed</span>
                          <button
                            onClick={() => unclaimAnyPlotMutation.mutate({ plotId: plot.id })}
                            disabled={unclaimAnyPlotMutation.isPending}
                            className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                            title="Unclaim"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => claimAnyPlotMutation.mutate({ plotId: plot.id })}
                          disabled={claimAnyPlotMutation.isPending}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded disabled:opacity-50"
                        >
                          <Check className="w-3 h-3" />
                          Claim
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                
                {/* Expandable row for map editor */}
                {isMapExpanded && (
                  <TableRow key={`${project.id}-${plot.id}-map`}>
                    <TableCell colSpan={9} className="p-0 bg-gray-50">
                      <div className="p-4">
                        <CadastralPolygonEditor
                          initialGeometry={cadastralData?.geometry as CadastralGeometry | undefined}
                          center={currentCenter}
                          onSave={handleSaveGeometry}
                          isMarkerEditing={isEditing}
                          onMarkerPositionChange={handleMarkerPositionChange}
                          readOnly={false}
                          showArea={true}
                          height="400px"
                          cadastralInfo={{
                            reference: cadastralData?.cadastral_reference,
                            label: cadastralData?.label,
                            source: cadastralData?.source,
                          }}
                          showCadastreLayer={true}
                          country={(municipality?.country === 'ES' || municipality?.country === 'PT') ? municipality.country : 'PT'}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {items.map(({ project, plot, organizationPlot, municipality }) => {
            const accepted = ['realtor_replied', 'viewing_scheduled', 'offer_made', 'purchased'].includes(organizationPlot.status);
            const price = plot.price !== null ? Number(plot.price) : null;
            const size = plot.size !== null ? Number(plot.size) : null;
            const municipalityName = municipality?.name || '-';
            const cadastralData = plot.enrichmentData?.cadastral;
            const hasGeometry = !!cadastralData?.geometry;

            return (
              <Card key={`mobile-${project.id}-${plot.id}`}>
                <CardContent className="p-3 space-y-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <MapPin className="w-3 h-3" />
                        {municipalityName}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {price !== null && (
                          <span className="font-semibold text-gray-900">€{price.toLocaleString()}</span>
                        )}
                        {size !== null && (
                          <span className="text-sm text-gray-600">{size} m²</span>
                        )}
                      </div>
                    </div>
                    <Link
                      href={`/plot/${plot.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View
                    </Link>
                  </div>

                  {/* Coordinates */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-gray-500 mb-0.5">Public coords</div>
                      <div className="text-gray-700 font-mono text-[10px]">
                        {plot.latitude.toFixed(5)}, {plot.longitude.toFixed(5)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-0.5">Accurate coords</div>
                      <div className={`font-mono text-[10px] ${plot.realLatitude ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                        {plot.realLatitude && plot.realLongitude 
                          ? `${plot.realLatitude.toFixed(5)}, ${plot.realLongitude.toFixed(5)}`
                          : 'Not set'}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <button
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${
                          hasGeometry 
                            ? 'text-green-600 bg-green-50' 
                            : 'text-orange-600 bg-orange-50'
                        }`}
                      >
                        <Map className="w-3 h-3" />
                        {hasGeometry ? 'Has boundary' : 'No boundary'}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {plot.claimedByUserId ? (
                        <>
                          <span className="text-xs text-green-600 font-medium">✓ Claimed</span>
                          <button
                            onClick={() => unclaimAnyPlotMutation.mutate({ plotId: plot.id })}
                            disabled={unclaimAnyPlotMutation.isPending}
                            className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => claimAnyPlotMutation.mutate({ plotId: plot.id })}
                          disabled={claimAnyPlotMutation.isPending}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                        >
                          <Check className="w-3 h-3" />
                          Claim
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        </>
      )}

      {/* Search Any Plot Section */}
      <div className="space-y-3 mt-8 pt-8 border-t border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-base md:text-lg font-semibold text-gray-800">Search Any Plot</h2>
            <p className="text-xs md:text-sm text-gray-500">Search for a plot by ID or listing URL to claim or update coordinates</p>
          </div>
          
          {/* Search Input */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Plot ID or listing URL..."
                value={anyPlotSearchInput}
                onChange={(e) => setAnyPlotSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && anyPlotSearchInput.trim()) {
                    setAnyPlotSearchQuery(anyPlotSearchInput.trim());
                  }
                }}
                className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg w-full sm:w-64 md:w-80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (anyPlotSearchInput.trim()) {
                    setAnyPlotSearchQuery(anyPlotSearchInput.trim());
                  }
                }}
                disabled={!anyPlotSearchInput.trim()}
                className="flex-1 sm:flex-initial"
              >
                Search
              </Button>
              {anyPlotSearchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Clear the URL parameter
                    router.replace('/realtor', { scroll: false });
                    setAnyPlotSearchInput('');
                    setAnyPlotSearchQuery('');
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Search Results */}
        {anyPlotLoading && (
          <Card className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded mb-2 w-1/3"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </CardContent>
          </Card>
        )}

        {anyPlotSearchQuery && !anyPlotLoading && !anyPlotData?.plot && (
          <Card>
            <CardContent className="p-4 md:p-6 text-sm text-gray-600">
              No plot found matching "{anyPlotSearchQuery}"
            </CardContent>
          </Card>
        )}

        {anyPlotData?.plot && (
          <Card className="border border-blue-200 bg-blue-50/30">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-gray-500 truncate">{anyPlotData.plot.id}</span>
                      <Link
                        href={`/plot/${anyPlotData.plot.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500 text-xs">Price</span>
                        <div className="font-medium">
                          {anyPlotData.plot.price ? `€${Number(anyPlotData.plot.price).toLocaleString()}` : '-'}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">Size</span>
                        <div className="font-medium">
                          {anyPlotData.plot.size ? `${Number(anyPlotData.plot.size).toLocaleString()} m²` : '-'}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">Municipality</span>
                        <div className="font-medium">{anyPlotData.plot.municipality?.name || '-'}</div>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">Coordinates</span>
                        <div className="font-medium text-xs">
                          {anyPlotData.plot.realLatitude && anyPlotData.plot.realLongitude 
                            ? `${anyPlotData.plot.realLatitude.toFixed(4)}, ${anyPlotData.plot.realLongitude.toFixed(4)}` 
                            : `${anyPlotData.plot.latitude.toFixed(4)}, ${anyPlotData.plot.longitude.toFixed(4)}`}
                        </div>
                      </div>
                    </div>
                    {anyPlotData.plot.primaryListingLink && (
                      <div className="mt-2">
                        <a 
                          href={anyPlotData.plot.primaryListingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline truncate block"
                        >
                          {anyPlotData.plot.primaryListingLink}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-blue-200">
                  {editingPlotId === anyPlotData.plot.id ? (
                    <>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                        <input
                          type="number"
                          step="0.000001"
                          value={editValues.realLatitude}
                          onChange={(e) => setEditValues({ ...editValues, realLatitude: e.target.value })}
                          className="w-full sm:w-28 px-2 py-1.5 border rounded text-xs"
                          placeholder="Latitude"
                        />
                        <input
                          type="number"
                          step="0.000001"
                          value={editValues.realLongitude}
                          onChange={(e) => setEditValues({ ...editValues, realLongitude: e.target.value })}
                          className="w-full sm:w-28 px-2 py-1.5 border rounded text-xs"
                          placeholder="Longitude"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const lat = parseFloat(editValues.realLatitude);
                          const lng = parseFloat(editValues.realLongitude);
                          if (isNaN(lat) || isNaN(lng)) {
                            toast.error('Invalid coordinates');
                            return;
                          }
                          try {
                            await updateLocationMutation.mutateAsync({
                              plotId: anyPlotData.plot!.id,
                              realLatitude: lat,
                              realLongitude: lng,
                            });
                            setEditingPlotId(null);
                            setExpandedMapPlotId(null);
                            utils.realtor.searchAnyPlot.invalidate();
                          } catch (err) {
                            console.error('Failed to update location:', err);
                          }
                        }}
                        className="text-xs text-green-600 border-green-300"
                      >
                        <Check className="w-3 h-3 mr-1" />
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingPlotId(null);
                          setExpandedMapPlotId(null);
                          setEditValues({ realLatitude: '', realLongitude: '' });
                        }}
                        className="text-xs"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAnyPlotAction('edit', anyPlotData.plot!.id, anyPlotData.plot)}
                        className="text-xs"
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit Coordinates
                      </Button>
                      {!anyPlotData.plot.claimedByUserId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAnyPlotAction('claim', anyPlotData.plot!.id, anyPlotData.plot)}
                          className="text-xs"
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Claim Plot
                        </Button>
                      )}
                      {anyPlotData.plot.claimedByUserId && (
                        <>
                          <span className="text-xs text-green-600 font-medium">✓ Claimed</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => unclaimAnyPlotMutation.mutate({ plotId: anyPlotData.plot!.id })}
                            disabled={unclaimAnyPlotMutation.isPending}
                            className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <X className="w-3 h-3 mr-1" />
                            Unclaim
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>

                {/* Map Editor for coordinates */}
                {expandedMapPlotId === anyPlotData.plot.id && (
                  <div className="pt-3 border-t border-blue-200 mt-3">
                    <CadastralPolygonEditor
                      initialGeometry={(anyPlotData.plot.enrichmentData as any)?.cadastral?.geometry}
                      center={{
                        latitude: anyPlotData.plot.realLatitude || anyPlotData.plot.latitude,
                        longitude: anyPlotData.plot.realLongitude || anyPlotData.plot.longitude,
                      }}
                      onSave={(geometry) => {
                        updateGeometryMutation.mutate({
                          plotId: anyPlotData.plot!.id,
                          geometry,
                        });
                      }}
                      isMarkerEditing={editingPlotId === anyPlotData.plot.id}
                      onMarkerPositionChange={(newCenter: { latitude: number; longitude: number }) => {
                        setEditValues({
                          realLatitude: newCenter.latitude.toString(),
                          realLongitude: newCenter.longitude.toString(),
                        });
                      }}
                      readOnly={false}
                      showArea={true}
                      height="280px"
                      cadastralInfo={{
                        reference: (anyPlotData.plot.enrichmentData as any)?.cadastral?.cadastral_reference,
                        label: (anyPlotData.plot.enrichmentData as any)?.cadastral?.label,
                        source: (anyPlotData.plot.enrichmentData as any)?.cadastral?.source,
                      }}
                      showCadastreLayer={true}
                      country={(anyPlotData.plot.municipality?.country === 'ES' || anyPlotData.plot.municipality?.country === 'PT') ? anyPlotData.plot.municipality.country : 'PT'}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* My Claimed Plots Section */}
      <div className="space-y-3 mt-8 pt-8 border-t border-gray-200">
        <div>
          <h2 className="text-base md:text-lg font-semibold text-gray-800">My Claimed Plots</h2>
          <p className="text-xs md:text-sm text-gray-500">Plots you have claimed that are not part of any project request</p>
        </div>

        {claimedPlotsLoading && (
          <Card className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded mb-2 w-1/3"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </CardContent>
          </Card>
        )}

        {!claimedPlotsLoading && (!claimedPlotsData?.items || claimedPlotsData.items.length === 0) && (
          <Card>
            <CardContent className="p-4 md:p-6 text-sm text-gray-600">
              You haven&apos;t claimed any plots yet. Use the search above to find and claim plots.
            </CardContent>
          </Card>
        )}

        {claimedPlotsData?.items && claimedPlotsData.items.length > 0 && (
          <div className="space-y-2">
            {claimedPlotsData.items.map(({ plot, municipality }) => (
              <Card key={plot.id} className="border border-green-200 bg-green-50/30">
                <CardContent className="p-3 md:p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      {/* Plot Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-gray-500 truncate">{plot.id}</span>
                          <Link
                            href={`/plot/${plot.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View
                          </Link>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            <span className="text-gray-700">{municipality?.name || 'Unknown'}</span>
                          </div>
                          {plot.price && (
                            <span className="font-medium text-gray-900">€{Number(plot.price).toLocaleString()}</span>
                          )}
                          {plot.size && (
                            <span className="text-gray-600">{Number(plot.size).toLocaleString()} m²</span>
                          )}
                        </div>
                        {plot.primaryListingLink && (
                          <a 
                            href={plot.primaryListingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline truncate block mt-1"
                          >
                            {plot.primaryListingLink}
                          </a>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <span className="text-xs text-green-600 font-medium">✓ Claimed</span>
                        {editingPlotId === plot.id ? (
                          <>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                              <input
                                type="number"
                                step="0.000001"
                                value={editValues.realLatitude}
                                onChange={(e) => setEditValues({ ...editValues, realLatitude: e.target.value })}
                                className="w-full sm:w-24 px-2 py-1.5 border rounded text-xs"
                                placeholder="Latitude"
                              />
                              <input
                                type="number"
                                step="0.000001"
                                value={editValues.realLongitude}
                                onChange={(e) => setEditValues({ ...editValues, realLongitude: e.target.value })}
                                className="w-full sm:w-24 px-2 py-1.5 border rounded text-xs"
                                placeholder="Longitude"
                              />
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                const lat = parseFloat(editValues.realLatitude);
                                const lng = parseFloat(editValues.realLongitude);
                                if (isNaN(lat) || isNaN(lng)) {
                                  toast.error('Invalid coordinates');
                                  return;
                                }
                                try {
                                  await updateLocationMutation.mutateAsync({
                                    plotId: plot.id,
                                    realLatitude: lat,
                                    realLongitude: lng,
                                  });
                                  setEditingPlotId(null);
                                  setExpandedMapPlotId(null);
                                  utils.realtor.getMyClaimedPlots.invalidate();
                                } catch (err) {
                                  console.error('Failed to update location:', err);
                                }
                              }}
                              className="text-xs text-green-600 border-green-300"
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Save
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingPlotId(null);
                                setExpandedMapPlotId(null);
                                setEditValues({ realLatitude: '', realLongitude: '' });
                              }}
                              className="text-xs"
                            >
                              <X className="w-3 h-3 mr-1" />
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingPlotId(plot.id);
                                setEditValues({
                                  realLatitude: plot.realLatitude?.toString() || '',
                                  realLongitude: plot.realLongitude?.toString() || '',
                                });
                                setExpandedMapPlotId(plot.id);
                              }}
                              className="text-xs"
                            >
                              <Pencil className="w-3 h-3 mr-1" />
                              Edit Coordinates
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => unclaimAnyPlotMutation.mutate({ plotId: plot.id })}
                              disabled={unclaimAnyPlotMutation.isPending}
                              className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <X className="w-3 h-3 mr-1" />
                              Unclaim
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Map Editor for coordinates */}
                    {expandedMapPlotId === plot.id && (
                      <div className="pt-3 border-t border-green-200">
                        <CadastralPolygonEditor
                          initialGeometry={(plot.enrichmentData as any)?.cadastral?.geometry}
                          center={{
                            latitude: plot.realLatitude || plot.latitude,
                            longitude: plot.realLongitude || plot.longitude,
                          }}
                          onSave={(geometry) => {
                            updateGeometryMutation.mutate({
                              plotId: plot.id,
                              geometry,
                            });
                          }}
                          isMarkerEditing={editingPlotId === plot.id}
                          onMarkerPositionChange={(newCenter: { latitude: number; longitude: number }) => {
                            setEditValues({
                              realLatitude: newCenter.latitude.toString(),
                              realLongitude: newCenter.longitude.toString(),
                            });
                          }}
                          readOnly={false}
                          showArea={true}
                          height="280px"
                          cadastralInfo={{
                            reference: (plot.enrichmentData as any)?.cadastral?.cadastral_reference,
                            label: (plot.enrichmentData as any)?.cadastral?.label,
                            source: (plot.enrichmentData as any)?.cadastral?.source,
                          }}
                          showCadastreLayer={true}
                          country={(municipality?.country === 'ES' || municipality?.country === 'PT') ? municipality.country : 'PT'}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Plot Not Found Error Modal */}
      {showNotFoundError && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={clearSearchAndUrl}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="relative p-6 pb-4">
              <button
                onClick={clearSearchAndUrl}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
              
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  Plot Not Found
                </h2>
              </div>
            </div>

            {/* Modal Content */}
            <div className="px-6 pb-6">
              <p className="text-gray-700">
                The plot <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-sm">{urlPlotId}</span> could not be found in the plots managed by{' '}
                <span className="font-semibold">{companyPlotsData?.companyName || 'your company'}</span>.
              </p>
              <p className="text-gray-500 text-sm mt-3">
                This plot may not be listed under your agency, or the plot ID may be incorrect.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="px-6 pb-6">
              <Button
                onClick={clearSearchAndUrl}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Ownership Warning Modal */}
      {showOwnershipWarning && pendingAction && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setShowOwnershipWarning(false);
            setPendingAction(null);
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="relative p-6 pb-4">
              <button
                onClick={() => {
                  setShowOwnershipWarning(false);
                  setPendingAction(null);
                }}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
              
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  Warning: External Plot
                </h2>
              </div>
            </div>

            {/* Modal Content */}
            <div className="px-6 pb-6">
              <p className="text-gray-700">
                This plot does not appear to be linked to your company. Are you sure you want to {pendingAction.type === 'edit' ? 'edit the coordinates for' : 'claim'} this plot?
              </p>
              <p className="text-gray-500 text-sm mt-3">
                Proceeding may associate your account with a plot that belongs to another agency.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowOwnershipWarning(false);
                  setPendingAction(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={executePendingAction}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
              >
                Proceed Anyway
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

