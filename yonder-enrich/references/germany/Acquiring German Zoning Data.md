

# **Acquisition of German Land Use and Zoning Data: A Strategic and Technical Guide**

## **Section 1: Understanding the German Spatial Planning and Data Landscape**

Acquiring a comprehensive, nationwide dataset for land use and zoning in Germany requires navigating a complex, federated data infrastructure. Unlike centralized systems, data authority in Germany is distributed across three government levels: the federal government (*Bund*), the 16 states (*Länder*), and the municipalities (*Kommunen*). This structure is the primary determinant of any data acquisition strategy.

### **1.1 Dissecting German Federalism: The Tri-Layered System (Bund, Länder, Kommunen)**

The foundational challenge in acquiring German "zoning" data is that the legal authority for it does not reside at the national level. Legally binding urban land use planning, known as *Bauleitplanung*, is the exclusive domain of the municipalities (*Kommunen*).

* **Municipalities (*Kommunen*):** These (numbering over 10,000) are responsible for creating, adopting, and publishing the specific, legally binding zoning plans.  
* **States (*Länder*):** The 16 states provide the legal framework for the municipalities and, critically for data acquisition, often serve as data aggregators or hosts for their respective municipalities.  
* **Federal Government (*Bund*):** The federal government sets broad national policy (e.g., the Federal Building Code or *Baugesetzbuch*), but primarily provides foundational geodata (such as topography and administrative boundaries) and strategic, high-level spatial planning.

This tri-layered system means that a "country-wide" zoning dataset does not exist as a single file or service. It must be constructed as an *aggregation* of thousands of disparate municipal datasets, discoverable via state and federal portals.

### **1.2 The National Hub: Germany's Spatial Data Infrastructure (GDI-DE)**

The *Geodateninfrastruktur Deutschland* (GDI-DE) is the joint national project by the federal, state, and local authorities to standardize and link these federated data sources.1 It is the primary starting point for any data discovery operation.

The GDI-DE's central access point is **Geoportal.de**.1 It is essential to understand that this portal is a *metadata catalog*—it functions as a "card catalog for geodata" rather than a direct data host. A search on Geoportal.de will *point* a researcher to the relevant data, which is typically hosted on a state (*Länder*) or municipal (*Kommunen*) server.1

### **1.3 The European Framework: The Role of the INSPIRE Directive**

Germany's GDI-DE is not an isolated system; it is the national implementation of and contribution to the European Union's INSPIRE Directive.1 INSPIRE (Infrastructure for Spatial Information in Europe) mandates the harmonization of spatial data across member states to support environmental and other policies.5

This creates a parallel discovery tool: the **INSPIRE Geoportal**.6 A researcher must employ a dual-portal strategy:

1. **Geoportal.de (National):** This portal should be used to discover *all* available German geodata, which will often be in its native, non-harmonized format.  
2. **INSPIRE Geoportal (European):** This portal should be used specifically to find data that has *already been harmonized* to EU standards. For zoning, the most relevant INSPIRE theme is "Planned Land Use" (Annex III).5

### **1.4 Distinguishing Critical Data Categories**

The term "land usage" is ambiguous. To successfully acquire the correct data, one must distinguish between "what is" (physical land cover) and "what is permitted" (legal land use).

#### **1.4.1 Land Cover (Physical) vs. Land Use (Legal)**

Many datasets, such as the **CORINE Land Cover (CLC)** dataset provided by the *Bundesamt für Kartographie und Geodäsie* (BKG), describe the physical state of the land (e.g., forests, industrial areas, pastures).8 This is *land cover*.

For zoning, however, the critical data is *planned land use* (*Bauleitplanung*). A real estate developer, for example, is not concerned with a field's current use as "pasture" (land cover) but whether it is *zoned* for "residential development" (planned land use).9 This report will focus on acquiring this latter category of legally binding planned use.

#### **1.4.2 Cadastral Data (Liegenschaftskataster)**

The *Liegenschaftskataster* (real estate cadaster) is the official registry of all land parcels and buildings.11 This dataset, often referred to as ALKIS (Amtliches Liegenschaftskatasterinformationssystem), defines the legal parcel boundaries. The zoning data (*Bebauungspläne*) functions as a *thematic overlay* on top of this cadastral base. A complete, parcel-specific analysis requires acquiring *both* datasets: the cadaster (from the state surveying agencies) to define the parcel boundaries, and the B-Plan (from the municipalities) to define the permitted use for that parcel.

#### **1.4.3 Federal Spatial Planning (Raumordnung)**

Federal-level agencies like the *Bundesinstitut für Bau-, Stadt- und Raumforschung* (BBSR) provide high-level spatial *observation* (*Raumbeobachtung*) and regional strategic plans (*Raumordnung*).12 They also provide invaluable socio-economic context via indicators (e.g., INKAR).15 This data is analogous to a regional strategic plan, not a specific, legally binding zoning ordinance. It provides the "why" (strategic context) for the municipalities' "what" (legal zoning).

## **Section 2: Germany's Core Zoning Data: *Bauleitplanung***

The German equivalent of zoning is *Bauleitplanung* (urban land use planning). This system is composed of two distinct plan types, both of which are the primary targets for acquisition. These terms are the essential keywords for all data searches.

### **2.1 The Two-Tiered Municipal System**

#### **2.1.1 The Preparatory Plan: Flächennutzungsplan (F-Plan)**

The *Flächennutzungsplan* (F-Plan), or preparatory land use plan, is a strategic document that outlines the intended land use for the *entire* municipal area. It is a large-scale, non-binding plan that guides future development. F-Plan data services have been identified from states and cities like Hamburg 16, Brandenburg 18, and Bayern.9

#### **2.1.2 The Legally Binding "Zoning" Plan: Bebauungsplan (B-Plan)**

The *Bebauungsplan* (B-Plan), or binding development plan, is the *core dataset* for any zoning analysis. This is the direct German equivalent of a legally binding zoning map. It is parcel-specific and legally dictates the *Art der baulichen Nutzung* (type of permitted use, e.g., residential, commercial) and the *Maß der baulichen Nutzung* (intensity of use, e.g., building height, floor-area ratio). The widespread availability of B-Plan data services confirms its central importance.9

### **2.2 The Technical Standard for Interoperability: XPlanung / XPlanGML**

Given that this critical B-Plan and F-Plan data is created and held by thousands of individual municipalities, a national-scale aggregation would be technically impossible if each used a proprietary format.

The solution, and the technical lynchpin upon which any nationwide project depends, is the **XPlanung** standard (also known as XPlanGML).23 XPlanung is a standardized, GML-based (Geography Markup Language) data model for *all* German spatial planning documents. Municipalities create their plans in this format, which allows state-level portals (like in Nordrhein-Westfalen 26 or Niedersachsen 25) to aggregate and serve them in a standard, machine-readable way. Any data acquisition system must be prepared to parse XPlanGML.

### **Table 1: German Spatial Planning Terminology**

To navigate the German data portals, a clear understanding of the terminology is essential.

| German Term | Abbreviation | Planning Level | English / Functional Equivalent | Description |
| :---- | :---- | :---- | :---- | :---- |
| **Bauleitplanung** | (B-Plan, F-Plan) | Municipal | Urban Land Use Planning | The overarching term for the two-tiered municipal planning system.9 |
| **Bebauungsplan** | B-Plan | Municipal | Binding Development Plan (Zoning) | The legally binding, parcel-specific zoning ordinance. *This is the primary data target*.28 |
| **Flächennutzungsplan** | F-Plan | Municipal | Preparatory Land Use Plan | The strategic, non-binding land use plan for an entire municipality.16 |
| **Raumordnung** | \- | Federal / State | Spatial Planning / Regional Planning | High-level strategic planning, not legally binding at the parcel level.12 |
| **Liegenschaftskataster** | ALKIS | State / Municipal | Real Estate Cadaster | The official parcel map. The *Bebauungsplan* is an overlay on this base map.11 |
| **XPlanung** | XPlanGML | All Levels | Planning Data Standard (GML) | The standardized GML data model that enables the exchange and aggregation of planning data.23 |

## **Section 3: Data Acquisition Strategy I: The Centralized Discovery Approach**

The first acquisition strategy involves using the "top-down" discovery portals to find the "bottom-up" data sources.

### **3.1 Querying the National Catalog (Geoportal.de)**

The primary search portal is **Geoportal.de**.4 A methodological search involves:

1. Using the German terms defined in Section 2 (e.g., "Bebauungsplan," "Flächennutzungsplan," "XPlanung").  
2. Filtering results by resource type, specifically for machine-readable *Geodienste* (geoservices) like "WFS" (Web Feature Service) or "download".29  
3. Analyzing the metadata of the search results to find the service endpoint (URL) of the *Länder* or *Kommunen* server that hosts the data. This portal acts as the central metadata hub, as evidenced by data from cities like Mannheim being provided to the GDI-DE.30

### **3.2 Querying the European Catalog (INSPIRE Geoportal)**

A parallel search should be run on the **INSPIRE Geoportal**.6 Here, the search term must be the harmonized EU theme: **"Planned Land Use"**.5 This is the most effective way to find data that has already been standardized and aggregated, such as the INSPIRE-compliant service for Planned Land Use for Germany's exclusive economic zone 7 or the aggregated state service for Nordrhein-Westfalen.26

### **3.3 Leveraging Federal Agency Services (BKG & BBSR)**

A complete analysis requires more than just the zoning data. It requires the foundational and contextual data provided by federal agencies. A full analytical dataset is a "three-layer sandwich" synthesized from all three government levels.

1. **Foundation Layer (BKG):** The *Bundesamt für Kartographie und Geodäsie* (BKG) provides the "canvas." Researchers must acquire essential base layers from the BKG, such as administrative boundaries (e.g., NUTS regions) 31, geocoding services (WFS) for addresses 11, and topographic maps.4  
2. **Legal Layer (Kommunen):** This is the core *Bebauungsplan* (zoning) data acquired from the municipal/state portals as detailed in Section 4\.  
3. **Contextual Layer (BBSR):** The *Bundesinstitut für Bau-, Stadt- und Raumforschung* (BBSR) provides the "strategic context." Researchers can acquire high-level *Raumordnung* data 14 and critical socio-economic indicators (*INKAR*) 15 to analyze and contextualize the municipal zoning decisions.

No single source is sufficient. A robust analysis must acquire and synthesize data from all three levels.

## **Section 4: Data Acquisition Strategy II: A State-by-State (Länder) Compendium**

The core of the acquisition process involves a state-by-state approach. The 16 *Länder* (listed in Geoportal.de 34) serve as the critical aggregation points for their municipalities. However, their aggregation models differ significantly. Some provide a single, central service, while most provide a *catalog* of municipal services.

### **Table 2: Data Acquisition Matrix for German States (Länder)**

| Staat (Länder) | Geoportal Name | Aggregation Model | Access Service | Key Endpoint / Metadata Link |
| :---- | :---- | :---- | :---- | :---- |
| **Baden-Württemberg** | Geoportal-BW 30 | Aggregated State-Level Service | WFS | https://www.geoportal-raumordnung-bw.de/ows/services/org.1.7c61f5dd-b978-476c-8f95-64839e68bc71\_wfs?SERVICE=WFS\&Request=GetCapabilities 22 |
| **Bayern (Bavaria)** | Geoportal Bayern 9 | Federated (Municipal) Catalog | WMS / WFS | Search portal for "Bebauungsplan" or "Flächennutzungsplan".9 Data is held by municipalities.27 |
| **Berlin** | Geoportal Berlin / FIS-Broker 10 | Aggregated State-Level Service | WFS | Metadata: .../metadata/bfd3b920-03ad-36dc-9372-dc6e9084ee29.10 Endpoint: https://fbinter.stadt-berlin.de/fb/wfs/data.36 |
| **Brandenburg** | Geoportal Brandenburg 34 | Federated (Municipal) Catalog | WFS | Search portal for "Bebauungsplan" 37 or "Flächennutzungsplan" 18 to find municipal service metadata (e.g., for Wildau, Hohen Neuendorf). |
| **Bremen** | Geoportal Bremen 34 | Aggregated State-Level Service | WFS | Metadata search for "WFS Bebauungspläne Stadt Bremen" 38 and "WFS Vorhabenbezogene Bebauungspläne".40 |
| **Hamburg** | Geoportal Hamburg 34 | Aggregated State-Level Service | WFS | F-Plan WFS: https://geodienste.hamburg.de/HH\_WFS\_FNP?SERVICE=WFS\&REQUEST=GetCapabilities.17 |
| **Hessen (Hesse)** | Geoportal Hessen 34 | Federated (Regional/Municipal) Catalog | WFS | Regional F-Plan WFS: https://mapservice.region-frankfurt.de/arcgis/services/Regionalverband/regfnp\_hauptkarte\_planstand\_wfs/MapServer/WFSServer?....19 Municipal B-Plan services listed individually.19 |
| **Mecklenburg-Vorpommern** | GeoPortal.MV 34 | Federated (Municipal) Catalog | WFS | Search portal for municipal B-Plan WFS (e.g., Stadt Hagenow).20 |
| **Niedersachsen** | Geodatenportal Niedersachsen 34 | Federated (Municipal) Catalog | WFS | Search portal catalog for "Bauleitpläne" (3,400+ services).25 Data is XPlanung 5.2.25 |
| **Nordrhein-Westfalen (NRW)** | Geoportal.NRW 34 | **Aggregated State-Level Service** | **OGC-API Features** | **Endpoint: https://ogc-api.nrw.de/inspire-lu-bplan/api?f=json**.26 |
| **Rheinland-Pfalz** | Geoportal Rheinland-Pfalz 34 | Federated (Municipal) Catalog | WFS | Search portal for "bplan" \+ town name.44 Central WFS for *Offenlagen* (plans under review) available.45 |
| **Saarland** | Geoportal Saarland 34 | Federated (Municipal) Catalog | WFS | Search portal for municipal B-Plan 46 and F-Plan services.47 |
| **Sachsen (Saxony)** | Geoportal Sachsen 34 | Federated (Municipal WFS) / Aggregated (State WMS) | WFS / WMS | State-level "RAPIS" is WMS (images).48 WFS (vector) must be acquired from municipalities (e.g., Dresden WFS: https://kommisdd.dresden.de/net3/public/ogc.ashx?NodeId=545... 49). |
| **Sachsen-Anhalt** | Geoportal Sachsen-Anhalt 34 | Aggregated State-Level Service | WFS | Metadata search for "WFS. Bauleitpläne Information" or "WFS. Geoportal/Bebauungsplan Information".50 |
| **Schleswig-Holstein** | Geoportal Schleswig-Holstein (GDI-SH) 34 | Federated (Municipal) Catalog | WFS | Search GDI-SH metadata catalog for "Bauleitpläne" WFS 2.0 services.51 |
| **Thüringen (Thuringia)** | Geoportal Thüringen (GDI-Th) 34 | Aggregated State-Level Service | WFS | WFS (B-Plan/F-Plan extents): https://www.geoproxy.geoportal-th.de/geoproxy/services/geobasis/bauleitplanung\_wfs.21 (Note: Service provides vector extents and raster URLs 21). |

### **4.1 State-by-State Data Service Analysis**

* **Aggregated State Services (Best-Case):**  
  * **Nordrhein-Westfalen (NRW)** represents the "gold standard" and the model for future data infrastructure. Rather than providing a simple catalog, NRW provides a *single, central, aggregated service* for B-Plans and F-Plans *for the entire state*.26 Municipalities feed their standardized data into this central pot. This service is accessible via a modern OGC-API, not a legacy WFS.26  
  * **Baden-Württemberg** provides a central WFS for *Bebauungspläne*.22  
  * The city-states of **Berlin**, **Bremen**, and **Hamburg** naturally provide central services.17  
  * **Thüringen** and **Sachsen-Anhalt** also provide central WFS services, although Thüringen's is a hybrid model that provides vector *extents* with URLs pointing to the *raster* plan documents.21  
* **Federated Catalog Services (Standard Case):**  
  * Most states operate as *metadata catalogs* of municipal services. This includes **Bayern** 27, **Brandenburg** 18, **Hessen** 19, **Mecklenburg-Vorpommern** 20, **Niedersachsen** 25, **Rheinland-Pfalz** 44, **Saarland** 47, and **Schleswig-Holstein**.51  
  * For these states, an acquisition script cannot simply connect to one URL. It must first query the state's portal (typically via a CSW-catalog service) to retrieve a list of all municipal WFS endpoints, and then iterate through that list. The scale of this is evidenced by Niedersachsen's portal, which catalogs over 3,400 *Bauleitpläne* services.25  
* **Hybrid and Complex Cases:**  
  * **Sachsen (Saxony):** This state presents a mixed case. The state-level "RAPIS" service provides a comprehensive *WMS* (Web Map Service), which is useful for *viewing* plan extents as images but is not machine-readable vector data.48 To acquire the vector data, one must connect to individual municipal WFS services, such as the one for Dresden.49  
  * **Berlin:** Data acquisition for Berlin requires "data archaeology." The official portal documentation *intentionally* points to an abstract metadata page rather than the direct service URL.10 To find the machine-readable endpoint, one must cross-reference deep metadata records (which list the connect point https://fbinter.stadt-berlin.de/fb/wfs/data 36) with third-party technical guides that provide a different, fully-formed GetFeature-style connection string.54

## **Section 5: Technical Acquisition Strategy III: Accessing *Geodienste* (Geoservices)**

Once the service endpoints are discovered, a technical GIS analyst must connect to them. The data is accessed via OGC (Open Geospatial Consortium) standards, primarily the legacy WFS and the modern OGC-API.

### **5.1 The "Classic" Method: Web Feature Service (WFS)**

A WFS (Web Feature Service) is the standard for requesting *vector data* (the raw points, lines, and polygons) over the web. This is distinct from a WMS (Web Map Service), which returns only a *static image* of the map.54

The standard WFS acquisition workflow is a three-step process:

1. **GetCapabilities:** Send a GetCapabilities request to the service URL (e.g., the WFS endpoint for Hamburg 17 or Baden-Württemberg 22). This returns a large XML file describing the service.  
2. **Parse Capabilities:** Parse this XML to identify the specific FeatureType (i.e., dataset layer) to be queried. For example, the Berlin B-Plan layer is identified as fis:re\_bplan.54  
3. **GetFeature:** Send a GetFeature request for the desired FeatureType to download the actual data, which is typically returned in GML format.

### **5.2 A Practical Example: The ogr2ogr "Rosetta Stone"**

The GDAL ogr2ogr command-line utility is the most powerful tool for this process. A blog post detailing the acquisition of Berlin data provides a "Rosetta Stone" command for this workflow 54:

ogr2ogr \-s\_srs EPSG:25833 \-t\_srs WGS84 \-f geoJSON plan.geojson \\ WFS:"http://fbinter.stadt-berlin.de/fb/wfs/geometry/senstadt/re\_bplan?typenames=GML2" re\_bplan

A breakdown of this command reveals critical technical requirements:

* ogr2ogr: The vector data conversion tool.  
* \-s\_srs EPSG:25833: This is **the most critical part**. It defines the *source coordinate reference system*. German data is *not* in standard WGS84 (latitude/longitude). It is almost always in a projected system like ETRS89 / UTM (e.g., Zone 32N 22) or DHDN / Gauss-Krüger.22 Any acquisition script *must* handle this reprojection.  
* \-t\_srs WGS84: This transforms the data from its native projection into the standard global WGS84 system.  
* \-f geoJSON: This converts the data from its native GML format to the more modern and web-friendly GeoJSON.  
* WFS:"...": This is the WFS connection string, which includes the GetFeature parameters.  
* The same source notes a common pitfall: coordinate order (e.g., \[Latitude, Longitude\] vs. \[Longitude, Latitude\]) must be checked after conversion.54

### **5.3 The "Modern" Method: OGC-API Features**

The technical landscape is migrating away from complex XML-based WFS to simpler, JSON-based RESTful APIs. The "gold standard" NRW service is an example of this.26

* **Legacy WFS (XML):** https://fbinter.stadt-berlin.de/fb/wfs/data 36  
* **Modern OGC-API (JSON):** https://ogc-api.nrw.de/inspire-lu-bplan/api?f=json 26

An acquisition architecture built today must be "bilingual." It must be able to parse the complex XML responses from the majority of legacy WFS 1.1/2.0 services, while also being able to consume the simple JSON responses from modern OGC-API Features services.

## **Section 6: Synthesis and Strategic Recommendations**

Acquiring a nationwide zoning dataset for Germany is a feasible but highly complex data engineering task. A simple list of download links will fail, as the data landscape is dynamic and federated.

### **6.1 Data Aggregation: The "Patchwork Quilt" Problem**

The final aggregated national dataset will be a "patchwork quilt" with significant variations in quality, content, and completeness.

* **Varying Quality:** Data will not be uniformly parcel-sharp. Some municipal data (like for Kerpen) is explicitly noted as being at a 1:5000 scale, though it is in the process of being improved.55  
* **Varying Content:** The services are not standardized. Some (like in Thüringen) may only provide the *Geltungsbereiche* (the polygon *extents* of the plans) with URLs pointing to non-vector raster maps.21 Others may provide the full, vectorized *Nutzungsflächen* (the specific use zones within the plan).  
* **Varying Completeness:** Many municipalities, particularly smaller rural ones, may not have digitized their plans at all. There will be gaps in the national map.

### **6.2 Legal and Licensing Considerations**

The data is not uniformly "open."

* **Usage Restrictions:** Many datasets come with disclaimers, such as Thüringen's note of "ohne Gewähr für deren Vollständigkeit, Richtigkeit" (no guarantee of completeness or correctness).21  
* **Fees and Licenses:** While much data is free, some services may have restrictions or fees. BKG services, for example, explicitly mention *Gebühren* (fees) and *Nutzungsbedingungen* (terms of use).32 Other data is provided under specific "by-attribution" licenses, such as Hamburg's "Datenlizenz Deutschland Namensnennung Version 2.0".17  
* **Compliance:** Any acquisition system must be designed to programmatically track the *Nutzungsbedingungen* (terms) and *Quellenvermerk* (attribution source) for *every* dataset consumed.

### **6.3 Concluding Expert Recommendation: The "Two-Stage Federated Acquisition Robot"**

A static approach to data acquisition will fail. The only viable and maintainable strategy for building a national zoning dataset for Germany is to create a dynamic, federated acquisition script—a "Two-Stage Robot."

* **Stage 1: Acquire Aggregated States.** The script's first task is to connect *directly* to the known, state-level aggregated services. This includes the OGC-API for **Nordrhein-Westfalen** 26 and the central WFS services for **Baden-Württemberg** 22, **Thüringen** 21, and the city-states (**Berlin**, **Bremen**, **Hamburg**). This is the "low-hanging fruit" and covers a significant portion of the population.  
* **Stage 2: Spider Federated States.** For all remaining states (e.g., **Niedersachsen**, **Bayern**, **Hessen**, **Brandenburg**), the script must execute a more complex, multi-step process:  
  1. **Query Catalog:** Connect to the state's metadata catalog service (CSW \- Catalog Service for the Web).  
  2. **Harvest Endpoints:** Programmatically query the catalog for all records matching keywords like "Bebauungsplan" or "XPlanung" and resource type "WFS".  
  3. **Parse and De-duplicate:** Parse the thousands of resulting metadata records (e.g., the 3,400+ from Niedersachsen 25) to extract the unique WFS/OGC-API endpoints for *each municipality*.  
  4. **Iterate and Acquire:** Iterate through this dynamically generated list, connecting to each municipal service one by one to acquire its data.

This two-stage, hybrid approach is the only realistic methodology to construct—and, more importantly, *maintain*—a comprehensive national planned land use dataset for Germany.

#### **Works cited**

1. GDI-DE, accessed on October 24, 2025, [https://gdi-de.org/](https://gdi-de.org/)  
2. Willkommen bei der GDI-DE | Geodateninfrastruktur Deutschland, accessed on October 24, 2025, [https://www.gdi-de.org/](https://www.gdi-de.org/)  
3. Geoportal.de | Geodateninfrastruktur Deutschland \- GDI-DE, accessed on October 24, 2025, [https://www.gdi-de.org/en/SDI/components/Geoportal.de](https://www.gdi-de.org/en/SDI/components/Geoportal.de)  
4. Geoportal.de, accessed on October 24, 2025, [https://www.geoportal.de/](https://www.geoportal.de/)  
5. The INSPIRE Database and Geoportal | The European Network for Rural Development (ENRD), accessed on October 24, 2025, [https://ec.europa.eu/enrd/evaluation/knowledge-bank/inspire-database-and-geoportal\_en.html](https://ec.europa.eu/enrd/evaluation/knowledge-bank/inspire-database-and-geoportal_en.html)  
6. INSPIRE Geoportal, accessed on October 24, 2025, [https://inspire-geoportal.ec.europa.eu/](https://inspire-geoportal.ec.europa.eu/)  
7. Planned Land Use (Maritime Spatial Planning) \- INSPIRE Geoportal, accessed on October 24, 2025, [https://inspire-geoportal.ec.europa.eu/srv/api/records/e8121619-5bf5-4abc-98a6-ee024dcfb288](https://inspire-geoportal.ec.europa.eu/srv/api/records/e8121619-5bf5-4abc-98a6-ee024dcfb288)  
8. INSPIRE Land Cover CLC5 2018, accessed on October 24, 2025, [https://inspire-geoportal.ec.europa.eu/srv/api/records/4CE24067-37A0-4395-A641-64CC80121470?language=all](https://inspire-geoportal.ec.europa.eu/srv/api/records/4CE24067-37A0-4395-A641-64CC80121470?language=all)  
9. Bauleitpläne Bayern (Umringe) \- Geoportal Bayern \- details, accessed on October 24, 2025, [https://geoportal.bayern.de/geoportalbayern/anwendungen/details?ret=dienste\&anc=73ff4959-749d-42eb-b604-c587524ade0b\&resId=73ff4959-749d-42eb-b604-c587524ade0b](https://geoportal.bayern.de/geoportalbayern/anwendungen/details?ret=dienste&anc=73ff4959-749d-42eb-b604-c587524ade0b&resId=73ff4959-749d-42eb-b604-c587524ade0b)  
10. Anzeige der Rechneradresse der Dienste WMS und WFS \- Berlin.de, accessed on October 24, 2025, [https://www.berlin.de/sen/sbw/\_assets/stadtdaten/geoportal/aktuelles/rechneradresse-finden.pdf?ts=1691740470](https://www.berlin.de/sen/sbw/_assets/stadtdaten/geoportal/aktuelles/rechneradresse-finden.pdf?ts=1691740470)  
11. WFS Geokodierungsdienst der AdV für Adressen und Geonamen, accessed on October 24, 2025, [https://advmis.geodatenzentrum.de/trefferanzeige;jsessionid=9A9668876A0189221103E670FC7D4D04?docuuid=1bc988b7-157a-4fc8-8069-a8c22a1e904a](https://advmis.geodatenzentrum.de/trefferanzeige;jsessionid=9A9668876A0189221103E670FC7D4D04?docuuid=1bc988b7-157a-4fc8-8069-a8c22a1e904a)  
12. Veröffentlichungen \- Geoinformationen in der Raumplanung \- BBSR, accessed on October 24, 2025, [https://www.bbsr.bund.de/BBSR/DE/veroeffentlichungen/izr/2020/3/izr-3-2020.html](https://www.bbsr.bund.de/BBSR/DE/veroeffentlichungen/izr/2020/3/izr-3-2020.html)  
13. Geo-Dienste \- Raumbeobachtung \- BBSR, accessed on October 24, 2025, [https://www.bbsr.bund.de/BBSR/DE/forschung/raumbeobachtung/interaktive-anwendungen/geo-dienste/geodienste.html](https://www.bbsr.bund.de/BBSR/DE/forschung/raumbeobachtung/interaktive-anwendungen/geo-dienste/geodienste.html)  
14. Wohnungsmarkt | MetaVer, accessed on October 24, 2025, [https://metaver.de/trefferanzeige?docuuid=03b14238-b8b0-45f1-8f0a-698794732675](https://metaver.de/trefferanzeige?docuuid=03b14238-b8b0-45f1-8f0a-698794732675)  
15. INKAR \- BBSR, accessed on October 24, 2025, [https://www.inkar.de/](https://www.inkar.de/)  
16. geoportal-hamburg.de, accessed on October 24, 2025, [https://geoportal-hamburg.de/urbandataplatform/datasets.csv](https://geoportal-hamburg.de/urbandataplatform/datasets.csv)  
17. WFS Flächennutzungsplan Hamburg (FNP) \- Fachthema \- MetaVer, accessed on October 24, 2025, [https://metaver.de/trefferanzeige?docuuid=66197CA4-2839-4563-8218-D8B8677D5C79](https://metaver.de/trefferanzeige?docuuid=66197CA4-2839-4563-8218-D8B8677D5C79)  
18. Flächennutzungsplan \- Stadt Wildau (WFS) \- Geoportal Brandenburg \- Detailansichtdienst, accessed on October 24, 2025, [https://geoportal.brandenburg.de/detailansichtdienst/render?url=https://geoportal.brandenburg.de/gs-json/xml?fileid=dfb8c67d-6f59-4a20-aae3-0b786719e4e3](https://geoportal.brandenburg.de/detailansichtdienst/render?url=https://geoportal.brandenburg.de/gs-json/xml?fileid%3Ddfb8c67d-6f59-4a20-aae3-0b786719e4e3)  
19. Offene Geodaten des Landes Hessen \- Geoportal Hessen \- hessen.de, accessed on October 24, 2025, [https://www.geoportal.hessen.de/spatial-objects/](https://www.geoportal.hessen.de/spatial-objects/)  
20. B-Plan Nr. 41 der Stadt Hagenow (WFS) \- GeoPortal.MV, accessed on October 24, 2025, [https://www.geoportal-mv.de/portal/Suche/Metadatenuebersicht/Details/B-Plan%20Nr.%2041%20der%20Stadt%20Hagenow%20(WFS)/be81deed-c100-45ef-8d7a-b0d7a637eeb4](https://www.geoportal-mv.de/portal/Suche/Metadatenuebersicht/Details/B-Plan%20Nr.%2041%20der%20Stadt%20Hagenow%20\(WFS\)/be81deed-c100-45ef-8d7a-b0d7a637eeb4)  
21. WFS Geltungsbereiche Bauleitplanung \- GeoMIS.Th, accessed on October 24, 2025, [https://geomis.geoportal-th.de/geonetwork/srv/api/records/8f4bac19-a7c1-487b-8294-6062edee811d](https://geomis.geoportal-th.de/geonetwork/srv/api/records/8f4bac19-a7c1-487b-8294-6062edee811d)  
22. WFS AROK BPL landesweit \- INSPIRE Geoportal, accessed on October 24, 2025, [https://inspire-geoportal.ec.europa.eu/srv/api/records/6442e0d0-5e0e-46a6-9e1b-387ac3166d78?language=all](https://inspire-geoportal.ec.europa.eu/srv/api/records/6442e0d0-5e0e-46a6-9e1b-387ac3166d78?language=all)  
23. WFS XPlanung BPL „Mitte (Ursprungsplan)“ \- Geoportal.de, accessed on October 24, 2025, [https://www.geoportal.de/Metadata/e1be7c80-92fb-40dd-abde-159e16c7c29c](https://www.geoportal.de/Metadata/e1be7c80-92fb-40dd-abde-159e16c7c29c)  
24. WFS INSPIRE BPL Kurze Straße, Seepfad, Querstraße, accessed on October 24, 2025, [https://inspire-geoportal.ec.europa.eu/srv/api/records/d555e6af-02f5-48a3-85c1-bfe4b806e49c](https://inspire-geoportal.ec.europa.eu/srv/api/records/d555e6af-02f5-48a3-85c1-bfe4b806e49c)  
25. Bauleitpläne \- Alte Geodatensuche Niedersachsen \- Koordinierungsstelle GDI-NI, accessed on October 24, 2025, [https://geoportal.geodaten.niedersachsen.de/harvest/r0om67/search?keyword=Bauleitpl%C3%A4ne](https://geoportal.geodaten.niedersachsen.de/harvest/r0om67/search?keyword=Bauleitpl%C3%A4ne)  
26. OGC-API Bauleitplanung in NRW (INSPIRE) \- INSPIRE Geoportal, accessed on October 24, 2025, [https://inspire-geoportal.ec.europa.eu/srv/api/records/b9e45388-b761-497f-9fa6-a02a76bc9376?language=all](https://inspire-geoportal.ec.europa.eu/srv/api/records/b9e45388-b761-497f-9fa6-a02a76bc9376?language=all)  
27. Schriftliche Anfrage Drs. 18/21083 des Abgeordneten Benjamin Adjei BÜNDNIS 90/DIE GRÜNEN vom 21.12.2021: Open Data: Die Bereit \- Bayerischer Landtag, accessed on October 24, 2025, [https://www1.bayern.landtag.de/www/ElanTextAblage\_WP18/Drucksachen/Schriftliche%20Anfragen/18\_0021083.pdf](https://www1.bayern.landtag.de/www/ElanTextAblage_WP18/Drucksachen/Schriftliche%20Anfragen/18_0021083.pdf)  
28. Bebauungspläne mit Veränderungssperre der Stadt Bremen \- INSPIRE Geoportal, accessed on October 24, 2025, [https://inspire-geoportal.ec.europa.eu/srv/api/records/18A353FF-9382-4DE1-9273-D5932ABCB6C4](https://inspire-geoportal.ec.europa.eu/srv/api/records/18A353FF-9382-4DE1-9273-D5932ABCB6C4)  
29. www.geodatenkatalog.de (S2F) \- Bundesamt für Kartographie und Geodäsie (BKG), accessed on October 24, 2025, [https://gdk.gdi-de.org/geonetwork/srv/search?keyword=DownloadService](https://gdk.gdi-de.org/geonetwork/srv/search?keyword=DownloadService)  
30. Geodatendienste \- Geoportal Mannheim, accessed on October 24, 2025, [https://geoportal-mannheim.de/geodatendienste/](https://geoportal-mannheim.de/geodatendienste/)  
31. Webdienste, accessed on October 24, 2025, [https://gdz.bkg.bund.de/index.php/default/webdienste.html](https://gdz.bkg.bund.de/index.php/default/webdienste.html)  
32. https://sg.geodatenzentrum.de/wfs\_ortssuche?REQUEST=GetCapabilities\&SERVICE=WFS, accessed on October 24, 2025, [https://sg.geodatenzentrum.de/wfs\_ortssuche?REQUEST=GetCapabilities\&SERVICE=WFS](https://sg.geodatenzentrum.de/wfs_ortssuche?REQUEST=GetCapabilities&SERVICE=WFS)  
33. WFS Geokodierungsdienst der AdV für Adressen und Geonamen (wfs\_geokodierung) \- Geodatenzentrum, accessed on October 24, 2025, [https://gdz.bkg.bund.de/index.php/default/wfs-geokodierungsdienst-der-adv-fur-adressen-und-geonamen-wfs-geokodierung.html](https://gdz.bkg.bund.de/index.php/default/wfs-geokodierungsdienst-der-adv-fur-adressen-und-geonamen-wfs-geokodierung.html)  
34. Geoportale der Länder, accessed on October 24, 2025, [https://www.geoportal.de/Anwendungen/Geoportale%20der%20L%C3%A4nder.html](https://www.geoportal.de/Anwendungen/Geoportale%20der%20L%C3%A4nder.html)  
35. Bauleitpläne Bayern (Umringe) \- Geoportal Bayern \- details \- Bayerische Staatsregierung, accessed on October 24, 2025, [https://geoportal.bayern.de/geoportalbayern/anwendungen/details?\&resId=73ff4959-749d-42eb-b604-c587524ade0b](https://geoportal.bayern.de/geoportalbayern/anwendungen/details?&resId=73ff4959-749d-42eb-b604-c587524ade0b)  
36. Bebauungspläne, vorhabenbezogene Bebauungspläne ... \- GDI-DE, accessed on October 24, 2025, [https://gdk-inspire-1.ffm.gdi-de.org/geonetwork/srv/api/records/bfd3b920-03ad-36dc-9372-dc6e9084ee29](https://gdk-inspire-1.ffm.gdi-de.org/geonetwork/srv/api/records/bfd3b920-03ad-36dc-9372-dc6e9084ee29)  
37. Bebauungsplan noerdlich Hubertusallee der Stadt Hohen Neuendorf OT Borgsdorf (WFS) \- Geoportal Brandenburg \- Detailansichtdienst, accessed on October 24, 2025, [https://geoportal.brandenburg.de/detailansichtdienst/render?url=https://geoportal.brandenburg.de/gs-json/xml?fileid=3bd582af-7374-4397-a772-07d74ee18641](https://geoportal.brandenburg.de/detailansichtdienst/render?url=https://geoportal.brandenburg.de/gs-json/xml?fileid%3D3bd582af-7374-4397-a772-07d74ee18641)  
38. WFS Bebauungspläne Stadt Bremen | MetaVer, accessed on October 24, 2025, [https://www.metaver.de/trefferanzeige?docuuid=5D9CD342-0D3A-44CD-98B4-2818BC4C61DF\&rstart=20770¤tSelectorPage=1\&f=](https://www.metaver.de/trefferanzeige?docuuid=5D9CD342-0D3A-44CD-98B4-2818BC4C61DF&rstart=20770&currentSelectorPage=1&f)  
39. WFS Bebauungspläne Stadt Bremen, accessed on October 24, 2025, [https://dev-gdk-p.ffm.gdi-de.org/geonetwork/srv/api/records/5D9CD342-0D3A-44CD-98B4-2818BC4C61DF](https://dev-gdk-p.ffm.gdi-de.org/geonetwork/srv/api/records/5D9CD342-0D3A-44CD-98B4-2818BC4C61DF)  
40. Projektrelaterede udviklingsplaner Bremen \- data.europa.eu \- European Union, accessed on October 24, 2025, [https://data.europa.eu/data/datasets/f6ee04ce-3412-4ff4-bc66-6fade2307c57?locale=da](https://data.europa.eu/data/datasets/f6ee04ce-3412-4ff4-bc66-6fade2307c57?locale=da)  
41. Freitextsuche nach Informationen | MetaVer, accessed on October 24, 2025, [https://www.metaver.de/freitextsuche?plugid=%2Fingrid-group%3Aiplug-csw-dsc-gdi-sl\&docid=Lbv88HEBadkC-N9-hcvh\&provider=sn%3Bhh\&sn=sn\_statistik%3Bsn\_werdau.de%3Bsn\_lfulg%3Bsn\_l%3Bsn\_naturparke%3Bsn\_grimma%3Bsn\_av%3Bsn\_saena%3Bsn\_brv%3Bsn\_lk\_vogtland%3Bsn\_lk\_nordsachsen%3Bsn\_pirna.de%3Bsn\_landratsamt-pirna.de+%3Bsn\_uni\_l%3Bsn\_zwickau.de%3Bsn\_bautzen%3Bsn\_erzgebirgskreis.de%3Bsn\_geosn%3Bsn\_lk\_leipzig%3Bsn\_chemnitz%3Bsn\_delitzsch.de%3Bsn\_ldc\&metadata\_group=1%3B4%3B5%3B3\&type=inspire%3Badv\&modtime=older\_five\_years](https://www.metaver.de/freitextsuche?plugid=/ingrid-group:iplug-csw-dsc-gdi-sl&docid=Lbv88HEBadkC-N9-hcvh&provider=sn;hh&sn=sn_statistik;sn_werdau.de;sn_lfulg;sn_l;sn_naturparke;sn_grimma;sn_av;sn_saena;sn_brv;sn_lk_vogtland;sn_lk_nordsachsen;sn_pirna.de;sn_landratsamt-pirna.de+;sn_uni_l;sn_zwickau.de;sn_bautzen;sn_erzgebirgskreis.de;sn_geosn;sn_lk_leipzig;sn_chemnitz;sn_delitzsch.de;sn_ldc&metadata_group=1;4;5;3&type=inspire;adv&modtime=older_five_years)  
42. B-Plan Nr. 40 der Stadt Hagenow (WFS) \- GeoPortal.MV, accessed on October 24, 2025, [https://www.geoportal-mv.de/portal/Suche/Metadatenuebersicht/Details/B-Plan%20Nr.%2040%20der%20Stadt%20Hagenow%20(WFS)/d81a3f6f-db04-485c-be54-7fceb9959513](https://www.geoportal-mv.de/portal/Suche/Metadatenuebersicht/Details/B-Plan%20Nr.%2040%20der%20Stadt%20Hagenow%20\(WFS\)/d81a3f6f-db04-485c-be54-7fceb9959513)  
43. Geoportal.de, accessed on October 24, 2025, [https://www.geoportal.de/search.html?q=Hildesheim\&filter.datenanbieter=Stadt%20Hildesheim\&style=narrow](https://www.geoportal.de/search.html?q=Hildesheim&filter.datenanbieter=Stadt+Hildesheim&style=narrow)  
44. Inhaltsverzeichnis \- Geoportal RLP, accessed on October 24, 2025, [https://www.geoportal.rlp.de/article/Suchverfahren/](https://www.geoportal.rlp.de/article/Suchverfahren/)  
45. Offenlagen gem. §4a (4) BauGB (63) \- APIs der Geodaten des ..., accessed on October 24, 2025, [https://www.geoportal.rlp.de/spatial-objects/363/collections/offenlagen\_baugb\_rlp](https://www.geoportal.rlp.de/spatial-objects/363/collections/offenlagen_baugb_rlp)  
46. INSPIRE ATOM Feed Client \- GeoPortal Saarland \- saarland.de, accessed on October 24, 2025, [https://geoportal.saarland.de/mapbender/plugins/mb\_downloadFeedClient.php?url=https%3A%2F%2Fgeoportal.saarland.de%2Fmapbender%2Fphp%2Fmod\_inspireDownloadFeed.php%3Fid%3D498FF98A-525C-43E6-80E8-DD9D97871D1F%26type%3DSERVICE%26generateFrom%3Dwfs%26wfsid%3D368](https://geoportal.saarland.de/mapbender/plugins/mb_downloadFeedClient.php?url=https://geoportal.saarland.de/mapbender/php/mod_inspireDownloadFeed.php?id%3D498FF98A-525C-43E6-80E8-DD9D97871D1F%26type%3DSERVICE%26generateFrom%3Dwfs%26wfsid%3D368)  
47. INSPIRE ATOM Feed Client \- GeoPortal Saarland, accessed on October 24, 2025, [https://geoportal.saarland.de/mapbender/plugins/mb\_downloadFeedClient.php?url=https%3A%2F%2Fgeoportal.saarland.de%2Fmapbender%2Fphp%2Fmod\_inspireDownloadFeed.php%3Fid%3D226DF2A5-941D-4C89-AC1B-2181366386DF%26type%3DSERVICE%26generateFrom%3Ddataurl%26layerid%3D39734](https://geoportal.saarland.de/mapbender/plugins/mb_downloadFeedClient.php?url=https://geoportal.saarland.de/mapbender/php/mod_inspireDownloadFeed.php?id%3D226DF2A5-941D-4C89-AC1B-2181366386DF%26type%3DSERVICE%26generateFrom%3Ddataurl%26layerid%3D39734)  
48. RAPIS: Bebauungspläne im Freistaat Sachsen (freier WMS-Dienst) \- GDI-DE, accessed on October 24, 2025, [https://gdk.gdi-de.org/geonetwork/srv/api/records/b974d0cd-8d49-4060-8ee9-f1ef384d9403](https://gdk.gdi-de.org/geonetwork/srv/api/records/b974d0cd-8d49-4060-8ee9-f1ef384d9403)  
49. DOWNLOADDIENST.xml \- sachsen.de, accessed on October 24, 2025, [https://geoportal.sachsen.de/portal/IndexDaten/GEOINFORMATIONEN/DIENST/DOWNLOADDIENST/DOWNLOADDIENST.xml](https://geoportal.sachsen.de/portal/IndexDaten/GEOINFORMATIONEN/DIENST/DOWNLOADDIENST/DOWNLOADDIENST.xml)  
50. Bauleitplanung der Gemeinde Kabelsketal \- MetaVer, accessed on October 24, 2025, [https://www.metaver.de/trefferanzeige;jsessionid=4F433643312A3F02C83BD5DA216CD28A?docuuid=326889BF-B38F-4B27-96ED-FF3FE1937E73\&rstart=25580¤tSelectorPage=1\&f=](https://www.metaver.de/trefferanzeige;jsessionid=4F433643312A3F02C83BD5DA216CD28A?docuuid=326889BF-B38F-4B27-96ED-FF3FE1937E73&rstart=25580&currentSelectorPage=1&f)  
51. Geschäftsbereich Geokompetenzzentrum \- MetaVer, accessed on October 24, 2025, [https://metaver.de/trefferanzeige?docuuid=6DD6F05E-1F21-11D3-8C95-0060086D3699\&isAddress=true](https://metaver.de/trefferanzeige?docuuid=6DD6F05E-1F21-11D3-8C95-0060086D3699&isAddress=true)  
52. vorläufigeNiederschrift\_32 öffentlich \- GDI-DE Wiki, accessed on October 24, 2025, [https://wiki.gdi-de.org/download/attachments/14876851/Niederschrift\_LG\_GDI-SH-32\_oe.pdf?version=1\&modificationDate=1629288216961\&api=v2](https://wiki.gdi-de.org/download/attachments/14876851/Niederschrift_LG_GDI-SH-32_oe.pdf?version=1&modificationDate=1629288216961&api=v2)  
53. https://kommisdd.dresden.de/net3/public/ogc.ashx?NodeId, accessed on October 24, 2025, [https://kommisdd.dresden.de/net3/public/ogc.ashx?NodeId=545\&Service=WFS\&REQUEST=GetCapabilities](https://kommisdd.dresden.de/net3/public/ogc.ashx?NodeId=545&Service=WFS&REQUEST=GetCapabilities)  
54. Daten aus dem FIS-Broker nutzen \- Bürger baut Stadt, accessed on October 24, 2025, [https://blog.buergerbautstadt.de/daten-aus-dem-fis-broker-nutzen/](https://blog.buergerbautstadt.de/daten-aus-dem-fis-broker-nutzen/)  
55. WFS-Dienst für Bauleitpläne in der Stadt Kerpen \- Geoportal.de, accessed on October 24, 2025, [https://www.geoportal.de/Metadata/4689b8ba-e009-4a86-95de-4c8ac178666d](https://www.geoportal.de/Metadata/4689b8ba-e009-4a86-95de-4c8ac178666d)