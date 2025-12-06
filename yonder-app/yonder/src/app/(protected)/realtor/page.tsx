'use client';

import { useState, useRef } from 'react';
import { trpc } from '@/trpc/client';
import { Card, CardContent } from '@/app/_components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/app/_components/ui/table';
import Link from 'next/link';
import { MapPin, Pencil, Check, X, ExternalLink, Map, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import type { AppRouter } from '@/server/trpc';
import type { inferRouterOutputs } from '@trpc/server';
import { useToast } from '@/app/_components/ui/toast-provider';
import { CadastralPolygonEditor, type CadastralGeometry } from '@/app/_components/map';
import { Button } from '@/app/_components/ui/button';

export default function RealtorDashboard() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.realtor.getAssignedOutreachRequests.useQuery({ page: 1, limit: 20 });
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

  if (isLoading) {
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
              <TableHead>Accept</TableHead>
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
                <>
                <TableRow key={`${project.id}-${plot.id}`} className={isMapExpanded ? 'border-b-0' : ''}>
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
                    <label className="flex items-center gap-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300"
                        checked={accepted}
                        disabled={acceptMutation.isPending || accepted}
                        onChange={(e) => {
                          if (e.target.checked) {
                            acceptMutation.mutate(
                              { organizationPlotId: organizationPlot.id },
                              {
                                onSuccess: () => {
                                  utils.realtor.getAssignedOutreachRequests.invalidate();
                                  utils.projects.getOrganizationProject.invalidate({ organizationId: project.id });
                                },
                              }
                            );
                          }
                        }}
                      />
                      <span>{accepted ? 'Accepted' : 'Accept'}</span>
                    </label>
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
                </>
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
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300"
                        checked={accepted}
                        disabled={accepted}
                      />
                      <span className={accepted ? 'text-green-600 font-medium' : 'text-gray-600'}>
                        {accepted ? 'Accepted' : 'Accept'}
                      </span>
                    </label>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}

