'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/trpc/client';
import { Button } from '@/app/_components/ui/button';
import { Input } from '@/app/_components/ui/input';
import { Label } from '@/app/_components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/_components/ui/select';
import { Card, CardContent } from '@/app/_components/ui/card';
import { Badge } from '@/app/_components/ui/badge';
import { MapPin, Square, ChevronLeft, ChevronRight, Filter, X, ChevronDown, ChevronUp, Waves, Coffee, ShoppingCart, Bus, List, Map as MapIcon, Search, Star } from 'lucide-react';
import type { PlotFilters, EnrichmentData } from '@/server/trpc/router/plot/plots';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/server/trpc';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import PlotDetails from './plot-details';
import PlotsMap from './plots-map';
import ProjectContent from '../project/project-content';
import { OutreachComponent } from '../tool-results/plot/outreach-component';

interface PlotsPanelProps {
  className?: string;
}

type RouterOutputs = inferRouterOutputs<AppRouter>;
type SearchPlot = RouterOutputs['plots']['searchPlots']['plots'][number] & {
  id: string;
  latitude: number;
  longitude: number;
  price: number;
  size: number | null;
  images: string[] | null;
  distanceKm?: number | null;
  enrichmentData: EnrichmentData | null;
};

interface PlaceSearchResult {
  lat: string;
  lon: string;
  display_name: string;
}

export default function PlotsPanel({ className }: PlotsPanelProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedPlotId = searchParams.get('plotId');

  const [filters, setFilters] = useState<Partial<PlotFilters>>({
    page: 1,
    limit: 20,
    sortBy: 'price' as const,
    sortOrder: 'asc' as const,
    radiusKm: 50,
    minSize: 50,
    minPrice: 1000
  });

  const [appliedFilters, setAppliedFilters] = useState<Partial<PlotFilters>>(filters);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeSearching, setPlaceSearching] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [mobileFiltersCollapsed, setMobileFiltersCollapsed] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('map');
  const [activeTab, setActiveTab] = useState<'browse' | 'project'>('browse');
  const [resizeKey, setResizeKey] = useState(0);
  const [shouldZoomToLocation, setShouldZoomToLocation] = useState(false);
  const [droppedPin, setDroppedPin] = useState<{ latitude: number; longitude: number; label?: string } | null>(null);

  // Listen for filter application events from chat
  useEffect(() => {
    const handleApplyFilters = (event: CustomEvent) => {

      // Switch to browse tab
      setActiveTab('browse');

      const newFilters = event.detail;

      // Clear any selected plot when applying new filters
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete('plotId');
      router.replace(currentUrl.toString());

      // Check if location is changing
      const locationChanged = newFilters.latitude && newFilters.longitude &&
        (newFilters.latitude !== filters.latitude || newFilters.longitude !== filters.longitude);

      // Overwrite all filters, reset to defaults for unspecified values
      const updatedFilters = {
        page: 1,
        limit: 20,
        sortBy: newFilters.sortBy || 'price',
        sortOrder: newFilters.sortOrder || 'asc',
        radiusKm: newFilters.radiusKm || 50,
        // Only keep the new filter values, don't merge with existing
        latitude: newFilters.latitude,
        longitude: newFilters.longitude,
        minPrice: newFilters.minPrice,
        maxPrice: newFilters.maxPrice,
        minSize: newFilters.minSize,
        maxSize: newFilters.maxSize,
        maxDistanceToBeach: newFilters.maxDistanceToBeach,
        maxDistanceToCafe: newFilters.maxDistanceToCafe,
        maxDistanceToSupermarket: newFilters.maxDistanceToSupermarket,
        maxDistanceToPublicTransport: newFilters.maxDistanceToPublicTransport,
        maxDistanceToRestaurant: newFilters.maxDistanceToRestaurant,
        maxDistanceToMainTown: newFilters.maxDistanceToMainTown,
        // Zoning filters
        zoningLabelContains: newFilters.zoningLabelContains,
        zoningLabelEnContains: newFilters.zoningLabelEnContains,
        zoningTypenameContains: newFilters.zoningTypenameContains,
        zoningPickedFieldContains: newFilters.zoningPickedFieldContains,
        zoningSourceContains: newFilters.zoningSourceContains,
        zoningTextContains: newFilters.zoningTextContains,
      };

      setFilters(updatedFilters);
      setAppliedFilters(updatedFilters);

      // Set flag to zoom to location if it changed
      if (locationChanged) {
        setShouldZoomToLocation(true);
        setTimeout(() => {
          setShouldZoomToLocation(false);
        }, 1000);
      }

      // Don't automatically expand filters - keep current state
      setPlaceQuery(''); // Clear place search query to avoid confusion
    };

    const handleSwitchToProject = () => {
      setActiveTab('project');
    };

    const handleSwitchToBrowse = () => {
      setActiveTab('browse');
      // Trigger map resize when switching to Browse plots tab
      setTimeout(() => {
        setResizeKey(prev => prev + 1);
      }, 200);
    };

    const handleRefreshProjectData = () => {
      // Switch to project tab when project data is refreshed
      setActiveTab('project');
    };

    const handleContactRealtorRequested = (event: Event) => {
      const { detail } = event as CustomEvent<{ plotId?: string }>;
      const plotId = detail?.plotId;
      if (!plotId) return;
      setActiveTab('project');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('realtorOutreachRequested', { detail: { selectedPlotIds: [plotId] } })
        );
      }
    };

    const handleNavigateToMapLocation = (event: Event) => {
      const { detail } = event as CustomEvent<{ latitude: number; longitude: number; zoom?: number; label?: string }>;
      if (!detail?.latitude || !detail?.longitude) return;

      // Switch to browse tab and map view
      setActiveTab('browse');
      setViewMode('map');

      // Update filters with the new location
      const updatedFilters = {
        ...filters,
        latitude: detail.latitude,
        longitude: detail.longitude,
        page: 1,
      };
      setFilters(updatedFilters);
      setAppliedFilters(updatedFilters);

      // Drop a pin at the navigated location
      setDroppedPin({
        latitude: detail.latitude,
        longitude: detail.longitude,
        label: detail.label,
      });

      // Trigger zoom to location
      setShouldZoomToLocation(true);
      setTimeout(() => {
        setShouldZoomToLocation(false);
      }, 2000);

      // Trigger map resize
      setTimeout(() => {
        setResizeKey(prev => prev + 1);
      }, 100);
    };

    const handleClearMapPin = () => {
      // Clear the dropped pin from the map
      setDroppedPin(null);
      // Trigger map resize to force re-render
      setTimeout(() => {
        setResizeKey(prev => prev + 1);
      }, 50);
    };

    window.addEventListener('applyPlotFilters', handleApplyFilters as EventListener);
    window.addEventListener('switchToProjectTab', handleSwitchToProject as EventListener);
    window.addEventListener('switchToBrowseTab', handleSwitchToBrowse as EventListener);
    window.addEventListener('refreshProjectData', handleRefreshProjectData as EventListener);
    window.addEventListener('contactRealtorRequested', handleContactRealtorRequested as EventListener);
    window.addEventListener('navigateToMapLocation', handleNavigateToMapLocation as EventListener);
    window.addEventListener('clearMapPin', handleClearMapPin as EventListener);

    return () => {
      window.removeEventListener('applyPlotFilters', handleApplyFilters as EventListener);
      window.removeEventListener('switchToProjectTab', handleSwitchToProject as EventListener);
      window.removeEventListener('switchToBrowseTab', handleSwitchToBrowse as EventListener);
      window.removeEventListener('refreshProjectData', handleRefreshProjectData as EventListener);
      window.removeEventListener('contactRealtorRequested', handleContactRealtorRequested as EventListener);
      window.removeEventListener('navigateToMapLocation', handleNavigateToMapLocation as EventListener);
      window.removeEventListener('clearMapPin', handleClearMapPin as EventListener);
    };
  }, [router, filters]);

  // Handle map bounds change to sync with filters (optional - uncomment to enable)
  const handleMapBoundsChange = useCallback((center: { latitude: number; longitude: number }, radiusKm: number) => {
    // Update both form state and applied filters when map bounds change
    const updatedFilters = {
      latitude: center.latitude,
      longitude: center.longitude,
      radiusKm: radiusKm,
      page: 1 // Reset to page 1 when location changes
    };

    setFilters(prev => ({ ...prev, ...updatedFilters }));
    setAppliedFilters(prev => ({ ...prev, ...updatedFilters }));

    // Clear place search query when map updates location
    setPlaceQuery('');
  }, []);

  // Search plots with applied filters
  const { data: plotsData, isLoading } = trpc.plots.searchPlots.useQuery(appliedFilters as PlotFilters);
  const plotsList: SearchPlot[] = (plotsData?.plots ?? []) as SearchPlot[];

  // Handle plot card click
  const handlePlotClick = (plotId: string) => {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('plotId', plotId);
    router.push(currentUrl.toString());
  };

  // Handle back to search from plot details
  const handleBackToSearch = () => {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete('plotId');
    router.replace(currentUrl.toString());

    // Trigger map resize after returning to search view
    setTimeout(() => {
      setResizeKey(prev => prev + 1);
    }, 500);
  };

  // Handle filter changes
  const updateFilter = (key: keyof PlotFilters, value: string | number | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      // Reset to page 1 when filters change (except for page itself)
      ...(key !== 'page' ? { page: 1 } : {})
    }));
  };

  // Apply filters manually
  const applyFilters = () => {
    setAppliedFilters(filters);
    setFiltersExpanded(false);
    setShouldZoomToLocation(true);

    // Reset zoom flag after 1 second
    setTimeout(() => {
      setShouldZoomToLocation(false);
    }, 1000);

    // Trigger map resize after filter animation completes
    if (viewMode === 'map') {
      setTimeout(() => {
        setResizeKey(prev => prev + 1);
      }, 100);
    }
  };

  // Handle place search using Nominatim (OpenStreetMap)
  const searchPlace = async () => {
    if (!placeQuery.trim()) return;

    setPlaceSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placeQuery + ', Portugal')}&limit=1&addressdetails=1`
      );
      const results: PlaceSearchResult[] = await response.json();

      if (results.length > 0) {
        const result = results[0];
        setFilters(prev => ({
          ...prev,
          latitude: Number(result.lat),
          longitude: Number(result.lon),
          page: 1
        }));
      }
    } catch (error) {
      console.error('Place search failed:', error);
    }
    setPlaceSearching(false);
  };

  // Clear location filter
  const clearLocation = () => {
    updateFilter('latitude', undefined);
    updateFilter('longitude', undefined);
    setPlaceQuery('');
  };

  // Reset all filters
  const resetFilters = () => {
    const defaultFilters = {
      page: 1,
      limit: 20,
      sortBy: 'price' as const,
      sortOrder: 'asc' as const,
      radiusKm: 50,
      minSize: 50,
      minPrice: 1000
    };
    setFilters(defaultFilters);
    setPlaceQuery('');
  };

  // Format distance helper
  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${meters}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  // Get enrichment data for a plot
  const getEnrichmentInfo = (enrichmentData: EnrichmentData) => {
    if (!enrichmentData) return [];

    const info = [];

    // Check all possible amenities and add them if they have distance data
    if (enrichmentData.beach?.distance) {
      info.push({ type: 'Beach', distance: enrichmentData.beach.distance });
    }
    if (enrichmentData.cafe?.distance) {
      info.push({ type: 'Café', distance: enrichmentData.cafe.distance });
    }
    if (enrichmentData.supermarket?.distance) {
      info.push({ type: 'Supermarket', distance: enrichmentData.supermarket.distance });
    }
    if (enrichmentData.public_transport?.distance) {
      info.push({ type: 'Transport', distance: enrichmentData.public_transport.distance });
    }
    if (enrichmentData.convenience_store?.distance) {
      info.push({ type: 'Store', distance: enrichmentData.convenience_store.distance });
    }
    if (enrichmentData.restaurant_or_fastfood?.distance) {
      info.push({ type: 'Restaurant', distance: enrichmentData.restaurant_or_fastfood.distance });
    }
    if (enrichmentData.nearest_main_town?.distance) {
      info.push({ type: 'Town', distance: enrichmentData.nearest_main_town.distance });
    }
    if (enrichmentData.airport?.distance) {
      info.push({ type: 'Airport', distance: enrichmentData.airport.distance });
    }
    if (enrichmentData.coastline?.distance) {
      info.push({ type: 'Coast', distance: enrichmentData.coastline.distance });
    }

    // Sort by distance (closest first) and return all amenities
    return info.sort((a, b) => a.distance - b.distance);
  };

  // Get active filters summary
  const getActiveFilters = () => {
    const active = [];
    if (appliedFilters.latitude && appliedFilters.longitude) {
      active.push(`Location: ${appliedFilters.latitude.toFixed(2)}, ${appliedFilters.longitude.toFixed(2)} (${appliedFilters.radiusKm}km)`);
    }
    if (appliedFilters.minPrice || appliedFilters.maxPrice) {
      active.push(`Price: €${appliedFilters.minPrice || 0} - €${appliedFilters.maxPrice || '∞'}`);
    }
    if (appliedFilters.minSize || appliedFilters.maxSize) {
      active.push(`Size: ${appliedFilters.minSize || 0} - ${appliedFilters.maxSize || '∞'}m²`);
    }
    if (appliedFilters.maxDistanceToBeach) {
      active.push(`Beach: <${appliedFilters.maxDistanceToBeach}m`);
    }
    if (appliedFilters.maxDistanceToCafe) {
      active.push(`Café: <${appliedFilters.maxDistanceToCafe}m`);
    }
    if (appliedFilters.maxDistanceToSupermarket) {
      active.push(`Supermarket: <${appliedFilters.maxDistanceToSupermarket}m`);
    }
    if (appliedFilters.maxDistanceToPublicTransport) {
      active.push(`Transport: <${appliedFilters.maxDistanceToPublicTransport}m`);
    }
    // Zoning filters summary
    if (appliedFilters.zoningLabelContains) {
      active.push(`Zoning label~"${appliedFilters.zoningLabelContains}"`);
    }
    if (appliedFilters.zoningLabelEnContains) {
      active.push(`Zoning label_en~"${appliedFilters.zoningLabelEnContains}"`);
    }
    if (appliedFilters.zoningTypenameContains) {
      active.push(`Zoning typename~"${appliedFilters.zoningTypenameContains}"`);
    }
    if (appliedFilters.zoningPickedFieldContains) {
      active.push(`Zoning picked_field~"${appliedFilters.zoningPickedFieldContains}"`);
    }
    if (appliedFilters.zoningSourceContains) {
      active.push(`Zoning source~"${appliedFilters.zoningSourceContains}"`);
    }
    if (appliedFilters.zoningTextContains) {
      active.push(`Zoning text~"${appliedFilters.zoningTextContains}"`);
    }
    return active;
  };

  const activeFilters = getActiveFilters();

  // Handle zoom completion from map
  const handleZoomComplete = useCallback(() => {
    setShouldZoomToLocation(false);
  }, []);

  return (
    <div className={`bg-background border-l border-border flex flex-col h-full overflow-hidden ${className}`}>
      {/* Plot details - show when plotId is in URL */}
      {selectedPlotId !== null && (
        <PlotDetails
          plotId={selectedPlotId}
          onBack={handleBackToSearch}
        />
      )}

      {/* Plot search section - always rendered but hidden when viewing details */}
      <div className={selectedPlotId !== null ? 'hidden' : 'flex flex-col h-full'}>
        {/* Header - Mobile optimized */}
        <div className="px-3 md:px-6 py-3 md:py-4 border-b border-border">
          {/* Tab Navigation - Touch friendly */}
          <div className="flex space-x-0.5 mb-2 md:mb-4 p-0.5 border rounded-full">
            <Button
              onClick={() => {
                setActiveTab('browse');
                // Trigger map resize when switching to Browse plots tab
                setTimeout(() => {
                  setResizeKey(prev => prev + 1);
                }, 200);
              }}
              variant={activeTab === 'browse' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1 h-10 md:h-9"
            >
              <Search className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Find </span>Land
            </Button>
            <Button
              onClick={() => setActiveTab('project')}
              variant={activeTab === 'project' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1 h-10 md:h-9"
            >
              <Star className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Your </span>Project
            </Button>
          </div>

          {/* Browse Tab Header */}
          {activeTab === 'browse' && (
            <>
              <div className="flex">
                {/* First column - matches Find Land button width */}
                <div className="flex-1 flex items-center justify-between pr-1">
                  {/* View Toggle */}
                  <div className="flex border border-border rounded-full">
                    <Button
                      onClick={() => {
                        setViewMode('map');
                        // Trigger resize when switching to map view
                        setTimeout(() => {
                          setResizeKey(prev => prev + 1);
                        }, 100);
                      }}
                      variant={viewMode === 'map' ? 'default' : 'ghost'}
                      size="sm"
                      className="rounded-r-none h-8 md:h-9 px-2.5 md:px-3 text-xs md:text-sm"
                    >
                      <MapIcon className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
                      <span className="hidden md:inline">Map</span>
                    </Button>
                    <Button
                      onClick={() => setViewMode('list')}
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      className="rounded-l-none border-l-0 h-8 md:h-9 px-2.5 md:px-3 text-xs md:text-sm"
                    >
                      <List className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
                      <span className="hidden md:inline">List</span>
                    </Button>
                  </div>

                  <Button
                    onClick={() => {
                      setFiltersExpanded(!filtersExpanded);
                      // Trigger map resize after filter animation completes
                      if (viewMode === 'map') {
                        setTimeout(() => {
                          setResizeKey(prev => prev + 1);
                        }, 100);
                      }
                    }}
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 px-2.5 md:px-3 text-xs md:text-sm"
                  >
                    <Filter className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
                    <span className="hidden sm:inline">Filters</span>
                    {filtersExpanded ? <ChevronUp className="w-3 h-3 md:w-4 md:h-4 ml-0.5 md:ml-1" /> : <ChevronDown className="w-3 h-3 md:w-4 md:h-4 ml-0.5 md:ml-1" />}
                  </Button>
                </div>
                {/* Second column - empty spacer to match Your Project button (hidden on mobile) */}
                <div className="hidden md:block flex-1" />
              </div>

              {/* Active Filters Summary - Collapsible on mobile */}
              {!filtersExpanded && activeFilters.length > 0 && (
                <div className="mt-2 md:mt-3">
                  {/* Mobile: Collapsible */}
                  <button
                    onClick={() => setMobileFiltersCollapsed(!mobileFiltersCollapsed)}
                    className="md:hidden flex items-center justify-between w-full text-xs text-muted-foreground py-1"
                  >
                    <span>Active filters ({activeFilters.length})</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${!mobileFiltersCollapsed ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {/* Desktop: Always visible label */}
                  <div className="hidden md:block text-xs text-muted-foreground mb-2">Active filters:</div>
                  
                  {/* Filters - Hidden on mobile when collapsed */}
                  <div className={`flex flex-wrap gap-1 ${mobileFiltersCollapsed ? 'hidden md:flex' : 'flex'} mt-1`}>
                    {activeFilters.map((filter, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] md:text-xs">
                        {filter}
                      </Badge>
                    ))}
                    <Button
                      onClick={() => {
                        const defaultFilters = {
                          page: 1,
                          limit: 20,
                          sortBy: 'price' as const,
                          sortOrder: 'asc' as const,
                          radiusKm: 50,
                          minSize: 50,
                          minPrice: 1000
                        };
                        setFilters(defaultFilters);
                        setAppliedFilters(defaultFilters);
                        setPlaceQuery('');
                      }}
                      variant="ghost"
                      size="sm"
                      className="h-5 md:h-6 px-1.5 md:px-2"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Project Tab Header
          {activeTab === 'project' && (
            <ProjectBanner className="border-0" compact />
          )} */}
        </div>

        {/* Collapsible Filters - Mobile optimized */}
        {activeTab === 'browse' && filtersExpanded && (
          <div className="p-3 md:p-6 space-y-3 md:space-y-4 border-b border-border max-h-[60vh] overflow-y-auto">
            {/* Place Search with Radius */}
            <div className="space-y-2">
              <Label>Location & Radius</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Search places in Portugal... (press Enter)"
                  value={placeQuery}
                  onChange={(e) => setPlaceQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchPlace()}
                  className="flex-1"
                  disabled={placeSearching}
                />
                <Select
                  value={filters.radiusKm?.toString() || '50'}
                  onValueChange={(value) => updateFilter('radiusKm', parseInt(value))}
                >
                  <SelectTrigger className="w-26">
                    <SelectValue placeholder="50km">
                      {filters.radiusKm ? `${filters.radiusKm}km` : '50km'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {filters.radiusKm && ![10, 25, 50, 100].includes(filters.radiusKm) && (
                      <SelectItem value={filters.radiusKm.toString()}>{filters.radiusKm}km</SelectItem>
                    )}
                    <SelectItem value="10">10km</SelectItem>
                    <SelectItem value="25">25km</SelectItem>
                    <SelectItem value="50">50km</SelectItem>
                    <SelectItem value="100">100km</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {placeSearching && (
                <div className="text-xs text-muted-foreground">Searching...</div>
              )}
              {filters.latitude && filters.longitude && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    <MapPin className="w-3 h-3 mr-1" />
                    {filters.latitude.toFixed(4)}, {filters.longitude.toFixed(4)}
                  </Badge>
                  <Button onClick={clearLocation} variant="ghost" size="sm">
                    Clear
                  </Button>
                </div>
              )}
            </div>

            {/* Price and Size Range - Stack on mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-2">
                <Label>Price Range (€)</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.minPrice || ''}
                    onChange={(e) => updateFilter('minPrice', e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.maxPrice || ''}
                    onChange={(e) => updateFilter('maxPrice', e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Size Range (m²)</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.minSize || ''}
                    onChange={(e) => updateFilter('minSize', e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.maxSize || ''}
                    onChange={(e) => updateFilter('maxSize', e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                </div>
              </div>
            </div>

            {/* Distance Filters - 2 cols on mobile, 4 on desktop */}
            <div className="space-y-2">
              <Label className="text-sm">Max Distance to Amenities (m)</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="relative">
                  <Waves className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="Beach"
                    value={filters.maxDistanceToBeach || ''}
                    onChange={(e) => updateFilter('maxDistanceToBeach', e.target.value ? parseInt(e.target.value) : undefined)}
                    className="pl-7"
                  />
                </div>
                <div className="relative">
                  <Coffee className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="Café"
                    value={filters.maxDistanceToCafe || ''}
                    onChange={(e) => updateFilter('maxDistanceToCafe', e.target.value ? parseInt(e.target.value) : undefined)}
                    className="pl-7"
                  />
                </div>
                <div className="relative">
                  <ShoppingCart className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="Supermarket"
                    value={filters.maxDistanceToSupermarket || ''}
                    onChange={(e) => updateFilter('maxDistanceToSupermarket', e.target.value ? parseInt(e.target.value) : undefined)}
                    className="pl-7"
                  />
                </div>
                <div className="relative">
                  <Bus className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="Transport"
                    value={filters.maxDistanceToPublicTransport || ''}
                    onChange={(e) => updateFilter('maxDistanceToPublicTransport', e.target.value ? parseInt(e.target.value) : undefined)}
                    className="pl-7"
                  />
                </div>
              </div>
            </div>

            {/* Zoning Filters */}
            <div className="space-y-2">
              <Label>Zoning (English label contains)</Label>
              <Input
                placeholder="e.g., Residential"
                value={filters.zoningLabelEnContains || ''}
                onChange={(e) => updateFilter('zoningLabelEnContains', e.target.value ? e.target.value : undefined)}
              />
            </div>

            {/* Sort Options */}
            <div className="space-y-2">
              <Label>Sort By</Label>
              <div className="flex gap-2">
                <Select
                  value={filters.sortBy}
                  onValueChange={(value: 'price' | 'size' | 'distance') => updateFilter('sortBy', value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="price">Price</SelectItem>
                    <SelectItem value="size">Size</SelectItem>
                    {filters.latitude && filters.longitude && (
                      <SelectItem value="distance">Distance</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Select
                  value={filters.sortOrder}
                  onValueChange={(value: 'asc' | 'desc') => updateFilter('sortOrder', value)}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">↑</SelectItem>
                    <SelectItem value="desc">↓</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex gap-2">
              <Button onClick={resetFilters} variant="outline" className="flex-1 max-w-40">
                Reset Filters
              </Button>
              <Button onClick={applyFilters} className="flex-1">
                <Search className="w-4 h-4" />
                Apply Filters
              </Button>
            </div>
          </div>
        )}

        {/* Initiate Outreach Button - Show in Browse tab, with loading state when needed */}
        {activeTab === 'browse' && (
          <OutreachComponent
            searchFilters={appliedFilters}
            variant="panel"
            isLoading={isLoading}
            plotsData={plotsData}
          />
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto relative">
          {/* Browse Tab Content - Always mounted */}
          <div className={activeTab === 'browse' ? 'block h-full' : 'hidden h-full'}>
            {/* Map view - always rendered */}
            <div className={viewMode === 'map' ? 'block h-full' : 'hidden'}>
              <PlotsMap
                filters={appliedFilters}
                onPlotClick={handlePlotClick}
                onBoundsChange={handleMapBoundsChange}
                resizeKey={resizeKey}
                shouldZoomToLocation={shouldZoomToLocation}
                onZoomComplete={handleZoomComplete}
                droppedPin={droppedPin}
                showCadastreLayer={true}
                country="PT"
              />
            </div>

            {/* List view - always rendered */}
            <div className={viewMode === 'list' ? 'block h-full' : 'hidden'}>
              {isLoading ? (
                <div className="p-3 md:p-6">
                  <div className="space-y-3 md:space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="bg-muted animate-pulse rounded-lg h-24"></div>
                    ))}
                  </div>
                </div>
              ) : plotsList.length === 0 ? (
                <div className="p-3 md:p-6 text-center text-muted-foreground">
                  No plots found with current filters
                </div>
              ) : (
                <div className="p-3 md:p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                    {plotsList.map((plot) => (
                      <Card
                        key={plot.id}
                        className="overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group"
                        onClick={() => handlePlotClick(plot.id)}
                      >
                        <div className="relative">
                          {/* Image */}
                          {plot.images && plot.images.length > 0 ? (
                            <div className="aspect-[4/3] overflow-hidden">
                              <Image
                                fill
                                quality={100}
                                unoptimized
                                src={plot.images[0]}
                                alt="Plot image"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                          ) : (
                            <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                              <MapPin className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}

                          {/* Price overlay */}
                          <div className="absolute top-3 left-3">
                            <div className="bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg shadow-sm">
                              <span className="font-semibold text-gray-900 text-sm">
                                €{plot.price.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        <CardContent className="p-4 pt-0">
                          <div className="space-y-3">
                            {/* Size and Location */}
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2">
                                <Square className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium">
                                  {plot.size ? plot.size.toLocaleString() + 'm²' : 'Size N/A'}
                                </span>
                              </div>
                              {plot.distanceKm && (
                                <div className="text-sm text-muted-foreground">
                                  {plot.distanceKm.toFixed(1)}km away
                                </div>
                              )}
                            </div>

                            {/* Location coordinates */}
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="w-4 h-4" />
                              <span>
                                {plot.latitude.toFixed(3)}, {plot.longitude.toFixed(3)}
                              </span>
                            </div>

                            {/* Enrichment Info */}
                            {plot.enrichmentData && (
                              <div className="space-y-2">
                                <div className="text-xs font-medium text-muted-foreground">Nearby amenities:</div>
                                <div className="flex flex-wrap gap-1">
                                  {getEnrichmentInfo(plot.enrichmentData as EnrichmentData).slice(0, 4).map((info, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">
                                      {info.type}: {formatDistance(info.distance)}
                                    </Badge>
                                  ))}
                                </div>
                                {/* Zoning info under amenities */}
                                {(plot.enrichmentData as EnrichmentData)?.zoning && (
                                  <div className="space-y-1">
                                    <div className="text-xs font-medium text-muted-foreground">Zoning:</div>
                                    <div className="flex flex-wrap gap-1">
                                      <Badge variant="outline" className="text-xs max-w-full min-w-0">
                                        <span className="block truncate max-w-[180px] md:max-w-[220px]">
                                          {(plot.enrichmentData as EnrichmentData).zoning?.label || 'Unknown'}
                                        </span>
                                      </Badge>
                                      {(plot.enrichmentData as EnrichmentData).zoning?.label_en && (
                                        <Badge variant="outline" className="text-xs max-w-full min-w-0">
                                          <span className="block truncate max-w-[180px] md:max-w-[220px]">
                                            {(plot.enrichmentData as EnrichmentData).zoning?.label_en as string}
                                          </span>
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Pagination - Only show in List view */}
            {viewMode === 'list' && plotsData?.pagination && plotsData.pagination.totalPages > 1 && (
              <div className="p-3 md:p-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Page {plotsData.pagination.page} of {plotsData.pagination.totalPages}
                    ({plotsData.pagination.totalCount} total)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => updateFilter('page', filters.page ? filters.page - 1 : 1)}
                      disabled={!plotsData.pagination.hasPrevPage}
                      variant="outline"
                      size="sm"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => updateFilter('page', filters.page ? filters.page + 1 : 1)}
                      disabled={!plotsData.pagination.hasNextPage}
                      variant="outline"
                      size="sm"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Project Tab Content - Always mounted */}
        <div className={activeTab === 'project' ? 'block h-full overflow-y-auto' : 'hidden h-full'}>
          <div className="h-full overflow-y-auto">
            <div className="p-3 md:p-6 space-y-4 md:space-y-6">
              <ProjectContent
                onPlotClick={handlePlotClick}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 