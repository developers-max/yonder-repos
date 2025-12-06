"use client";

import { useState } from "react";
import { Badge } from "@/app/_components/ui/badge";
import { Button } from "@/app/_components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/_components/ui/card";
import {
  ChevronDown,
  ChevronUp,
  MapPin,
  Building2,
  Home,
  FileText,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Info,
  Map,
  Ruler,
  Calendar,
  MapPinned,
} from "lucide-react";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface SpanishParcel {
  cadastral_reference: string;
  area_value?: number;
  label?: string;
  beginning_lifespan?: string;
  valid_from?: string;
  valid_to?: string | null;
  reference_point?: [number, number];
  zoning?: string;
  geometry?: object;
}

interface SpanishBuilding {
  nationalCadastralReference?: string;
  areaValue?: number;
  label?: string;
  constructionYear?: number;
  numberOfFloors?: number;
  numberOfDwellings?: number;
  buildingType?: string;
  geometry?: object;
}

interface SpanishAddress {
  thoroughfareName?: string;
  thoroughfareType?: string;
  postCode?: string;
  postName?: string;
  adminUnit?: string;
  locators?: Array<{
    designator?: string;
    type?: string;
    level?: string;
  }>;
}

interface SpanishCadastralData {
  cadastral_reference?: string;
  address?: string;
  postal_code?: string;
  municipality?: string;
  province?: string;
  distance_meters?: number;
  
  parcel?: SpanishParcel;
  parcels?: SpanishParcel[];
  parcel_count?: number;
  
  building?: SpanishBuilding;
  buildings?: SpanishBuilding[];
  building_count?: number;
  
  addresses?: SpanishAddress[];
  address_count?: number;
  
  map_images?: {
    wms_url?: string;
    viewer_url?: string;
    embeddable_html?: string;
    description?: string;
  };
  
  cadastral_coordinates?: {
    x: number;
    y: number;
    srs: string;
  };
  
  source?: string;
  service_urls?: string[];
  srs?: string;
  notes?: string;
}

interface PortugueseCadastralData {
  cadastral_reference?: string;
  inspire_id?: string;
  label?: string;
  
  parcel_area_m2?: number;
  registration_date?: string;
  administrative_unit?: string;
  municipality_code?: string;
  
  geometry?: object;
  centroid?: [number, number];
  
  bupi_geometry?: object;
  bupi_area_m2?: number;
  bupi_id?: string;
  bupi_source?: string;
  
  distance_meters?: number;
  contains_point?: boolean;
  
  cadastral_coordinates?: {
    longitude: number;
    latitude: number;
    srs: string;
  };
  
  source?: string;
  service_url?: string;
  srs?: string;
  notes?: string;
}

type CadastralData = SpanishCadastralData | PortugueseCadastralData;

interface CadastralInfoDisplayProps {
  cadastralData: CadastralData;
  country: "ES" | "PT";
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function isSpanishData(data: CadastralData): data is SpanishCadastralData {
  return 'parcels' in data || 'buildings' in data || 'addresses' in data;
}

function isPortugueseData(data: CadastralData): data is PortugueseCadastralData {
  return 'inspire_id' in data || 'bupi_geometry' in data || 'bupi_id' in data;
}

function formatArea(area: number | undefined): string {
  if (!area) return "N/A";
  if (area < 1000) return `${area.toFixed(1)} m²`;
  return `${(area / 10000).toFixed(2)} ha`;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "N/A";
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

// ============================================================================
// SPAIN COMPONENTS
// ============================================================================

function SpanishCadastralDisplay({ data }: { data: SpanishCadastralData }) {
  const [expandedSections, setExpandedSections] = useState({
    parcels: false,
    buildings: false,
    addresses: false,
    map: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const hasMultipleParcels = (data.parcel_count ?? 0) > 1;
  const hasBuildings = (data.building_count ?? 0) > 0;
  const hasAddresses = (data.address_count ?? 0) > 0;
  const hasMap = !!data.map_images?.wms_url;

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Cadastral Reference</div>
          <div className="font-mono font-semibold">{data.cadastral_reference || "N/A"}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Address</div>
          <div className="font-medium">{data.address || "N/A"}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Municipality</div>
          <div>{data.municipality || "N/A"}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Province</div>
          <div>{data.province || "N/A"}</div>
        </div>
      </div>

      {/* Primary Parcel Info */}
      {data.parcel && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <CardTitle className="text-base">Primary Parcel</CardTitle>
              </div>
              <Badge variant="outline">{formatArea(data.parcel.area_value)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.parcel.zoning && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Zoning</span>
                <Badge variant="secondary">{data.parcel.zoning}</Badge>
              </div>
            )}
            {data.parcel.beginning_lifespan && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Registered</span>
                <span>{formatDate(data.parcel.beginning_lifespan)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Multiple Parcels */}
      {hasMultipleParcels && data.parcels && (
        <Card>
          <CardHeader className="pb-3">
            <Button
              variant="ghost"
              className="w-full justify-between p-0 h-auto"
              onClick={() => toggleSection('parcels')}
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <CardTitle className="text-base">
                  All Parcels ({data.parcel_count})
                </CardTitle>
              </div>
              {expandedSections.parcels ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CardHeader>
          {expandedSections.parcels && (
            <CardContent className="space-y-3">
              {data.parcels.map((parcel, idx) => (
                <div key={idx} className="border-l-2 border-primary/20 pl-3 space-y-1">
                  <div className="font-mono text-sm">{parcel.cadastral_reference}</div>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>{formatArea(parcel.area_value)}</span>
                    {parcel.zoning && <Badge variant="outline" className="text-xs">{parcel.zoning}</Badge>}
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Buildings */}
      {hasBuildings && data.buildings && (
        <Card>
          <CardHeader className="pb-3">
            <Button
              variant="ghost"
              className="w-full justify-between p-0 h-auto"
              onClick={() => toggleSection('buildings')}
            >
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <CardTitle className="text-base">
                  Buildings ({data.building_count})
                </CardTitle>
              </div>
              {expandedSections.buildings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CardHeader>
          {expandedSections.buildings && (
            <CardContent className="space-y-3">
              {data.buildings.map((building, idx) => (
                <div key={idx} className="border-l-2 border-blue-500/20 pl-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {building.buildingType && (
                      <div>
                        <span className="text-muted-foreground">Type:</span>{" "}
                        <span className="font-medium">{building.buildingType}</span>
                      </div>
                    )}
                    {building.constructionYear && (
                      <div>
                        <span className="text-muted-foreground">Built:</span>{" "}
                        <span className="font-medium">{building.constructionYear}</span>
                      </div>
                    )}
                    {building.numberOfFloors && (
                      <div>
                        <span className="text-muted-foreground">Floors:</span>{" "}
                        <span className="font-medium">{building.numberOfFloors}</span>
                      </div>
                    )}
                    {building.numberOfDwellings && (
                      <div>
                        <span className="text-muted-foreground">Dwellings:</span>{" "}
                        <span className="font-medium">{building.numberOfDwellings}</span>
                      </div>
                    )}
                    {building.areaValue && (
                      <div>
                        <span className="text-muted-foreground">Built Area:</span>{" "}
                        <span className="font-medium">{formatArea(building.areaValue)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Addresses */}
      {hasAddresses && data.addresses && (
        <Card>
          <CardHeader className="pb-3">
            <Button
              variant="ghost"
              className="w-full justify-between p-0 h-auto"
              onClick={() => toggleSection('addresses')}
            >
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                <CardTitle className="text-base">
                  Addresses ({data.address_count})
                </CardTitle>
              </div>
              {expandedSections.addresses ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CardHeader>
          {expandedSections.addresses && (
            <CardContent className="space-y-2">
              {data.addresses.map((addr, idx) => (
                <div key={idx} className="text-sm">
                  <div className="font-medium">
                    {addr.thoroughfareType} {addr.thoroughfareName}
                    {addr.locators && addr.locators[0]?.designator && ` ${addr.locators[0].designator}`}
                  </div>
                  <div className="text-muted-foreground">
                    {addr.postCode} {addr.postName}
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Map Visualization */}
      {hasMap && data.map_images && (
        <Card>
          <CardHeader className="pb-3">
            <Button
              variant="ghost"
              className="w-full justify-between p-0 h-auto"
              onClick={() => toggleSection('map')}
            >
              <div className="flex items-center gap-2">
                <Map className="h-4 w-4" />
                <CardTitle className="text-base">Cadastral Map</CardTitle>
              </div>
              {expandedSections.map ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CardHeader>
          {expandedSections.map && (
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {data.map_images.viewer_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open(data.map_images!.viewer_url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Interactive Viewer
                  </Button>
                )}
                {data.map_images.wms_url && (
                  <div className="border rounded-lg overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={data.map_images.wms_url} 
                      alt="Cadastral Map"
                      className="w-full h-auto"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Source Info */}
      <div className="text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Info className="h-3 w-3" />
          <span>Source: {data.source || "Spanish Cadastre"}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PORTUGAL COMPONENTS
// ============================================================================

function PortugueseCadastralDisplay({ data }: { data: PortugueseCadastralData }) {
  const [showValidation, setShowValidation] = useState(false);
  
  const hasBUPiData = !!data.bupi_id;
  const isDGTPrimary = data.source?.includes('DGT');
  const areaDiscrepancy = hasBUPiData && data.parcel_area_m2 && data.bupi_area_m2
    ? Math.abs(data.parcel_area_m2 - data.bupi_area_m2)
    : 0;
  const discrepancyPercent = hasBUPiData && data.parcel_area_m2 && areaDiscrepancy
    ? (areaDiscrepancy / data.parcel_area_m2) * 100
    : 0;

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Cadastral Reference</div>
          <div className="font-mono font-semibold">{data.cadastral_reference || "N/A"}</div>
        </div>
        {data.inspire_id && (
          <div>
            <div className="text-sm text-muted-foreground">INSPIRE ID</div>
            <div className="font-mono text-sm">{data.inspire_id}</div>
          </div>
        )}
        {data.label && (
          <div>
            <div className="text-sm text-muted-foreground">Label</div>
            <div>{data.label}</div>
          </div>
        )}
        {data.municipality_code && (
          <div>
            <div className="text-sm text-muted-foreground">Municipality Code</div>
            <div>{data.municipality_code}</div>
          </div>
        )}
      </div>

      {/* Primary Parcel Info */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <CardTitle className="text-base">Parcel Information</CardTitle>
            </div>
            <Badge variant={isDGTPrimary ? "default" : "secondary"}>
              {isDGTPrimary ? "Official DGT" : "BUPi RGG"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Ruler className="h-3 w-3" />
                Area
              </div>
              <div className="font-semibold">{formatArea(data.parcel_area_m2)}</div>
            </div>
            {data.registration_date && (
              <div>
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Registered
                </div>
                <div>{formatDate(data.registration_date)}</div>
              </div>
            )}
          </div>

          {/* Accuracy Indicators */}
          <div className="flex gap-2 flex-wrap">
            {data.contains_point !== undefined && (
              <Badge variant={data.contains_point ? "default" : "outline"} className="text-xs">
                {data.contains_point ? (
                  <><CheckCircle2 className="h-3 w-3 mr-1" /> Point Inside</>
                ) : (
                  <><AlertCircle className="h-3 w-3 mr-1" /> Point Outside</>
                )}
              </Badge>
            )}
            {data.distance_meters !== undefined && data.distance_meters > 0 && (
              <Badge variant="outline" className="text-xs">
                <MapPinned className="h-3 w-3 mr-1" />
                ~{Math.round(data.distance_meters)}m away
              </Badge>
            )}
          </div>

          {data.centroid && (
            <div className="text-xs text-muted-foreground">
              Centroid: {data.centroid[0].toFixed(6)}, {data.centroid[1].toFixed(6)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dual-Source Validation */}
      {hasBUPiData && (
        <Card>
          <CardHeader className="pb-3">
            <Button
              variant="ghost"
              className="w-full justify-between p-0 h-auto"
              onClick={() => setShowValidation(!showValidation)}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <CardTitle className="text-base">Cross-Validation Data</CardTitle>
                {discrepancyPercent > 10 && (
                  <Badge variant="destructive" className="text-xs">
                    {discrepancyPercent.toFixed(1)}% diff
                  </Badge>
                )}
              </div>
              {showValidation ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CardHeader>
          {showValidation && (
            <CardContent className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">BUPi Data Available</span>
                  <Badge variant="secondary">Crowd-sourced</Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">BUPi ID</div>
                    <div className="font-mono">{data.bupi_id}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">BUPi Area</div>
                    <div className="font-semibold">{formatArea(data.bupi_area_m2)}</div>
                  </div>
                </div>

                {areaDiscrepancy > 0 && (
                  <div className="pt-2 border-t">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Area Discrepancy: </span>
                      <span className={discrepancyPercent > 10 ? "text-destructive font-semibold" : "text-muted-foreground"}>
                        {areaDiscrepancy.toFixed(1)} m² ({discrepancyPercent.toFixed(1)}%)
                      </span>
                    </div>
                    {discrepancyPercent > 10 && (
                      <div className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                        <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>Significant difference detected. May indicate boundary changes or measurement errors.</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  Source: {data.bupi_source}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Source Info */}
      <div className="text-xs text-muted-foreground space-y-1">
        <div className="flex items-center gap-1">
          <Info className="h-3 w-3" />
          <span>Primary Source: {data.source || "Portugal Cadastre"}</span>
        </div>
        {data.notes && (
          <div className="pl-4 text-muted-foreground/80">{data.notes}</div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CadastralInfoDisplay({ 
  cadastralData, 
  country 
}: CadastralInfoDisplayProps) {
  if (!cadastralData) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No cadastral data available</p>
        </CardContent>
      </Card>
    );
  }

  // Auto-detect country if not provided
  const detectedCountry = country || (isSpanishData(cadastralData) ? "ES" : "PT");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Cadastral Information
            </CardTitle>
            <CardDescription>
              {detectedCountry === "ES" ? "Spanish Cadastre (Dirección General del Catastro)" : "Portugal Cadastre (DGT + BUPi)"}
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-lg px-3 py-1">
            {detectedCountry}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {detectedCountry === "ES" && isSpanishData(cadastralData) ? (
          <SpanishCadastralDisplay data={cadastralData} />
        ) : detectedCountry === "PT" && isPortugueseData(cadastralData) ? (
          <PortugueseCadastralDisplay data={cadastralData} />
        ) : (
          <div className="text-center text-muted-foreground py-4">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>Unable to display cadastral data for this country</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
