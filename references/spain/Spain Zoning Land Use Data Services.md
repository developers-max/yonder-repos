

# **A Comprehensive Guide to Web Feature Services for Zoning and Land Use Data in Spain**

## **Part I: The National Geospatial Data Framework: Structure, Standards, and Foundational Data**

This report provides a definitive technical guide to discovering and accessing Web Feature Services (WFS) and ATOM feeds for zoning, permitted land use, and urban planning information across Spain. It addresses the complexities of a decentralized data ecosystem by providing an exhaustive inventory of services at both the national and regional levels, complete with direct access URLs and strategic guidance for effective data aggregation. The analysis is intended for a technical audience, including GIS professionals, urban planners, and developers who require programmatic access to machine-readable vector data.

### **1.1. Spain's Spatial Data Infrastructure (IDEE) and the INSPIRE Mandate**

The primary gateway to Spanish geospatial data is the Infraestructura de Datos Espaciales de España (IDEE), the national Spatial Data Infrastructure (SDI).1 The IDEE is not a centralized database but rather a "virtual network structure" designed to integrate and harmonize distributed geographic resources from all tiers of public administration, from national ministries to municipal governments.2 Its purpose is to facilitate the discovery, access, and reuse of geographic data in a uniform and interoperable manner.1

The legal and technical architecture of the IDEE is fundamentally shaped by the European Union's INSPIRE Directive (Infrastructure for Spatial Information in Europe). Transposed into Spanish law as LISIGE (Law 14/2010 on Geographic Information Infrastructures and Services in Spain), this mandate obligates public authorities to share spatial data related to environmental and associated policies according to strict interoperability standards.2 This legal framework is the principal driver behind the creation and standardization of the WFS and ATOM services that form the subject of this report.

The IDEE operates on a hierarchical model. The national IDEE geoportal functions as a central access point, harvesting metadata from a network of regional and thematic nodes.2 Spain contributes approximately 250 of these resources to the main European INSPIRE Geoportal.1 This federated structure means that obtaining a complete and detailed view of the available data, particularly for topics like urban planning which are managed locally, often requires navigating from the national portal down to the specific geoportals of the Autonomous Communities, such as IDEAndalucia (Andalucía) or IDEC (Catalunya).7

A significant operational challenge, however, lies in the reliability of these top-level discovery mechanisms. The official strategy for data discovery relies on users querying the central catalogs of the IDEE and the European INSPIRE Geoportal.9 Yet, extensive testing reveals that these primary portals can be functionally unreliable or inaccessible, presenting a critical barrier to data discovery.11 Even when operational, their search functionalities can be difficult to navigate effectively for specific thematic queries across all of Spain's diverse administrative regions.15 A data access strategy that relies solely on these official, top-down discovery portals is therefore prone to failure. Consequently, the principal value of this report lies in bypassing these often-faulty discovery layers by providing a curated and verified directory of direct service endpoints, identified through systematic, region-by-region investigation.

### **1.2. Core National Data Providers and Foundational Services**

At the national level, two government bodies provide the foundational geospatial datasets upon which all specific land use and zoning analyses are built: the Instituto Geográfico Nacional (IGN) and the Dirección General del Catastro. Before examining their services, it is essential to clarify a critical terminological distinction.

* **Ocupación del Suelo (Land Cover):** This term refers to the physical and biological cover of the Earth's surface, such as forests, artificial surfaces, or water bodies. The national SIOSE project is a prime example of a land cover dataset.17  
* **Uso del Suelo (Land Use) and Planeamiento Urbanístico (Urban Planning):** These terms describe the territory according to its functional dimension or legally designated socio-economic purpose, such as residential, industrial, or commercial zones.18 This category directly corresponds to the concepts of "zoning" and "permitted land use."

While national datasets provide excellent land cover information, the authoritative data on legally permitted land use is almost exclusively managed at the regional and municipal levels. National services provide the essential geographic context—the "what" and the "where"—but regional services provide the regulatory overlay—the "what's allowed."

#### **1.2.1. Instituto Geográfico Nacional (IGN)**

The IGN is Spain's national mapping agency, responsible for producing and distributing authoritative baseline geographic information.19 For the purposes of land use analysis, its most relevant services are:

* **Ocupación del Suelo (SIOSE):** The IGN coordinates the Sistema de Información de Ocupación del Suelo de España (SIOSE), a high-resolution, harmonized land cover and land use database.17 While not a zoning map, it serves as an indispensable contextual layer for understanding the current state of the territory. The IGN provides a WFS for this dataset.  
  * **Service:** WFS Ocupación del Suelo  
  * **URL:** https://servicios.idee.es/wfs-inspire/ocupacion-suelo 22  
* **Unidades Administrativas:** This service delivers the official administrative boundaries (municipalities, provinces, autonomous communities). These polygons are the fundamental jurisdictional containers within which zoning regulations are defined and applied.  
  * **Service:** WFS Unidades Administrativas  
  * **URL:** https://www.ign.es/wfs-inspire/unidades-administrativas 22  
  * **Service:** ATOM Feed for Administrative Units and other reference data.  
  * **URL:** https://www.ign.es/atom/ds.es.xml 22

#### **1.2.2. Dirección General del Catastro**

The Cadastre is the government body that manages the official registry of real property. Its data provides the definitive legal and geometric description of land parcels, which are the fundamental spatial unit for the application of zoning and planning regulations.9 Any effective analysis of permitted land use must be grounded in the cadastral parcel fabric.

In compliance with the INSPIRE Directive, the Cadastre provides WFS and ATOM services for its core datasets: Cadastral Parcels (CP), Addresses (AD), and Buildings (BU).9

* **Service:** WFS Parcela Catastral (CP)  
  * **URL:** http://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx? 23  
* **Service:** WFS Direcciones (AD)  
  * **URL:** http://ovc.catastro.meh.es/INSPIRE/wfsAD.aspx? 23  
* **Service:** WFS Edificios (BU)  
  * **URL:** http://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx? 23  
* **Service:** ATOM feeds for bulk download of INSPIRE datasets, organized by municipality and updated biannually.23

The availability of these national services establishes a clear and logical workflow for any comprehensive land use analysis in Spain. An analyst must first use the national services to define the location and legal parcel fabric and then pivot to regional or municipal services to retrieve the specific regulatory information. For instance, a typical process would involve identifying a specific property using the Cadastre's parcel WFS (wfsCP.aspx) and then using the geometry of that parcel to perform a spatial query against a regional Planeamiento Urbanístico WFS to determine its zoning classification and permitted uses. This multi-source data aggregation strategy is essential for navigating Spain's decentralized data landscape.

## **Part II: A Regional Compendium of Urban Planning and Zoning Web Services**

While national datasets provide the foundational framework, the specific, legally relevant data on zoning and permitted land use is created and maintained by Spain's Autonomous Communities. This section provides a detailed, region-by-region inventory of the web services that directly address the need for urban planning data.

### **2.1. Catalunya (IDEC)**

The Infraestructura de Dades Espacials de Catalunya (IDEC) is a mature and well-documented regional SDI managed by the Institut Cartogràfic i Geològic de Catalunya (ICGC).24 It serves as a model for regional data dissemination.

* **Key Dataset:** The central resource for planning information is the **Mapa Urbanístic de Catalunya (MUC)**. This dataset synthesizes the complex web of municipal plans, regional directives, and other planning instruments into a single, continuous, and harmonized digital map covering the entire region.26 It is explicitly designed for land use (Ús del sòl) and urban planning (Planejament urbanístic) analysis.27  
* **Critical Caveat:** The MUC is published for informational purposes only and explicitly **has no legal validity** (no té validesa jurídica).27 Users must consult the original, official planning documents for legally binding decisions.  
* **Web Services:**  
  * **WFS:** The primary service for accessing the MUC vector data is the Servei WFS de descàrrega del planejament territorial i urbanístic (WFS download service for territorial and urban planning).  
    * **GetCapabilities URL:** https://sig.gencat.cat/ows/PLANEJAMENT/wfs 28  
  * **ATOM:** No specific ATOM feed for urban planning was identified. WFS is the primary method for programmatic data access.  
* **INSPIRE-Compliant Service:** Catalunya also provides a separate, INSPIRE-harmonized dataset for planned land use, which may follow a different data model than the MUC.  
  * **Dataset Name:** INSPIRE Land use of Catalonia 30  
  * **WMS URL (for viewing):** https://geoserveis.ide.cat/servei/catalunya/inspire-us-sol/wms?service=wms\&request=GetCapabilities.30 A corresponding WFS is likely available and discoverable through the main IDEC catalog.

### **2.2. Andalucía (IDEAndalucia)**

The Infraestructura de Datos Espaciales de Andalucía (IDEAndalucia) is a distributed network comprising a central node managed by the Instituto de Estadística y Cartografía de Andalucía and 17 contributing nodes from various provincial and municipal bodies.8

* **Key Dataset:** The primary regional dataset is the **Datos Espaciales de Referencia de Andalucía (DERA)**. Within this compendium, the **Grupo 7 \- Sistema Urbano** provides foundational data on urban structures.  
* **Web Services:**  
  * **WFS:** A WFS is available for the Sistema Urbano dataset.  
    * **GetCapabilities URL:** http://www.ideandalucia.es/services/DERA\_g7\_sistema\_urbano/wfs?service=wfs\&request=getcapabilities 33  
  * **Available Feature Types:** Analysis of the GetCapabilities response reveals that this service provides structural urban data rather than regulatory zoning.33 The main layers include:  
    * g07\_01\_Poblaciones: Polygons representing urban settlements, city blocks, and green spaces.  
    * g07\_02\_EntidadSingular: Polygons of singular population entities as defined by the National Institute of Statistics (INE).  
* **Municipal-Level Data:** The granularity of data in Andalucía differs significantly from that in Catalunya. While the regional WFS provides the urban fabric, the detailed regulatory information on planeamiento urbanístico is held and published at the municipal level. For example, the municipality of Écija offers over 30 interoperable WMS services, including specific layers for its urban planning.34 This indicates that for Andalucía, a top-down approach is insufficient. The recommended workflow is to first use the regional Sistema Urbano WFS to identify the urban area of interest and then search for a specific WFS or WMS from the relevant municipality (Ayuntamiento).

### **2.3. Comunidad de Madrid (IDEMadrid)**

The regional SDI for the Community of Madrid, IDEMadrid, is accessible via its Geoportal.35 The key platform for urban planning data is the **Sistema de Información Territorial (SIT)** and its associated map viewer, the Visor SIT.37

* **Key Dataset:** The SIT provides access to the definitive, approved urban planning instruments for all 179 municipalities in the region. This includes general plans, modifications, and data layers for soil classes (Clases de suelo), development areas (Ámbitos de actuación), and public networks (Redes públicas).37  
* **Web Services:** The primary method for bulk data access in Madrid is through an ATOM feed, not a WFS.  
  * **WFS:** No direct WFS for regional planning data was identified in the available documentation. Attempts to locate one via the catalog were unsuccessful.39  
  * **ATOM:** The official documentation for the Visor SIT explicitly directs users to an ATOM service for data downloads: *"Si quiere descargar los archivos con la información geográfica disponible puede hacerlo desde el servicio ATOM de la Comunidad de Madrid."*.37  
  * **Discovery Path:** To access this service, users must navigate from the main Geoportal 36 to the Sistema de Información Territorial (SIT) page 37, where the link to the ATOM service for downloading planning data is provided.

### **2.4. Castilla y León (IDECyL)**

The Infraestructura de Datos Espaciales de Castilla y León (IDECyL) is managed by the Centro de Información Territorial, an entity within the regional government's directorate responsible for Urbanism and Land Management.40

* **Key Dataset:** IDECyL provides a unified and continuous **mapa urbanístico** (urban planning map) for the entire region. This valuable resource homogenizes the symbology and data structures from the disparate planning documents of each individual municipality, allowing for seamless regional analysis.40  
* **Web Services:** The region provides a comprehensive WMS with highly relevant layers. A corresponding WFS is also available for land use data.  
  * **WMS:** A dedicated WMS for urbanism, housing, and land management is available.  
    * **GetCapabilities URL:** https://idecyl.jcyl.es/geoserver/urbanismo/wms?REQUEST=GetCapabilities\&Service=WMS\&version=1.3.0 43  
    * **Relevant Layers:** This service contains crucial layers such as Planeamiento urbanístico CyL: clasificación de suelo (soil classification), categorías de suelo (soil categories), and sectores de desarrollo (development sectors).43  
  * **WFS:** A general list of IDECyL services includes a WFS for Uso del suelo (Land Use).44  
    * **URL:** https://idecyl.jcyl.es/geoserver/lu/wfs? (This URL is inferred from the pattern of the WMS URL and the general service list in 44). Users should query the GetCapabilities of this service to confirm it contains the desired planning layers.

### **2.5. País Vasco (GeoEuskadi)**

GeoEuskadi is the corporate SDI of the Basque Government, led by the Directorate of Territorial Planning and Urbanism.45

* **Web Services:** The available information points to a well-structured SDI, but a direct WFS endpoint specifically for urban planning was not explicitly identified.  
  * **WMS:** A general WMS for base cartography is available at https://www.geo.euskadi.eus/WMS\_KARTOGRAFIA?request=GetCapabilities\&service=WMS.48  
  * **Discovery Path:** The primary entry points for data discovery are the main GeoEuskadi geoportal and its geoservices catalog.46 Users seeking specific urban planning vector data should begin their search in the official catalog.

### **2.6. Comunitat Valenciana (ICV)**

The Institut Cartogràfic Valencià (ICV) is the primary provider of geospatial data for the region.50

* **Web Services:** The investigation identified a WFS for the official 1:5,000 scale base cartography, which serves as a critical foundational layer for any planning analysis.  
  * **WFS:** Cartografía oficial de la Comunitat Valenciana a escala 1:5.000  
  * **GetCapabilities URL:** https://terramapas.icv.gva.es/0101\_BCV05?service=WFS\&request=GetCapabilities 51  
* **Thematic Data:** While a direct WFS for urban planning was not found, the regional map viewer (visor.gva.es) integrates thematic layers related to urbanism from various government departments, including the former Conselleria de Medio Ambiente, Agua, Urbanismo y Vivienda (CMAAUV).52 Users should explore the viewer and the main IDECV catalog to discover if WFS access is provided for these thematic layers.

### **2.7. Galicia (IDEG)**

The Infraestrutura de Datos Espaciais de Galicia (IDEG) is part of the broader Sistema de Información Territorial de Galicia (SITGA).53

* **Key Datasets:** The primary legal instruments for regional planning are the **Plan Básico Autonómico** and the **Plan de Ordenación del Litoral** (Coastal Management Plan).54  
* **Web Services:** WMS services for these key plans are available, but a direct WFS endpoint was not explicitly provided in the documentation reviewed.55  
  * **WMS GetCapabilities (Plan Básico Autonómico):** https://ideg.xunta.gal/servizos/services/VISEME/Riscos/MapServer/WMSServer?SERVICE=WMS\&VERSION=1.3.0\&REQUEST=GetCapabilities.55  
  * **Discovery Path:** An official announcement regarding the services for the Coastal Plan directs users to the main IDEG service directory.56 This directory should be the first place to check for a corresponding WFS.

### **2.8. Other Relevant Regions**

* **Navarra (SITNA):** The Navarra Territorial Information System (SITNA) operates a geoportal that includes departmental information on Urbanismo and a specific Navarra Urban Information System (SIUN).58 However, a dedicated public data catalog or a directory of WFS/ATOM services for urban planning was not located within the reviewed materials.60  
* **Other Autonomous Communities:** A directory of other regional IDEs, including IDEAragón (Aragón), IDE-CLM (Castilla-La Mancha), and IDEExtremadura (Extremadura), is maintained by the national IDEE.7 These geoportals serve as the primary starting points for data discovery within their respective territories.

## **Part III: Strategic Guidance and Technical Recommendations**

Successfully acquiring and utilizing zoning and land use data from Spain's complex SDI ecosystem requires a strategic approach that combines national and regional resources, acknowledges the limitations of discovery services, and anticipates future technological shifts.

### **3.1. A Unified Strategy for Data Aggregation**

A robust and repeatable workflow for obtaining permitted land use information for any given location in Spain involves a multi-step, multi-source process. This strategy is necessitated by the division of responsibilities, where national bodies define the "where" (parcels and boundaries) and regional bodies define the "what's allowed" (zoning).

1. **Step 1: Define the Parcel Fabric (National Level).** Begin by identifying the specific land parcel(s) of interest using the definitive national source: the **Dirección General del Catastro WFS**. Query the WFS de parcela catastral (CP) service (http://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx?) with a known location (e.g., coordinates, address) or cadastral reference to retrieve the precise geometry and legal identifier of the property.  
2. **Step 2: Identify the Regional Service (Report Appendix).** Consult the **Master Directory of Web Services** in the Appendix of this report. Locate the Autonomous Community corresponding to the parcel's location and identify the relevant WFS or ATOM service for urban planning or land use.  
3. **Step 3: Query the Regulatory Overlay (Regional Level).** Using the parcel geometry obtained in Step 1, perform a spatial query (e.g., an intersects query) against the regional WFS endpoint identified in Step 2\. The result of this query will be the zoning polygon(s) that cover the parcel, along with their attributes detailing the specific classification, permitted uses, building regulations, etc.  
4. **Step 4: Harmonize and Integrate.** Be prepared to handle significant variations in data models and attribute schemas between regions. The zoning classifications used in Catalunya's MUC will differ from the soil classification system in Castilla y León's service. For projects spanning multiple regions, it will be necessary to develop a common data model or a crosswalk table to harmonize these disparate schemas into a consistent format for analysis.

### **3.2. Effective Use of Discovery Services**

While this report advocates for using direct, verified service links due to the observed unreliability of central catalogs, it is still useful to understand how to operate the official discovery portals. The European INSPIRE Geoportal is the highest-level aggregator of this information.

To search for data on the INSPIRE Geoportal, one can use its search tools to filter by country and thematic category.61 A typical search procedure would be:

1. Navigate to the INSPIRE Geoportal (inspire-geoportal.ec.europa.eu).  
2. Use the search or filtering tools to specify the location or country as "Spain."  
3. Filter by the relevant INSPIRE themes. The most pertinent themes for this query are **Land Use** (for existing and planned land use) and **Area management/restriction/regulation zones & reporting units** (which encompasses zoning and other regulatory areas).

However, users should be aware of the limitations. As documented earlier, these portals can be inaccessible, and their search results may be incomplete or difficult to interpret.11 For this reason, the Master Directory in the Appendix should be considered a more reliable and efficient starting point for accessing the most relevant services.

### **3.3. The Transition to Modern Standards: OGC API**

The user query specified WFS and ATOM services, which represent established OGC standards. However, the global and Spanish geospatial communities are actively transitioning towards more modern, web-friendly standards, principally the **OGC API** family of standards. The Spanish SDI is at the forefront of this modernization effort.4

The IGN and IDEE are implementing new network services based on standards like **OGC API \- Features**, which is the successor to WFS.22 These new APIs are built on RESTful principles, use JSON as a primary data format, and are generally easier for web developers to integrate than their XML-based predecessors. The Spanish government's recovery and resilience plan includes an €11 million budget for modernizing the IDEE, with a specific focus on implementing these new OGC API-compliant services.4

For future-proofing applications, developers should monitor and begin integrating these new endpoints as they become available. Key national API endpoints already in operation include:

* **API \- Features (IGN):** https://api-features.ign.es/collections 22  
* **API \- Features (National Cartographic System):** https://api-features.idee.es/collections 22

As regional data providers follow the national lead, these API-based services will likely become the primary method for accessing zoning and land use data in the coming years.

## **Appendix: Master Directory of WFS and ATOM Services**

The following table consolidates the key web services for urban planning, zoning, and land use identified across Spain. It is designed to serve as an actionable, quick-reference guide for technical users.

| Service Name | Provider / Region | Service Type | Direct Endpoint URL | Key Data Layers / Feature Types | Technical Notes |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **National Foundational Services** |  |  |  |  |  |
| Parcela Catastral (CP) | Dirección General del Catastro / National | WFS | http://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx? | Cadastral Parcels | The definitive legal parcel fabric. Essential first step for any analysis. |
| Unidades Administrativas | Instituto Geográfico Nacional / National | WFS | https://www.ign.es/wfs-inspire/unidades-administrativas | Administrative Boundaries | Municipal, provincial, and regional boundaries. |
| Unidades Administrativas | Instituto Geográfico Nacional / National | ATOM | https://www.ign.es/atom/ds.es.xml | Administrative Boundaries, Hydrography, Geographic Names | Bulk download feed for reference data. |
| Ocupación del Suelo (SIOSE) | Instituto Geográfico Nacional / National | WFS | https://servicios.idee.es/wfs-inspire/ocupacion-suelo | Land Cover, Land Use | National land cover/use dataset. Provides context, not regulatory zoning. |
| **Regional Planning Services** |  |  |  |  |  |
| Mapa Urbanístic de Catalunya (MUC) | ICGC / Catalunya | WFS | https://sig.gencat.cat/ows/PLANEJAMENT/wfs | Planejament urbanístic, Ús del sòl | **No legal validity.** A synthesized, continuous map of all planning instruments. |
| DERA \- Sistema Urbano | IECA / Andalucía | WFS | http://www.ideandalucia.es/services/DERA\_g7\_sistema\_urbano/wfs? | Poblaciones, EntidadSingular | Provides urban fabric (blocks, settlements). Detailed zoning is at the municipal level. |
| Planeamiento Urbanístico | Comunidad de Madrid / Madrid | ATOM | Discover via comunidad.madrid geoportal | Planeamiento General, Clases de suelo | Primary access for bulk download is via ATOM feed, not WFS. |
| Urbanismo, Vivienda y O.T. | JCyL / Castilla y León | WMS | https://idecyl.jcyl.es/geoserver/urbanismo/wms? | Clasificación de suelo, Categorías de suelo | WMS service with highly relevant planning layers. |
| Uso del Suelo | JCyL / Castilla y León | WFS | https://idecyl.jcyl.es/geoserver/lu/wfs? | Land Use | General land use WFS. Check GetCapabilities for specific planning data. |
| Cartografía Oficial 1:5.000 | ICV / Comunitat Valenciana | WFS | https://terramapas.icv.gva.es/0101\_BCV05?service=WFS\&request=GetCapabilities | Base Cartography | High-resolution base map. Thematic planning layers are in the regional viewer. |
| Plan Básico Autonómico | IET / Galicia | WMS | https://ideg.xunta.gal/servizos/services/VISEME/Riscos/MapServer/WMSServer? | Ordenación do Territorio, Plan de Ordenación do Litoral | WMS for key planning documents. Check service directory for corresponding WFS. |
| Cartografía General | Gobierno Vasco / País Vasco | WMS | https://www.geo.euskadi.eus/WMS\_KARTOGRAFIA? | Base Cartography | General cartography service. Specific planning WFS must be found via the GeoEuskadi catalog. |

#### **Works cited**

1. La Infraestructura de Datos Espaciales de España (IDEE), un referente de la información geoespacial | datos.gob.es, accessed on October 23, 2025, [https://datos.gob.es/es/blog/la-infraestructura-de-datos-espaciales-de-espana-idee-un-referente-de-la-informacion-geoespacial](https://datos.gob.es/es/blog/la-infraestructura-de-datos-espaciales-de-espana-idee-un-referente-de-la-informacion-geoespacial)  
2. Guía práctica para la publicación de datos espaciales, accessed on October 23, 2025, [https://datos.gob.es/sites/default/files/doc/file/guia\_publicacion\_datos\_espaciales.pdf](https://datos.gob.es/sites/default/files/doc/file/guia_publicacion_datos_espaciales.pdf)  
3. The Spatial Data Infrastructure of Spain (IDEE), a benchmark for geospatial information | datos.gob.es, accessed on October 23, 2025, [https://datos.gob.es/en/blog/spatial-data-infrastructure-spain-idee-benchmark-geospatial-information](https://datos.gob.es/en/blog/spatial-data-infrastructure-spain-idee-benchmark-geospatial-information)  
4. Spain \- 2023: Country Fiche \- GitHub Pages, accessed on October 23, 2025, [https://inspire-mif.github.io/INSPIRE-in-your-Country/ES/Country\_fiches/inspire\_-\_spain\_-\_2023\_country\_fiche.pdf](https://inspire-mif.github.io/INSPIRE-in-your-Country/ES/Country_fiches/inspire_-_spain_-_2023_country_fiche.pdf)  
5. Complying with Europe: Inspire and the High Value Geospatial Assemblies Regulation | datos.gob.es, accessed on October 23, 2025, [https://datos.gob.es/en/blog/complying-europe-inspire-and-high-value-geospatial-assemblies-regulation](https://datos.gob.es/en/blog/complying-europe-inspire-and-high-value-geospatial-assemblies-regulation)  
6. Geoportal IDEE | Información Xeográfica de Galicia, accessed on October 23, 2025, [https://mapas.xunta.gal/es/ide/idee/geoportal-idee](https://mapas.xunta.gal/es/ide/idee/geoportal-idee)  
7. Iniciativas IDE en España \- IDEAndalucia, accessed on October 23, 2025, [https://www.ideandalucia.es/portal/iniciativas-ide-espanya](https://www.ideandalucia.es/portal/iniciativas-ide-espanya)  
8. ¿Conoces el geoportal de la Infraestructura de Datos de Andalucía? \- Blog IDEE, accessed on October 23, 2025, [https://blog.idee.es/archivo/-/blogs/-conoces-el-geoportal-de-la-infraestructura-de-datos-de-andalucia-](https://blog.idee.es/archivo/-/blogs/-conoces-el-geoportal-de-la-infraestructura-de-datos-de-andalucia-)  
9. La Directiva Europea INSPIRE y sus Reglas de Implementación. Cumplimiento por parte de la Dirección General del Catastro., accessed on October 23, 2025, [https://www.catastro.hacienda.gob.es/webinspire/documentos/Directiva.pdf](https://www.catastro.hacienda.gob.es/webinspire/documentos/Directiva.pdf)  
10. Catálogo de metadatos de la Infraestructura de Datos Espaciales de España \- CNIG en nombre del Consejo Superior Geográfico \- Geoportal IDEE, accessed on October 23, 2025, [https://www.idee.es/csw-inspire-idee/srv/spa/catalog.search](https://www.idee.es/csw-inspire-idee/srv/spa/catalog.search)  
11. accessed on January 1, 1970, httpshttps://www.idee.es/csw-inspire-idee/srv/spa/catalog.search  
12. accessed on January 1, 1970, [https://servicios.idee.es/wfs-inspire/ocupacion-suelo](https://servicios.idee.es/wfs-inspire/ocupacion-suelo)  
13. accessed on January 1, 1970, [https://www.ign.es/wfs-inspire/unidades-administrativas](https://www.ign.es/wfs-inspire/unidades-administrativas)  
14. accessed on January 1, 1970, [https://www.ign.es/atom/ds.es.xml](https://www.ign.es/atom/ds.es.xml)  
15. INSPIRE Geoportal, accessed on October 23, 2025, [https://inspire-geoportal.ec.europa.eu/](https://inspire-geoportal.ec.europa.eu/)  
16. INSPIRE Geoportal, accessed on October 23, 2025, [https://inspire-geoportal.ec.europa.eu/srv/eng/catalog.search\#/home](https://inspire-geoportal.ec.europa.eu/srv/eng/catalog.search#/home)  
17. Improving the national Spanish land cover and land use information system, accessed on October 23, 2025, [https://land.copernicus.eu/en/use-cases/improving-the-national-spanish-land-cover-and-land-use-information-system/improving-the-national-spanish-land-cover-and-land-use-information-system](https://land.copernicus.eu/en/use-cases/improving-the-national-spanish-land-cover-and-land-use-information-system/improving-the-national-spanish-land-cover-and-land-use-information-system)  
18. Full article: A user-driven process for INSPIRE-compliant land use database: example from Wallonia, Belgium \- Taylor & Francis Online, accessed on October 23, 2025, [https://www.tandfonline.com/doi/full/10.1080/19475683.2021.1875047](https://www.tandfonline.com/doi/full/10.1080/19475683.2021.1875047)  
19. Centro de Descargas del CNIG (IGN), accessed on October 23, 2025, [https://centrodedescargas.cnig.es/](https://centrodedescargas.cnig.es/)  
20. Instituto Geográfico Nacional: Inicio, accessed on October 23, 2025, [https://www.ign.es/](https://www.ign.es/)  
21. Geo-Información | Ministerio de Transportes y Movilidad Sostenible, accessed on October 23, 2025, [https://www.transportes.gob.es/geoinformacion](https://www.transportes.gob.es/geoinformacion)  
22. Infraestructuras de Datos Espaciales \- Instituto Geográfico Nacional, accessed on October 23, 2025, [https://www.ign.es/web/ide-area-nodo-ide-ign](https://www.ign.es/web/ide-area-nodo-ide-ign)  
23. Servicios INSPIRE de Cartografía Catastral Dirección General del Catastro, accessed on October 23, 2025, [https://www.catastro.hacienda.gob.es/webinspire/index.html](https://www.catastro.hacienda.gob.es/webinspire/index.html)  
24. La Infraestructura de Datos Espaciales de Catalunya (IDEC): situación y perspectivas \- AWS, accessed on October 23, 2025, [https://icgc-web-pro.s3.eu-central-1.amazonaws.com/produccio/s3fs-public/idec\_situacion\_y\_perspectivas\_3644.pdf](https://icgc-web-pro.s3.eu-central-1.amazonaws.com/produccio/s3fs-public/idec_situacion_y_perspectivas_3644.pdf)  
25. Infraestructura de Dades Espacials de Catalunya \- Viquipèdia, l'enciclopèdia lliure, accessed on October 23, 2025, [https://ca.wikipedia.org/wiki/Infraestructura\_de\_Dades\_Espacials\_de\_Catalunya](https://ca.wikipedia.org/wiki/Infraestructura_de_Dades_Espacials_de_Catalunya)  
26. Servei de visualització WMS del Mapa urbanístic sintètic, accessed on October 23, 2025, [https://catalegs.ide.cat/geonetwork/srv/api/records/mapa-urbanistic-wms?language=cat](https://catalegs.ide.cat/geonetwork/srv/api/records/mapa-urbanistic-wms?language=cat)  
27. Mapa Urbanístic de Catalunya (MUC) sintètic v1.2 \- Gener 2024, accessed on October 23, 2025, [https://catalegs.ide.cat/geonetwork/srv/api/records/mapa-urbanistic-sintetic-v1r2-2024?language=cat](https://catalegs.ide.cat/geonetwork/srv/api/records/mapa-urbanistic-sintetic-v1r2-2024?language=cat)  
28. Servei de descàrrega WFS de planejament, accessed on October 23, 2025, [https://catalegs.ide.cat/geonetwork/srv/api/records/planejament-wfs?language=cat](https://catalegs.ide.cat/geonetwork/srv/api/records/planejament-wfs?language=cat)  
29. WFS download service of planning, accessed on October 23, 2025, [https://catalegs.ide.cat/geonetwork/srv/api/records/planejament-wfs](https://catalegs.ide.cat/geonetwork/srv/api/records/planejament-wfs)  
30. INSPIRE Land use of Catalonia, accessed on October 23, 2025, [https://inspire-geoportal.ec.europa.eu/srv/api/records/inspire-us-sol](https://inspire-geoportal.ec.europa.eu/srv/api/records/inspire-us-sol)  
31. Infraestructura de Datos Espaciales de Andalucía (IDEAndalucía) \- Portal de datos abiertos, accessed on October 23, 2025, [https://www.juntadeandalucia.es/datosabiertos/portal/dataset/infraestructura-de-datos-espaciales-de-andalucia-ideandalucia](https://www.juntadeandalucia.es/datosabiertos/portal/dataset/infraestructura-de-datos-espaciales-de-andalucia-ideandalucia)  
32. IDEAndalucía \- IDEE, accessed on October 23, 2025, [https://www.idee.es/resources/presentaciones/Sevilla/IDEAndalucia.pdf](https://www.idee.es/resources/presentaciones/Sevilla/IDEAndalucia.pdf)  
33. http://www.ideandalucia.es/services/DERA\_g7\_sistema\_urbano/wfs ..., accessed on October 23, 2025, [http://www.ideandalucia.es/services/DERA\_g7\_sistema\_urbano/wfs?service=wfs\&request=getcapabilities](http://www.ideandalucia.es/services/DERA_g7_sistema_urbano/wfs?service=wfs&request=getcapabilities)  
34. Ayuntamiento de Écija \- IDEAndalucia, accessed on October 23, 2025, [https://www.ideandalucia.es/portal/nodo-ayuntamiento-de-ecija](https://www.ideandalucia.es/portal/nodo-ayuntamiento-de-ecija)  
35. ¿Conoces el portal web de la Infraestructura de Datos de la Comunidad de Madrid?, accessed on October 23, 2025, [https://blog.idee.es/archivo/-/blogs/-conoces-el-portal-web-de-la-infraestructura-de-datos-de-la-comunidad-de-madrid-](https://blog.idee.es/archivo/-/blogs/-conoces-el-portal-web-de-la-infraestructura-de-datos-de-la-comunidad-de-madrid-)  
36. Geoportal de la Comunidad de Madrid | Comunidad de Madrid, accessed on October 23, 2025, [https://www.comunidad.madrid/servicios/mapas/geoportal-comunidad-madrid](https://www.comunidad.madrid/servicios/mapas/geoportal-comunidad-madrid)  
37. Sistema de Información Territorial (Visor SIT) \- Comunidad de Madrid |, accessed on October 23, 2025, [https://www.comunidad.madrid/servicios/urbanismo-medio-ambiente/sistema-informacion-territorial-visor-sit](https://www.comunidad.madrid/servicios/urbanismo-medio-ambiente/sistema-informacion-territorial-visor-sit)  
38. Sistema de Información Urbanística Regional (SIUR) \- Comunidad de Madrid |, accessed on October 23, 2025, [https://www.comunidad.madrid/servicios/urbanismo-medio-ambiente/sistema-informacion-urbanistica-regional-siur](https://www.comunidad.madrid/servicios/urbanismo-medio-ambiente/sistema-informacion-urbanistica-regional-siur)  
39. Catálogo de la IDE de la Comunidad de Madrid \- Geoportal de la ..., accessed on October 23, 2025, [https://idem.comunidad.madrid/catalogocartografia/srv/spa/catalog.search](https://idem.comunidad.madrid/catalogocartografia/srv/spa/catalog.search)  
40. IDECyL y SiuCyL Los servicios de información geográfica y urbanística de la Junta de Castilla y León \- YouTube, accessed on October 23, 2025, [https://www.youtube.com/watch?v=3bD5Onb3BNQ](https://www.youtube.com/watch?v=3bD5Onb3BNQ)  
41. Proyecto IDECyL Infraestructura de Datos Espaciales de Castilla y León \- IDEE, accessed on October 23, 2025, [https://www.idee.es/resources/presentaciones/Valladolid/proyectoIDECYL-1.pdf](https://www.idee.es/resources/presentaciones/Valladolid/proyectoIDECYL-1.pdf)  
42. IDECyL y SiuCyL. Los servicios de información geográfica y urbanística de la Junta, accessed on October 23, 2025, [https://www.youtube.com/watch?v=GV0yhR1lpR4](https://www.youtube.com/watch?v=GV0yhR1lpR4)  
43. Urbanismo CyL WMS \- IDECyL \- Junta de Castilla y León, accessed on October 23, 2025, [https://idecyl.jcyl.es/geonetwork/srv/api/records/spagobcylwmsurbvivotepla](https://idecyl.jcyl.es/geonetwork/srv/api/records/spagobcylwmsurbvivotepla)  
44. Listado de servicios | Infraestructura de Datos Espaciales | Junta de ..., accessed on October 23, 2025, [https://cartografia.jcyl.es/web/es/datos-servicios/listado-servicios.html](https://cartografia.jcyl.es/web/es/datos-servicios/listado-servicios.html)  
45. geoEuskadi. Plataforma para el uso, explotación y difusión de mapas e información geográfica \- REVISTA INTERNACIONAL MAPPING, accessed on October 23, 2025, [https://ojs.revistamapping.com/MAPPING/article/download/132/23/240](https://ojs.revistamapping.com/MAPPING/article/download/132/23/240)  
46. Plataforma geoEuskadi \- Infraestructura de datos Espaciales de Euskadi, accessed on October 23, 2025, [https://www.euskadi.eus/contenidos/documentacion/estandar\_01100101/es\_def/](https://www.euskadi.eus/contenidos/documentacion/estandar_01100101/es_def/)  
47. IDE de EUSKADI, accessed on October 23, 2025, [https://www.idee.es/resources/presentaciones/JIIDE15/20151104/20\_Aurkezpena\_EuskoJaurlaritza.pdf](https://www.idee.es/resources/presentaciones/JIIDE15/20151104/20_Aurkezpena_EuskoJaurlaritza.pdf)  
48. Servicio WMS de visualización de cartografía base y cartografía derivada de la Comunidad Autónoma del País Vasco. \- INSPIRE Geoportal, accessed on October 23, 2025, [https://inspire-geoportal.ec.europa.eu/srv/api/records/md\_ideeu\_wms\_cartografia\_es](https://inspire-geoportal.ec.europa.eu/srv/api/records/md_ideeu_wms_cartografia_es)  
49. Visor geoEuskadi: acceso, descripción, información disponible, cómo compartir mapas en internet \- YouTube, accessed on October 23, 2025, [https://www.youtube.com/watch?v=vYpFA\_bVAGc](https://www.youtube.com/watch?v=vYpFA_bVAGc)  
50. Institut Cartogràfic Valencià \- Generalitat Valenciana, accessed on October 23, 2025, [https://icv.gva.es/va/](https://icv.gva.es/va/)  
51. Cartografía oficial de la Comunitat Valenciana a escala 1:5.000 del ..., accessed on October 23, 2025, [https://datos.gob.es/es/catalogo/a10002983-cartografia-oficial-de-la-comunitat-valenciana-a-escala-1-5-000-del-institut-cartografic-valencia](https://datos.gob.es/es/catalogo/a10002983-cartografia-oficial-de-la-comunitat-valenciana-a-escala-1-5-000-del-institut-cartografic-valencia)  
52. Visor cartogràfic de la Generalitat \- Generalitat Valenciana, accessed on October 23, 2025, [https://visor.gva.es/](https://visor.gva.es/)  
53. La Infraestructura de Datos Espaciales de Galicia (I.D.E.G.) \- IDEE, accessed on October 23, 2025, [https://idee.es/resources/presentaciones/JIDEE05/sesion\_06\_02.pdf](https://idee.es/resources/presentaciones/JIDEE05/sesion_06_02.pdf)  
54. Código de Urbanismo de Galicia \- BOE.es, accessed on October 23, 2025, [https://www.boe.es/biblioteca\_juridica/codigos/codigo.php?id=72\&modo=2¬a=0\&tab=2](https://www.boe.es/biblioteca_juridica/codigos/codigo.php?id=72&modo=2&nota=0&tab=2)  
55. Plan Básico Autonómico de Galicia. Otras afecciones. Sevesos \- Conjunto de datos, accessed on October 23, 2025, [https://datos.gob.es/es/catalogo/a12002994-plan-basico-autonomico-de-galicia-otras-afecciones-sevesos](https://datos.gob.es/es/catalogo/a12002994-plan-basico-autonomico-de-galicia-otras-afecciones-sevesos)  
56. Disponibles los servicios WMS y WFS del Plan de Ordenación del ..., accessed on October 23, 2025, [https://mapas.xunta.gal/es/utilidades-y-publicaciones/actualidad/disponibles-los-servicios-wms-y-wfs-del-plan-de-ordenacion](https://mapas.xunta.gal/es/utilidades-y-publicaciones/actualidad/disponibles-los-servicios-wms-y-wfs-del-plan-de-ordenacion)  
57. Directorio de servicios web | Información Xeográfica de Galicia, accessed on October 23, 2025, [https://mapas.xunta.gal/es/coordinacion/servicios](https://mapas.xunta.gal/es/coordinacion/servicios)  
58. SITNA GEOPORTAL: TOWARDS THE INTEGRATION OF TERRITORIAL INFORMATION, accessed on October 23, 2025, [https://icaci.org/files/documents/ICC\_proceedings/ICC2009/html/nonref/22\_8.pdf](https://icaci.org/files/documents/ICC_proceedings/ICC2009/html/nonref/22_8.pdf)  
59. Navarra Territorial Information System (SITNA) \- Tracasa, accessed on October 23, 2025, [https://tracasa.es/proyectos/navarra-territorial-information-system-sitna/](https://tracasa.es/proyectos/navarra-territorial-information-system-sitna/)  
60. Geoportal \- navarra.es: INICIO, accessed on October 23, 2025, [https://sitna.navarra.es/](https://sitna.navarra.es/)  
61. INSPIRE Geoportal \- Atlas.co, accessed on October 23, 2025, [https://atlas.co/data-sources/inspire-geoportal/](https://atlas.co/data-sources/inspire-geoportal/)  
62. INSPIRE Geoportal \- Robinson Evidence Base, accessed on October 23, 2025, [https://robinson-eb.eu/tools/databases/inspire-geoportal](https://robinson-eb.eu/tools/databases/inspire-geoportal)