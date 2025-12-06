# Spanish Cadastre Data - Web Client Integration Guide

## Overview

This guide explains how to read and display Spanish Cadastre data in your web application. The data includes cadastral references, parcel information, and **interactive map visualizations**.

## Data Structure

### Database Query

The enriched cadastre data is stored in the `enriched_plots_stage` table under the `enrichment_data.cadastral` JSONB field.

```sql
-- Get plot with cadastral data
SELECT 
  id,
  latitude,
  longitude,
  enrichment_data
FROM enriched_plots_stage
WHERE id = 'your-plot-id';
```

### Response Format

```json
{
  "id": "08813cfd-f27c-4ded-90fe-2c7c7a32af3f",
  "latitude": 41.49878,
  "longitude": 2.28,
  "enrichment_data": {
    "cadastral": {
      "cadastral_reference": "0044005DF4904S",
      "address": "03",
      "postal_code": null,
      "municipality": "Sant Cugat del Vallès",
      "province": "Barcelona",
      "distance_meters": 33,
      
      "parcel": {
        "cadastral_reference": "0044005DF4904S",
        "area_value": 1021,
        "label": "05",
        "beginning_lifespan": "2010-10-25T00:00:00",
        "reference_point": {
          "type": "Point",
          "coordinates": [2.280290, 41.498485]
        }
      },
      
      "parcels": [ /* Array of all parcels at this location */ ],
      "parcel_count": 1,
      
      "buildings": [ /* Array of buildings */ ],
      "building_count": 0,
      
      "map_images": {
        "wms_url": "http://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx?...",
        "viewer_url": "data:text/html;base64,...",
        "embeddable_html": "<img src=\"...\" />",
        "description": "WMS map images showing cadastral parcels and buildings..."
      }
    }
  }
}
```

## Backend API Endpoint Example

### Node.js / Express

```javascript
// api/plots/:id/cadastre
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.get('/api/plots/:id/cadastre', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT 
        id,
        latitude,
        longitude,
        enrichment_data->'cadastral' as cadastral_data
      FROM enriched_plots_stage
      WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plot not found' });
    }
    
    const plot = result.rows[0];
    
    res.json({
      id: plot.id,
      location: {
        latitude: plot.latitude,
        longitude: plot.longitude
      },
      cadastre: plot.cadastral_data
    });
    
  } catch (error) {
    console.error('Error fetching cadastre data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Python / FastAPI

```python
from fastapi import FastAPI, HTTPException
import asyncpg
import os

app = FastAPI()

@app.get("/api/plots/{plot_id}/cadastre")
async def get_plot_cadastre(plot_id: str):
    conn = await asyncpg.connect(os.getenv('DATABASE_URL'))
    
    try:
        row = await conn.fetchrow("""
            SELECT 
                id,
                latitude,
                longitude,
                enrichment_data->'cadastral' as cadastral_data
            FROM enriched_plots_stage
            WHERE id = $1
        """, plot_id)
        
        if not row:
            raise HTTPException(status_code=404, detail="Plot not found")
        
        return {
            "id": row['id'],
            "location": {
                "latitude": row['latitude'],
                "longitude": row['longitude']
            },
            "cadastre": row['cadastral_data']
        }
    finally:
        await conn.close()
```

## Frontend Integration

### 1. Simple Static Map Image

The easiest way to display the cadastral map.

#### React / Next.js

```jsx
import { useState, useEffect } from 'react';

function CadastreMap({ plotId }) {
  const [cadastre, setCadastre] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch(`/api/plots/${plotId}/cadastre`)
      .then(res => res.json())
      .then(data => {
        setCadastre(data.cadastre);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading cadastre:', err);
        setLoading(false);
      });
  }, [plotId]);
  
  if (loading) return <div>Loading map...</div>;
  if (!cadastre?.map_images) return <div>No map available</div>;
  
  return (
    <div className="cadastre-map">
      <h3>Cadastral Parcel: {cadastre.cadastral_reference}</h3>
      <img 
        src={cadastre.map_images.wms_url}
        alt={`Cadastral map for ${cadastre.cadastral_reference}`}
        style={{ width: '100%', maxWidth: '800px', border: '2px solid #333' }}
      />
      <div className="map-info">
        <p><strong>Municipality:</strong> {cadastre.municipality}</p>
        <p><strong>Area:</strong> {cadastre.parcel?.area_value} m²</p>
        <p><strong>Label:</strong> {cadastre.parcel?.label}</p>
      </div>
    </div>
  );
}
```

#### Vue.js

```vue
<template>
  <div class="cadastre-map">
    <div v-if="loading">Loading map...</div>
    <div v-else-if="!cadastre?.map_images">No map available</div>
    <div v-else>
      <h3>Cadastral Parcel: {{ cadastre.cadastral_reference }}</h3>
      <img 
        :src="cadastre.map_images.wms_url"
        :alt="`Cadastral map for ${cadastre.cadastral_reference}`"
        style="width: 100%; max-width: 800px; border: 2px solid #333;"
      />
      <div class="map-info">
        <p><strong>Municipality:</strong> {{ cadastre.municipality }}</p>
        <p><strong>Area:</strong> {{ cadastre.parcel?.area_value }} m²</p>
        <p><strong>Label:</strong> {{ cadastre.parcel?.label }}</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: ['plotId'],
  data() {
    return {
      cadastre: null,
      loading: true
    };
  },
  mounted() {
    fetch(`/api/plots/${this.plotId}/cadastre`)
      .then(res => res.json())
      .then(data => {
        this.cadastre = data.cadastre;
        this.loading = false;
      })
      .catch(err => {
        console.error('Error loading cadastre:', err);
        this.loading = false;
      });
  }
};
</script>
```

### 2. Embeddable HTML (Simplest)

Use the pre-generated HTML snippet:

```javascript
// Vanilla JavaScript
fetch(`/api/plots/${plotId}/cadastre`)
  .then(res => res.json())
  .then(data => {
    const mapContainer = document.getElementById('cadastre-map');
    mapContainer.innerHTML = data.cadastre.map_images.embeddable_html;
  });
```

### 3. Interactive Leaflet Map (Best UX)

Full interactive map with zoom, pan, and layers.

#### Install Dependencies

```bash
npm install leaflet
npm install @types/leaflet  # If using TypeScript
```

#### React Component

```jsx
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function InteractiveCadastreMap({ plotId }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  
  useEffect(() => {
    fetch(`/api/plots/${plotId}/cadastre`)
      .then(res => res.json())
      .then(data => {
        const { cadastre, location } = data;
        
        // Initialize map
        if (!mapInstanceRef.current) {
          mapInstanceRef.current = L.map(mapRef.current).setView(
            [location.latitude, location.longitude],
            18
          );
        }
        
        const map = mapInstanceRef.current;
        
        // Add OpenStreetMap base layer (optional)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          opacity: 0.3
        }).addTo(map);
        
        // Add Spanish Cadastre WMS layer
        L.tileLayer.wms('http://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx', {
          layers: 'CP.CadastralParcel',
          format: 'image/png',
          transparent: true,
          version: '1.1.1',
          attribution: '© Dirección General del Catastro',
          opacity: 0.8
        }).addTo(map);
        
        // Add buildings layer
        L.tileLayer.wms('http://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx', {
          layers: 'BU.Building',
          format: 'image/png',
          transparent: true,
          version: '1.1.1',
          opacity: 0.7
        }).addTo(map);
        
        // Add marker at plot location
        const marker = L.marker([location.latitude, location.longitude]).addTo(map);
        
        // Add popup with plot info
        marker.bindPopup(`
          <div style="font-family: Arial; min-width: 200px;">
            <h3 style="margin: 0 0 10px 0;">Your Plot</h3>
            <p><strong>Ref:</strong> ${cadastre.cadastral_reference}</p>
            <p><strong>Area:</strong> ${cadastre.parcel?.area_value} m²</p>
            <p><strong>Label:</strong> ${cadastre.parcel?.label}</p>
          </div>
        `).openPopup();
        
        // Add approximate parcel boundary circle
        if (cadastre.parcel?.area_value) {
          const areaM2 = cadastre.parcel.area_value;
          const radiusM = Math.sqrt(areaM2 / Math.PI);
          const refPoint = cadastre.parcel.reference_point?.coordinates || 
                          [location.longitude, location.latitude];
          
          L.circle([refPoint[1], refPoint[0]], {
            color: '#ffff00',
            fillColor: '#ffff00',
            fillOpacity: 0.2,
            radius: radiusM,
            weight: 2
          }).addTo(map).bindTooltip(`Parcel ${cadastre.parcel.label}<br>~${radiusM.toFixed(0)}m radius`);
        }
        
        // Add scale
        L.control.scale().addTo(map);
      });
    
    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [plotId]);
  
  return (
    <div 
      ref={mapRef} 
      style={{ width: '100%', height: '500px' }}
    />
  );
}
```

#### Vue Component

```vue
<template>
  <div ref="mapContainer" style="width: 100%; height: 500px;"></div>
</template>

<script>
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default {
  props: ['plotId'],
  data() {
    return {
      map: null
    };
  },
  mounted() {
    this.initMap();
  },
  beforeUnmount() {
    if (this.map) {
      this.map.remove();
    }
  },
  methods: {
    async initMap() {
      const response = await fetch(`/api/plots/${this.plotId}/cadastre`);
      const data = await response.json();
      const { cadastre, location } = data;
      
      // Initialize map
      this.map = L.map(this.$refs.mapContainer).setView(
        [location.latitude, location.longitude],
        18
      );
      
      // Add base layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        opacity: 0.3
      }).addTo(this.map);
      
      // Add Cadastre WMS layer
      L.tileLayer.wms('http://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx', {
        layers: 'CP.CadastralParcel',
        format: 'image/png',
        transparent: true,
        version: '1.1.1',
        opacity: 0.8
      }).addTo(this.map);
      
      // Add marker
      const marker = L.marker([location.latitude, location.longitude]).addTo(this.map);
      marker.bindPopup(`
        <h3>Your Plot</h3>
        <p><strong>Ref:</strong> ${cadastre.cadastral_reference}</p>
        <p><strong>Area:</strong> ${cadastre.parcel?.area_value} m²</p>
      `).openPopup();
      
      // Add scale
      L.control.scale().addTo(this.map);
    }
  }
};
</script>
```

### 4. Iframe Viewer (Quick & Easy)

Use the pre-generated HTML viewer:

```jsx
function QuickCadastreViewer({ cadastre }) {
  if (!cadastre?.map_images?.viewer_url) {
    return <div>No map available</div>;
  }
  
  return (
    <iframe 
      src={cadastre.map_images.viewer_url}
      width="100%"
      height="600px"
      frameBorder="0"
      title="Cadastral Map Viewer"
      style={{ border: '2px solid #333', borderRadius: '8px' }}
    />
  );
}
```

## Advanced Features

### Multiple Parcels Display

If a location has multiple parcels:

```javascript
function ParcelList({ cadastre }) {
  if (!cadastre.parcels || cadastre.parcels.length === 0) {
    return null;
  }
  
  return (
    <div className="parcel-list">
      <h4>All Parcels at This Location ({cadastre.parcel_count})</h4>
      {cadastre.parcels.map((parcel, idx) => (
        <div key={idx} className="parcel-item">
          <strong>Parcel {parcel.label}</strong>
          <p>Ref: {parcel.cadastral_reference}</p>
          <p>Area: {parcel.area_value} m²</p>
          <p>Date: {new Date(parcel.beginning_lifespan).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
}
```

### Building Information Display

```javascript
function BuildingInfo({ cadastre }) {
  if (!cadastre.buildings || cadastre.buildings.length === 0) {
    return <p>No building data available</p>;
  }
  
  return (
    <div className="building-info">
      <h4>Buildings ({cadastre.building_count})</h4>
      {cadastre.buildings.map((building, idx) => (
        <div key={idx} className="building-item">
          <p><strong>Reference:</strong> {building.reference}</p>
          <p><strong>Current Use:</strong> {building.current_use}</p>
          <p><strong>Dwellings:</strong> {building.number_of_dwellings || 'N/A'}</p>
          <p><strong>Floors:</strong> {building.number_of_floors_above_ground || 'N/A'}</p>
          <p><strong>Construction:</strong> {building.date_of_construction || 'N/A'}</p>
        </div>
      ))}
    </div>
  );
}
```

### Download Map Image

```javascript
async function downloadCadastreMap(cadastre) {
  if (!cadastre?.map_images?.wms_url) return;
  
  try {
    const response = await fetch(cadastre.map_images.wms_url);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `cadastre_${cadastre.cadastral_reference}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading map:', error);
  }
}

// Usage in React
<button onClick={() => downloadCadastreMap(cadastre)}>
  Download Map Image
</button>
```

## Performance Tips

### 1. Lazy Loading

Only load map when needed:

```jsx
import { lazy, Suspense } from 'react';

const CadastreMap = lazy(() => import('./CadastreMap'));

function PlotDetails({ plotId }) {
  const [showMap, setShowMap] = useState(false);
  
  return (
    <div>
      <button onClick={() => setShowMap(true)}>Show Cadastral Map</button>
      
      {showMap && (
        <Suspense fallback={<div>Loading map...</div>}>
          <CadastreMap plotId={plotId} />
        </Suspense>
      )}
    </div>
  );
}
```

### 2. Caching

Cache WMS images:

```javascript
const cadastreCache = new Map();

async function getCadastreData(plotId) {
  if (cadastreCache.has(plotId)) {
    return cadastreCache.get(plotId);
  }
  
  const response = await fetch(`/api/plots/${plotId}/cadastre`);
  const data = await response.json();
  
  cadastreCache.set(plotId, data);
  return data;
}
```

### 3. Image Optimization

Preload images:

```jsx
useEffect(() => {
  if (cadastre?.map_images?.wms_url) {
    const img = new Image();
    img.src = cadastre.map_images.wms_url;
  }
}, [cadastre]);
```

## Error Handling

```javascript
function CadastreMapWithErrors({ plotId }) {
  const [cadastre, setCadastre] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch(`/api/plots/${plotId}/cadastre`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!data.cadastre) {
          throw new Error('No cadastral data available for this plot');
        }
        setCadastre(data.cadastre);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading cadastre:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [plotId]);
  
  if (loading) return <div>Loading cadastral data...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!cadastre?.map_images) return <div>No map data available</div>;
  
  return <img src={cadastre.map_images.wms_url} alt="Cadastral Map" />;
}
```

## Complete Example: Plot Details Page

```jsx
import { useState, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function PlotCadastreDetails({ plotId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('map');
  const mapRef = useRef(null);
  
  useEffect(() => {
    fetch(`/api/plots/${plotId}/cadastre`)
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      });
  }, [plotId]);
  
  if (loading) return <div>Loading...</div>;
  if (!data?.cadastre) return <div>No cadastral data</div>;
  
  const { cadastre, location } = data;
  
  return (
    <div className="plot-details">
      <h2>Plot Cadastral Information</h2>
      
      {/* Tabs */}
      <div className="tabs">
        <button onClick={() => setActiveTab('map')}>Map</button>
        <button onClick={() => setActiveTab('info')}>Information</button>
        <button onClick={() => setActiveTab('parcels')}>Parcels</button>
        {cadastre.building_count > 0 && (
          <button onClick={() => setActiveTab('buildings')}>Buildings</button>
        )}
      </div>
      
      {/* Map Tab */}
      {activeTab === 'map' && (
        <div className="map-container" style={{ height: '500px' }}>
          <img 
            src={cadastre.map_images.wms_url}
            alt="Cadastral Map"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      )}
      
      {/* Info Tab */}
      {activeTab === 'info' && (
        <div className="info-panel">
          <h3>Cadastral Reference: {cadastre.cadastral_reference}</h3>
          <p><strong>Municipality:</strong> {cadastre.municipality}</p>
          <p><strong>Province:</strong> {cadastre.province}</p>
          <p><strong>Address:</strong> {cadastre.address || 'N/A'}</p>
          <p><strong>Postal Code:</strong> {cadastre.postal_code || 'N/A'}</p>
          
          <h4>Parcel Details</h4>
          <p><strong>Label:</strong> {cadastre.parcel?.label}</p>
          <p><strong>Area:</strong> {cadastre.parcel?.area_value} m²</p>
          <p><strong>Registration Date:</strong> {
            new Date(cadastre.parcel?.beginning_lifespan).toLocaleDateString()
          }</p>
        </div>
      )}
      
      {/* Parcels Tab */}
      {activeTab === 'parcels' && (
        <div className="parcels-panel">
          <h3>All Parcels ({cadastre.parcel_count})</h3>
          {cadastre.parcels?.map((parcel, idx) => (
            <div key={idx} className="parcel-card">
              <h4>Parcel {parcel.label}</h4>
              <p>Ref: {parcel.cadastral_reference}</p>
              <p>Area: {parcel.area_value} m²</p>
            </div>
          ))}
        </div>
      )}
      
      {/* Buildings Tab */}
      {activeTab === 'buildings' && cadastre.buildings && (
        <div className="buildings-panel">
          <h3>Buildings ({cadastre.building_count})</h3>
          {cadastre.buildings.map((building, idx) => (
            <div key={idx} className="building-card">
              <p><strong>Use:</strong> {building.current_use}</p>
              <p><strong>Dwellings:</strong> {building.number_of_dwellings}</p>
              <p><strong>Floors:</strong> {building.number_of_floors_above_ground}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Browser Compatibility

- **WMS Images**: All modern browsers (IE11+)
- **Leaflet Maps**: All modern browsers
- **Data URIs**: All browsers (size limit: ~2MB in most browsers)

## Security Considerations

1. **CORS**: WMS URLs are public and allow CORS
2. **Sensitive Data**: Cadastral data is public information
3. **Rate Limiting**: Implement caching to avoid excessive WMS requests
4. **XSS**: Sanitize data when using `dangerouslySetInnerHTML`

## Need Help?

See:
- [STORAGE.md](./STORAGE.md) - Database schema and queries
- [README.md](./README.md) - API documentation
- [Leaflet Documentation](https://leafletjs.com/)
- [Spanish Cadastre API](https://www.catastro.hacienda.gob.es/webinspire/)
