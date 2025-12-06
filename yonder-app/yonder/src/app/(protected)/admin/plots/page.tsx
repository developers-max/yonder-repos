'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { trpc } from '@/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/_components/ui/card';
import { Button } from '@/app/_components/ui/button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/app/_components/ui/table';
import Link from 'next/link';
import { MapPin, Pencil, Check, X, ExternalLink, Search, Map, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { useToast } from '@/app/_components/ui/toast-provider';
import { CadastralPolygonEditor, type CadastralGeometry } from '@/app/_components/map';

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

type PlotEnrichmentData = {
  cadastral?: CadastralData;
};

export default function AdminPlotsPage() {
  const utils = trpc.useUtils();
  const toast = useToast();
  const searchParams = useSearchParams();
  
  const [searchInput, setSearchInput] = useState('');
  const [searchedPlotId, setSearchedPlotId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [editValues, setEditValues] = useState({
    realLatitude: '',
    realLongitude: '',
  });

  // Auto-load plot from URL query parameter
  useEffect(() => {
    const plotIdFromUrl = searchParams.get('plotId');
    if (plotIdFromUrl && plotIdFromUrl !== searchedPlotId) {
      setSearchInput(plotIdFromUrl);
      setSearchedPlotId(plotIdFromUrl);
    }
  }, [searchParams, searchedPlotId]);

  // Query for the searched plot
  const { data: plot, isLoading, error } = trpc.realtor.adminGetPlot.useQuery(
    { plotId: searchedPlotId! },
    { enabled: !!searchedPlotId }
  );

  // Track toast ID for progress updates
  const locationToastRef = useRef<string | null>(null);
  const geometryToastRef = useRef<string | null>(null);

  const updateLocationMutation = trpc.realtor.adminUpdatePlotLocation.useMutation({
    onMutate: () => {
      // Show initial progress toast
      const handle = toast.info('Saving coordinates...', { duration: 0 });
      locationToastRef.current = handle.id;
      
      // Update to enrichment phase after a delay (simulating progress)
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
      utils.realtor.adminGetPlot.invalidate({ plotId: searchedPlotId! });
      setIsEditing(false);
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

  const updateGeometryMutation = trpc.realtor.adminUpdatePlotGeometry.useMutation({
    onMutate: () => {
      const handle = toast.info('Saving boundary...', { duration: 0 });
      geometryToastRef.current = handle.id;
    },
    onSuccess: () => {
      if (geometryToastRef.current) {
        toast.dismiss(geometryToastRef.current);
        geometryToastRef.current = null;
      }
      utils.realtor.adminGetPlot.invalidate({ plotId: searchedPlotId! });
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (trimmed) {
      setSearchedPlotId(trimmed);
      setIsEditing(false);
      setIsMapExpanded(false);
    }
  };

  const handleEdit = () => {
    if (!plot) return;
    setIsEditing(true);
    setEditValues({
      realLatitude: plot.realLatitude?.toString() || '',
      realLongitude: plot.realLongitude?.toString() || '',
    });
    setIsMapExpanded(true);
  };

  const handleSave = () => {
    if (!plot) return;
    const lat = parseFloat(editValues.realLatitude);
    const lng = parseFloat(editValues.realLongitude);
    
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast.error('Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180.');
      return;
    }

    updateLocationMutation.mutate({
      plotId: plot.id,
      realLatitude: lat,
      realLongitude: lng,
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSaveGeometry = (geometry: CadastralGeometry) => {
    if (!plot) return;
    updateGeometryMutation.mutate({
      plotId: plot.id,
      geometry,
    });
  };

  const handleMarkerPositionChange = (newCenter: { latitude: number; longitude: number }) => {
    setEditValues({
      realLatitude: newCenter.latitude.toString(),
      realLongitude: newCenter.longitude.toString(),
    });
  };

  // Computed values for display
  const cadastralData = plot?.enrichmentData ? (plot.enrichmentData as PlotEnrichmentData).cadastral : null;
  const hasGeometry = !!cadastralData?.geometry;
  
  const publicCoordinates = plot 
    ? `${plot.latitude.toFixed(6)}, ${plot.longitude.toFixed(6)}` 
    : '-';
  
  const realCoordinates = plot?.realLatitude && plot?.realLongitude 
    ? `${plot.realLatitude.toFixed(6)}, ${plot.realLongitude.toFixed(6)}` 
    : '-';

  const currentCenter = plot ? (
    isEditing && editValues.realLatitude && editValues.realLongitude
      ? {
          latitude: parseFloat(editValues.realLatitude) || plot.realLatitude || plot.latitude,
          longitude: parseFloat(editValues.realLongitude) || plot.realLongitude || plot.longitude,
        }
      : {
          latitude: plot.realLatitude || plot.latitude,
          longitude: plot.realLongitude || plot.longitude,
        }
  ) : { latitude: 0, longitude: 0 };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Plot Management</h1>
        <p className="text-sm text-gray-500 mt-1">Search for a plot by ID to view and edit its data</p>
      </div>

      {/* Search Form */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Enter Plot ID (e.g., e0927cb4-0629-4085-ace7-61b23befa767)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              />
            </div>
            <Button type="submit" disabled={!searchInput.trim()}>
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && searchedPlotId && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading plot data...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <div>
                <p className="font-medium">Plot not found</p>
                <p className="text-sm text-red-600 mt-1">{error.message}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plot Data */}
      {plot && !isLoading && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Plot Details</CardTitle>
              <Link
                href={`/plot/${plot.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                View Public Page
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plot ID</TableHead>
                  <TableHead>Public Coordinates</TableHead>
                  <TableHead>Accurate Coordinates</TableHead>
                  <TableHead>Municipality</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Size (m²)</TableHead>
                  <TableHead>Boundary</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className={isMapExpanded ? 'border-b-0' : ''}>
                  <TableCell className="font-mono text-xs text-gray-600 max-w-[200px] truncate" title={plot.id}>
                    {plot.id.slice(0, 8)}...
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
                      {plot.municipality?.name || '-'}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-900">
                    {plot.price ? `€${Number(plot.price).toLocaleString()}` : '-'}
                  </TableCell>
                  <TableCell>
                    {plot.size ? Number(plot.size).toLocaleString() : '-'}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => setIsMapExpanded(!isMapExpanded)}
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
                </TableRow>

                {/* Expandable row for map editor */}
                {isMapExpanded && (
                  <TableRow>
                    <TableCell colSpan={8} className="p-0 bg-gray-50">
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
                          country={(plot.municipality?.country === 'ES' || plot.municipality?.country === 'PT') ? plot.municipality.country : 'PT'}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Additional Plot Info */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Additional Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="md:col-span-1">
                  <span className="text-gray-500 text-xs">Full Plot ID:</span>
                  <p className="font-mono text-xs text-gray-700 mt-1">{plot.id}</p>
                </div>
                {cadastralData?.cadastral_reference && (
                  <div>
                    <span className="text-gray-500 text-xs">Cadastral Reference:</span>
                    <p className="text-gray-700 mt-1">{cadastralData.cadastral_reference}</p>
                  </div>
                )}
                {cadastralData?.parcel_area_m2 && (
                  <div>
                    <span className="text-gray-500 text-xs">Parcel Area:</span>
                    <p className="text-gray-700 mt-1">{cadastralData.parcel_area_m2.toLocaleString()} m²</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!searchedPlotId && (
        <Card>
          <CardContent className="p-12 text-center">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Search for a Plot</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Enter a plot ID in the search box above to view and edit its coordinates and boundary data.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
