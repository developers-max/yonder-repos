

# **A Procedural Guide to Acquiring Zoning and Land Use Data in Niedersachsen, Germany**

## **I. Executive Summary and Data Governance Framework**

### **A. Core Finding: A Bifurcated, Dual-Track System**

Acquiring comprehensive zoning and land usage information in the German state of Niedersachsen (Lower Saxony) requires navigating two distinct and parallel administrative processes. This bifurcated system is rooted in the German administrative division of powers, which separates the legal-political function of planning from the technical-administrative function of geodata management.

Process 1: Legal Zoning (Bauleitplanung)  
This process concerns legally binding development plans. In Germany, this authority, known as Planungshoheit (planning sovereignty), is granted exclusively to the Kommunen (municipalities), which include cities, towns, and joint municipalities (Samtgemeinden).1 Consequently, acquiring legally binding zoning plans (Bebauungspläne) is a decentralized process that necessitates engagement with each individual municipal authority.  
Process 2: Geospatial & Land Use Data (Geodaten)  
This process concerns descriptive, factual data about the land. This is a technical and administrative function managed centrally by the Land (State) of Niedersachsen. The primary authority is the Landesamt für Geoinformation und Landesvermessung Niedersachsen (LGLN), the state's central service provider for geodata, the real estate cadastre, and topography.3 A secondary state-level authority, the Landesamt für Bergbau, Energie und Geologie (LBEG), manages sub-surface and geological data, including Bodenkarten (soil maps).7  
The query for "a process" to acquire "zoning/data usage information" reflects a common but critical misunderstanding. In the German system, these are fundamentally different products originating from different levels of government.

* A **zoning plan (*Bebauungsplan*)** is a *legal instrument* from a *Kommune* (municipality) that dictates *future* development possibilities and restrictions.1  
* A **land use dataset (*ALKIS Landnutzung*)** is a *descriptive dataset* from the *Land* (State) that documents the *current* factual and socio-economic reality of the land.9

A professional (e.g., developer, investor, analyst) must acquire and analyze both. The legal plan defines what is permissible, while the descriptive dataset defines what currently exists. A comparison of these two datasets is essential for identifying development opportunities, investment risks, and legal non-conformities. This report is structured to guide a user through these two separate, non-overlapping acquisition paths.

### **B. The Niedersachsen Data Acquisition Matrix**

The following table serves as a central reference guide, summarizing the distinct data types, their governing authorities, and the primary methods of acquisition.

**Table 1: Niedersachsen Data Acquisition Matrix**

| Data Type (English / German) | Data Function & Legal Status | Responsible Authority | Primary Access Portal / Process | Typical Data Format | Acquisition Cost |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Legally Binding Zoning Plan** (*Bebauungsplan*) | Legally binding instrument defining specific building use, scale, and location.1 | *Kommune* (Municipality, City, or *Samtgemeinde*).1 | Municipal Website / Geoportal (e.g., of Hannover, Oldenburg).11 Discovery via the state's central UVP-Portal.13 | PDF (often as a scanned, non-georeferenced image); WMS (Web Map Service).14 | Free for digital viewing. Fees may apply for official certified copies.2 |
| **Preparatory Land Use Plan** (*Flächennutzungsplan*) | Preparatory, strategic plan for the entire municipality. Binding on public authorities, but not citizens.16 | *Kommune* (Municipality, City, or *Samtgemeinde*).1 | Municipal Website / Geoportal.11 | PDF (often as a scanned image). | Free for digital viewing.17 |
| **Official Cadastral Map** (*Liegenschaftskarte*) | Descriptive map of official property parcels, boundaries, and building footprints.18 | LGLN (State Agency).3 | LGLN "Katasterkarten-online" Portal.18 | Paid (Official): PDF.18 Free (Open Data): Shapefile, GeoPackage, WMS.18 | Dual System: Paid for official PDF extracts; Free for Open Data downloads.18 |
| **Actual Land Use Dataset** (*ALKIS Landnutzung*) | Descriptive dataset of *current* actual socio-economic land function (e.g., residential, industrial, agricultural).9 | LGLN (State Agency).9 | LGLN "OpenGeoData Niedersachsen" Hub.21 | GeoPackage 22, Shapefile, GeoJSON, WFS (Web Feature Service).21 | Free (Open Data, CC BY 4.0 License).9 |
| **Soil & Geological Map** (*Bodenkarte*) | Descriptive data on soil types, geology, and sub-surface characteristics.8 | LBEG (State Agency).8 | LBEG "NIBIS Kartenserver".8 | Viewer.24 Shapefile.23 PDF.26 | Mixed: Free for viewing and some downloads.23 Paid for other digital datasets and printed maps.8 |

## **II. Process for Acquiring Zoning Information (*Bauleitplanung*)**

This section details the decentralized process for acquiring legally binding zoning plans, which are governed by the German Federal Building Code (*Baugesetzbuch* or *BauGB*).1

### **A. Defining German Zoning: The Two-Tiered System of *Bauleitplanung***

*Bauleitplanung* (urban development planning) consists of two distinct types of plans.1

**1\. The Preparatory Plan: *Flächennutzungsplan* (F-Plan)**

* **Function:** The *Flächennutzungsplan* (F-Plan) is a preparatory, strategic framework plan that covers the *entire* territory of a municipality.1  
* **Content:** It outlines the *intended* future development, designating broad areas for differentiated uses, such as residential areas (*Wohnbauflächen*), commercial areas (*gewerbliche Bauflächen*), agricultural land (*landwirtschaftliche Nutzflächen*), or green spaces (*Grünflächen*).1  
* **Legal Status:** This plan does *not* create a direct legal right for a citizen to build or develop a property.16 Instead, it functions as an *internal* binding program for the municipal administration and other public authorities.16  
* **Significance:** Despite its non-binding nature for citizens, the F-Plan represents the first critical "go/no-go" test for any development project. Binding B-Pläne must be "developed from" the F-Plan.16 Furthermore, the F-Plan's designations *can* be used by the municipality to block projects in unplanned "outer areas" (*Außenbereich*).16 Therefore, if a proposed project (e.g., a commercial park) is on land designated as "agricultural" by the F-Plan, the developer faces a complex and costly process to *first* secure an amendment to the F-Plan 27 before a B-Plan application can even be considered.

**2\. The Legally Binding Plan: *Bebauungsplan* (B-Plan)**

* **Function:** The *Bebauungsplan* (B-Plan) is the specific, parcel-level, legally binding zoning plan. It is developed *from* the F-Plan but covers a much smaller, defined "building area".1  
* **Content:** This is the decisive document for any construction. It contains the legally binding *Festsetzungen* (stipulations) that control 1:  
  * *Art der baulichen Nutzung*: The **type** of building use permitted (e.g., "purely residential," "mixed-use," "industrial").  
  * *Maß der baulichen Nutzung*: The **scale** of building use (e.g., floor-area-ratio, building height, number of stories).  
  * *Überbaubarer Bereich*: The specific **building footprint** or envelope on the parcel where construction is allowed.  
* **Legal Status:** This plan is directly and legally binding on all parties, including citizens and developers. It is the instrument that "frees" a parcel for development while simultaneously defining its legal "barriers".1

### **B. The Procedural Hurdle: *Planungshoheit der Gemeinden* (Municipal Planning Authority)**

The acquisition process for these plans is fragmented by design. The *Zuständigkeit* (responsibility) for creating, managing, and publishing *Bauleitpläne* lies exclusively with the local *Kommune* (municipality, city, or *Samtgemeinde*).1 This *Planungshoheit* is a constitutionally protected right of local self-government.

The direct consequence is that **no single, central state-level database exists** where one can search and download all B-Pläne for Niedersachsen. Each of the hundreds of municipalities (e.g., Hannover 11, Oldenburg 12, Börßum 29, Aurich 30) is independently responsible for its own plans. The process for creating these plans, while locally managed, must follow detailed regulations set forth in the federal *BauGB*, including mandatory periods for public participation (*Bürgerbeteiligung*).1

### **C. Step-by-Step Acquisition Process for *Bauleitpläne***

Step 1: Centralized Discovery (Finding the Responsible Municipality and Plan)  
Given the decentralized system, the primary challenge is identifying the correct municipal authority and the specific plan in effect for a target area. The State of Niedersachsen provides a central discovery portal to solve this.  
Since May 2017, municipalities are legally required to publish notices of public plan displays online *and* make this information accessible via a "zentrales Internetportal des Landes" (central internet portal of the state).13 This portal is managed by the *Nds. Ministerium für Wirtschaft, Verkehr und Bauen* (Lower Saxony Ministry of Economy, Transport, and Building).13

This central portal is the **UVP-Portal Niedersachsen** (https://uvp.niedersachsen.de/).13 It functions as a central register for *all* procedures that may require an *Umweltverträglichkeitsprüfung (UVP)* (Environmental Impact Assessment). *Bauleitplanung* (zoning) is one of these procedure types.13 This portal operates as a "register and redirect" system: users search the central database to find the relevant *Bauleitplanung* procedure for their area, and the portal then provides links to the *actual plan documents* which are hosted on the responsible municipality's website.13

Step 2: Direct Municipal Acquisition (Accessing the Plan)  
Once the responsible municipality is identified (either via the UVP-Portal or simple geography), the user must navigate to the municipal-level website or portal. The quality of this access varies by municipality.

* **Case Study: Hannover (State Capital):** The city of Hannover provides a sophisticated, digital-first solution. Its official website (hannover.de) features a dedicated *Bauleitplanung* section with an interactive **Geoinformationssystem (GIS)**.11 This GIS portal provides direct map-based access to both:  
  1. *Aktuell im Verfahren befindliche Bebauungspläne* (B-Plans currently in the legal process).11  
  2. *Bestehende rechtsverbindliche Bebauungspläne* (Existing, legally binding B-Plans).11  
* **Case Study: Oldenburg (City):** The city of Oldenburg also provides a digital portal on its website (oldenburg.de) with a section for "Bebauungspläne ansehen" (View B-Plans).12 It also features a portal for "Öffentlichkeitsbeteiligung online" (Online Public Participation) for new plans under review.12 The state's metadata search confirms the existence of these municipal datasets, such as the "Flächennutzungsplan Stadt Oldenburg" 17 and "Umringe rechtsverbindlicher Bebauungspläne Stadt Oldenburg" (Outlines of B-Plans) 35, noting the contact person is with the *Stadt Oldenburg*.17  
* **Case Study: Lüneburg (Rural District):** In some cases, data may be provided as a map service rather than a full portal. The state's geoportal (GDI-NI) catalog lists a "WMS-Dienst Bauleitplanung Landkreis Lüneburg".14 This Web Map Service (WMS) allows a user to stream the plan outlines as a layer in their own GIS software but may not provide easy access to the underlying legal (PDF) documents.

Step 3: The "Analog" Fallback (Direct Inquiry)  
Not all legally binding plans are available digitally. F-Plans can be decades old and have numerous paper amendments.27 It is highly probable that many B-Pläne, especially in smaller municipalities, exist only as paper originals or scanned images stored in an archive.  
In this scenario, if a plan cannot be located online, the user *must* contact the *zuständige Stelle* (responsible authority) directly.2 This is the local *Bauamt* (Building Authority), *Planungsamt* (Planning Office), or *Bauverwaltung* (Building Administration).1 The process will involve a formal request for *Akteneinsicht* (file inspection) 15, which may involve fees for staff time and document duplication.2

## **III. Process for Acquiring Land Use & Foundational Geodata (The State Level)**

This section details the centralized state-level process for acquiring *descriptive* (non-legal) geodata, which directly addresses the "data usage" part of the query.

### **A. Primary State-Level Authorities: LGLN and LBEG**

This process is dominated by two central state agencies.

1\. LGLN (Landesamt für Geoinformation und Landesvermessung Niedersachsen):  
The LGLN is the primary state provider for all Geobasisdaten (geobasic data).5 It is the authority for the official real estate cadastre (Liegenschaftskataster) and all related digital information systems (ALKIS, ATKIS).5 While it is a central agency, it operates through numerous regional directorates and local cadastral offices (Katasterämter), which serve as points of contact.3  
2\. LBEG (Landesamt für Bergbau, Energie und Geologie):  
The LBEG is a separate state agency responsible for sub-surface and specialized environmental data.7 It is the correct authority for acquiring Bodenkarten (soil maps), geological surveys, and data on mining or natural resources.8

### **B. Acquisition Process 1: Official Cadastral Maps (*Liegenschaftskarten*)**

* **Definition:** This is the *Liegenschaftskarte*, or official cadastral map. It displays official property boundaries, parcel numbers (*Flurstücke*), and building footprints.  
* **Critical Distinction:** This map **does not contain zoning information**. It is a descriptive map of legal property boundaries. The LGLN explicitly warns users not to confuse these *Katasterkarten* with the *Lageplan* (site plan) required by building authorities for development applications.18  
* **Portal:** Access is provided via the LGLN's "Katasterkarten-online" service.18  
* **A Dual-Purpose Portal:** This single portal serves two distinct needs, differentiated by the user's objective and the final deliverable.  
  * **Path A: Paid Official Extract (for Legal/Financial Use):**  
    * **Use Case:** Required for official purposes such as credit applications, real estate purchases, or preliminary building inquiries.20  
    * **Process:** The user selects an area, chooses a map style (e.g., *Liegenschaftskarte*, *Amtliche Karte 1:5000*) and a paper size, and pays via common online methods (PayPal, Giropay, credit card).18  
    * **Deliverable:** A legally valid **PDF** document.18  
  * **Path B: Free Open Geodata (for GIS Analysis):**  
    * **Use Case:** For planners, developers, and analysts who need the raw vector data as a base layer in a Geoinformation System (GIS).18  
    * **Process:** The same service allows for the *kostenfrei* (free of charge) download of this official digital geodata.18  
    * **Deliverable:** GIS-ready vector and raster data in standard formats, including **Shape (Shapefile der Fa. ESRI)**, **GeoPackage**, **DXF**, NAS, and TIF.18

### **C. Acquisition Process 2: Actual Land Use Data (*Landnutzung*)**

This process provides the direct answer to the "data usage" component of the query.

* **Dataset:** The definitive dataset is **"ALKIS Landnutzung"**.10  
* **Definition:** This dataset describes the *actual* character of land based on its current or foreseeable socio-economic function. This includes categories like residential, industrial, commercial, agricultural, forest, or recreational areas.9  
* **Source:** The data is derived on a statewide basis from the *Amtliches Liegenschaftskatasterinformationssystem* (ALKIS), the official digital cadastre.9  
* **Portal:** The data is available from the LGLN's **"OpenGeoData Niedersachsen"** portal, which is an ArcGIS Hub (https://ni-lgln-opengeodata.hub.arcgis.com/).21  
* **Cost & License:** This dataset is provided as **Free Open Data**.9 It is licensed under the **Creative Commons Namensnennung – 4.0 International (CC BY 4.0)**, which requires attribution (e.g., "LGLN (2024)").9  
* **Formats:** The primary download is a **ZIP-Ordner mit GeoPackage** (ZIP folder with GeoPackage).22 The portal also supports downloads in CSV, KML, GeoJSON, and provides API access via WMS (Web Map Service) and WFS (Web Feature Service).21  
* **Technical Specifications:** The data is provided in the EPSG 25832 (ETRS89/UTM 32N) coordinate reference system.22

### **D. Acquisition Process 3: Soil and Geological Data (*Bodenkarten*)**

For specialized analysis, particularly for agricultural, environmental, or construction purposes, data on soil and geology is required. This information is not held by the LGLN.

* **Authority:** The responsible agency is the **Landesamt für Bergbau, Energie und Geologie (LBEG)**.8  
* **Data Types:** The LBEG manages *Bodenkarten* (Soil Maps) at various scales (e.g., 1:50,000, 1:25,000, 1:5,000) 8, the *Karte der historischen Landnutzung* (Map of Historical Land Use) 8, and data on "Schutzwürdige Böden" (Soils Worthy of Protection).23  
* **Process (Mixed):** The LBEG employs a mixed-access model:  
  * **Viewing:** Free visualization of over 400 data layers is available via the LBEG's own "NIBIS KARTENSERVER".8  
  * **Downloading (Free):** Some specific datasets, such as "Soils Worthy of Protection" and soil regions, are available as a *kostenfreier Download* (free download).23  
  * **Purchasing (Paid):** Most official plot outputs, digital datasets, and printed maps are a paid service. These must be acquired directly from the LBEG (referencing their product catalog) or from designated distributors like the Internationales Landkartenhaus (ILH).8  
* **Formats:** Available formats include **Shapefile** 23, **PDF** 26, and **WMS**.8

## **IV. Reference Guide: Key Data Portals and Viewers**

The Niedersachsen geodata ecosystem involves multiple portals, each with a specific function. Using the wrong portal for a task will lead to confusion and failure. The following guide clarifies the primary function of each key portal.

### **A. The "Data Download" Portal: LGLN OpenGeoData Hub**

* **Portal:** ni-lgln-opengeodata.hub.arcgis.com 21  
* **Primary Function:** **Acquisition (Download).** This is the LGLN's data-sharing warehouse for its free, open data products.  
* **Use For:** Downloading statewide, GIS-ready datasets, primarily **ALKIS Landnutzung** 10, 3D Building Models 10, Digital Terrain Models 10, and ATKIS Digital Landscape Models.39

### **B. The "Data Discovery" Portal: GDI-NI Geoportal**

* **Portal:** www.geodaten.niedersachsen.de 42  
* **Primary Function:** **Discovery (Metadata Search).** This is the central "card catalog" for the Geodateninfrastruktur Niedersachsen (GDI-NI), or state spatial data infrastructure.  
* **Use For:** Searching for *who* has *what* data. It aggregates metadata from *all* sources, including LGLN, LBEG, and individual municipalities.40 A search here for "Bebauungspläne" 14 will not provide the plan itself, but will *point to* the responsible municipal authority (e.g., Stadt Oldenburg 17 or Landkreis Lüneburg 14).

### **C. The "Cadastral" Portal: Katasterkarten-online**

* **Portal:** maps.lgln.niedersachsen.de/katasterkarten-online/... 18  
* **Primary Function:** **Acquisition (Cadastral Data).**  
* **Use For:** This is the specialized portal for acquiring official cadastral maps (parcel data). It must be used for its two distinct purposes: 1\) Ordering the **paid PDF** extract for legal/financial use 18 or 2\) Downloading the **free Shapefile/GeoPackage** for GIS analysis.18

### **D. The "State Map Viewer": Geobasis.NI**

* **Portal:** www.geobasis.niedersachsen.de 45  
* **Primary Function:** **Visualization (Viewing).**  
* **Use For:** This is the LGLN's simple web map viewer for *looking at* the state's geobasic data.46 It includes functions like searching for parcels (*Flurstück suchen*) and measuring.45 It is for *viewing only* and is not a portal for data download or zoning analysis.45

### **E. The "Zoning Register" Portal: UVP-Portal Niedersachsen**

* **Portal:** uvp.niedersachsen.de 13  
* **Primary Function:** **Discovery (Zoning Procedures).**  
* **Use For:** This is the "zentrales Internetportal des Landes".13 This should be the **starting point for finding *Bauleitpläne* (zoning plans)**. It serves as a central register of planning procedures that *links to* the final plan documents hosted on the individual municipal websites.13

### **F. The "Soil/Geology Viewer": NIBIS Kartenserver**

* **Portal:** nibis.lbeg.de 8  
* **Primary Function:** **Visualization (Specialized).**  
* **Use For:** Viewing specialized LBEG data, including *Bodenkarten* (soil maps), geology, mining, and other sub-surface information.8

## **V. Concluding Analysis and Strategic Workflow**

### **A. The Integrated Workflow: A Dual-Track Strategy**

A comprehensive analysis requires executing both the decentralized (zoning) and centralized (geodata) acquisition processes.

**Workflow for Legal Zoning (The "Planned Use" Analysis):**

1. **Discover:** Start at the **UVP-Portal** (uvp.niedersachsen.de).13 Search for the municipality or area of interest to find the relevant *Bauleitplanung* procedure.  
2. **Redirect:** Follow the link from the UVP-Portal to the **Municipal Portal** (e.g., hannover.de, oldenburg.de).11  
3. **Locate:** On the municipal site, navigate the planning/building section to locate the specific *Bebauungsplan* (B-Plan) and *Flächennutzungsplan* (F-Plan) for the target area.  
4. **Download:** Secure the **Plan Documents (typically PDF)**. Pay close attention to the *textliche Festsetzungen* (textual regulations), which contain the binding legal rules, as these are often in a separate document from the map.  
5. **Inquire:** If plans are not found online, contact the municipal *Bauamt* or *Planungsamt* directly to request *Akteneinsicht* (file inspection).2

**Workflow for Geospatial Data (The "Actual Use" Analysis):**

1. **Base Map:** Go to the **LGLN "Katasterkarten-online"** portal.18 Download the **free Open Data GeoPackage/Shapefile** of the *Liegenschaftskarte* (cadastral parcels) to serve as the base map.  
2. **Land Use Data:** Go to the **LGLN "OpenGeoData Hub"** (ni-lgln-opengeodata.hub.arcgis.com).21 Download the **free Open Data GeoPackage** of the **"ALKIS Landnutzung"** dataset.9  
3. **Soil Data (Optional):** Go to the **LBEG "NIBIS Kartenserver"** (nibis.lbeg.de) 24 to view *Bodenkarten* (soil maps) and check for free downloads.23

### **B. Strategic Recommendation: Data Integration for Gap Analysis**

The most critical expert-level task is not merely acquiring these two separate data streams (legal-zoning and actual-land-use) but integrating them to perform a gap analysis. This integration reveals actionable intelligence by comparing the legally permissible use with the current factual use.

The B-Plan from the municipality is legally authoritative but often a "dumb" document (a non-georeferenced PDF scan). The ALKIS Landnutzung data from the state is geographically "smart" (a vector file) but has no legal-planning force. The expert workflow is to combine them.

**Recommended GIS Integration Process:**

1. **Step 1 (Base Layer):** Load the free cadastral parcel Shapefile (from *Katasterkarten-online*) into a GIS (e.g., QGIS, ArcGIS).  
2. **Step 2 (Actual Use):** Overlay the *ALKIS Landnutzung* GeoPackage (from *OpenGeoData Hub*). This allows the user to click on any parcel and see its *current actual use* (e.g., "Residential," "Agriculture").  
3. **Step 3 (Legal Plan):** Import the *B-Plan PDF* (from the *Municipal Portal*) into the same GIS project.  
4. **Step 4 (Georeferencing):** Use the GIS georeferencing tools to "stretch" and "pin" the B-Plan PDF image, aligning its parcel boundaries (visible on the scan) with the *actual* parcel boundaries from the cadastral Shapefile (from Step 1).  
5. **Step 5 (Gap Analysis):** With both layers (ALKIS and B-Plan) correctly aligned over the base map, an analyst can immediately identify:  
   * **Opportunity:** Parcels where *Actual Use (ALKIS)* is "Agriculture" but *Legal Zoning (B-Plan)* is "Future Commercial/Industrial." This is a prime development target.  
   * **Risk / Non-Conformity:** Parcels where *Actual Use (ALKIS)* is "Industrial" but *Legal Zoning (B-Plan)* is "Residential." This signals a legal non-conforming use or a potential brownfield site.  
   * **Constraint:** Parcels where the *B-Plan* or *F-Plan* designates *Grünfläche* (Green Space), *Wasserschutzgebiet* (Water Protection Area), or other restrictions, thereby invalidating a potential project.

### **C. Final Procedural Checklists and Glossary**

**Checklist 1: Legal Zoning (*Bauleitplanung*)**

* \[ \] Identify target municipality.  
* \[ \] Search **UVP-Portal** (uvp.niedersachsen.de) for the *Bauleitplanung* procedure.  
* \[ \] Follow link to **Municipal Portal**.  
* \[ \] Locate and download *Bebauungsplan* (B-Plan) and *Flächennutzungsplan* (F-Plan) (usually PDF).  
* \[ \] If unavailable, contact municipal *Bauamt* (Building Authority) for *Akteneinsicht* (file inspection).

**Checklist 2: Land Use & Geodata (*Geodaten*)**

* \[ \] Access **"Katasterkarten-online"** (maps.lgln.niedersachsen.de/...).  
* \[ \] Download free **Cadastral Shapefile/GeoPackage** (base map).  
* \[ \] Access **"OpenGeoData Hub"** (ni-lgln-opengeodata.hub.arcgis.com).  
* \[ \] Download free **"ALKIS Landnutzung" GeoPackage** (actual use).  
* \[ \] (Optional) Access **"NIBIS Kartenserver"** (nibis.lbeg.de) for soil/geology data.

**Glossary of Key Terms**

* ***Bauleitplanung***: (Urban Development Planning) The overarching term for the two-tiered legal planning system.  
* ***Bebauungsplan*** **(B-Plan)**: The legally binding, parcel-specific zoning plan issued by a municipality.1  
* ***Flächennutzungsplan*** **(F-Plan)**: The preparatory, strategic land use plan for an entire municipality, binding on the administration.16  
* ***GDI-NI***: (*Geodateninfrastruktur Niedersachsen*) The state's Spatial Data Infrastructure, a framework for sharing geodata. The geodaten.niedersachsen.de portal is its central catalog.43  
* ***Kommune***: (Municipality) The local-level government (city, town, or *Samtgemeinde*) with sole authority for zoning.1  
* ***LBEG***: (*Landesamt für Bergbau, Energie und Geologie*) The state agency for mining, energy, and geology, responsible for soil maps (*Bodenkarten*).8  
* ***LGLN***: (*Landesamt für Geoinformation und Landesvermessung Niedersachsen*) The primary state agency for geoinformation, land surveying, and the real estate cadastre.3  
* ***Liegenschaftskataster***: The official Real Estate Cadastre, a public register of all property parcels.18  
* ***Planungshoheit***: (Planning Sovereignty) The constitutionally protected right of *Kommunen* (municipalities) to be the sole authority for local zoning.1

#### **Works cited**

1. Bauleitplanung \- Stadt Geestland, accessed on October 25, 2025, [https://www.geestland.eu/Rathaus/Buergermeisterin.htm/Dienstleistungen/Bauleitplanung.html?](https://www.geestland.eu/Rathaus/Buergermeisterin.htm/Dienstleistungen/Bauleitplanung.html)  
2. Bauleitplanung \- Serviceportal Niedersachsen, accessed on October 25, 2025, [https://ni.zfinder.de/detail?pstId=8664292](https://ni.zfinder.de/detail?pstId=8664292)  
3. Simple German \- Serviceportal Niedersachsen, accessed on October 25, 2025, [https://service.niedersachsen.de/en/detail?areaId=31550\&pstGroupId=\&pstCatId=454393269\&pstId=8702837\&ouId=454393269\&infotype=0\&ags=03454](https://service.niedersachsen.de/en/detail?areaId=31550&pstGroupId&pstCatId=454393269&pstId=8702837&ouId=454393269&infotype=0&ags=03454)  
4. Real estate cadastre information \- Obtain official boundary information \- Serviceportal Niedersachsen, accessed on October 25, 2025, [https://service.niedersachsen.de/en/detail?areaId=27608\&pstGroupId=\&pstCatId=454393269\&pstId=434382861\&infotype=0\&ags=03257](https://service.niedersachsen.de/en/detail?areaId=27608&pstGroupId&pstCatId=454393269&pstId=434382861&infotype=0&ags=03257)  
5. State Office for Geoinformation and State Surveying of Lower Saxony (LGLN) \- GoGeoGo, accessed on October 25, 2025, [https://www.gogeogo.com/en/company/landesamt-fur-geoinformation-und-landesvermessung-niedersachsen-lgln](https://www.gogeogo.com/en/company/landesamt-fur-geoinformation-und-landesvermessung-niedersachsen-lgln)  
6. ️State Office for Geoinformation and Land Surveying Niedersachsen — Government Agency from Germany, experience with Horizon 2020 — Mapping & Cadastre sector \- Development Aid, accessed on October 25, 2025, [https://www.developmentaid.org/organizations/view/272096/state-office-for-geoinformation-and-land-surveying-niedersachsen](https://www.developmentaid.org/organizations/view/272096/state-office-for-geoinformation-and-land-surveying-niedersachsen)  
7. Kartenserver des LBEG Niedersachsen \- Geoportal.de, accessed on October 25, 2025, [https://www.geoportal.de/Info/1b760fe4-e0e6-4511-b2d0-b1a9061c63d1](https://www.geoportal.de/Info/1b760fe4-e0e6-4511-b2d0-b1a9061c63d1)  
8. Bodenkarten | Landesamt für Bergbau, Energie und Geologie, accessed on October 25, 2025, [https://www.lbeg.niedersachsen.de/karten\_daten\_publikationen/karten\_daten/boden/bodenkarten/bodenkarten-728.html](https://www.lbeg.niedersachsen.de/karten_daten_publikationen/karten_daten/boden/bodenkarten/bodenkarten-728.html)  
9. ALKIS Landnutzung \- Geoportal Niedersachsen, accessed on October 25, 2025, [https://geoportal.geodaten.niedersachsen.de/harvest/srv/api/records/c046ddfd-da11-4ccb-a095-f7a2aea7c1e6](https://geoportal.geodaten.niedersachsen.de/harvest/srv/api/records/c046ddfd-da11-4ccb-a095-f7a2aea7c1e6)  
10. OpenGeoData | Landesamt für Geoinformation und Landesvermessung Niedersachsen, accessed on October 25, 2025, [https://www.lgln.niedersachsen.de/startseite/vertrieb\_support/geodaten\_marktplatz/opengeodata/opengeodata-220509.html](https://www.lgln.niedersachsen.de/startseite/vertrieb_support/geodaten_marktplatz/opengeodata/opengeodata-220509.html)  
11. Bebauungspläne | Bauleitplanung & Beteiligung | Stadtplanung & Stadtentwicklung | Planen, Bauen, Wohnen | Leben in der Region Hannover, accessed on October 25, 2025, [https://www.hannover.de/Leben-in-der-Region-Hannover/Planen,-Bauen,-Wohnen/Stadtplanung-Stadtentwicklung/Bauleitplanung-Beteiligung/Bebauungspl%C3%A4ne](https://www.hannover.de/Leben-in-der-Region-Hannover/Planen,-Bauen,-Wohnen/Stadtplanung-Stadtentwicklung/Bauleitplanung-Beteiligung/Bebauungspl%C3%A4ne)  
12. Allgemeine Information zur Bauleitplanung \- Stadt Oldenburg, accessed on October 25, 2025, [https://www.oldenburg.de/startseite/leben-umwelt/planen-bauen/stadtplanung/bauleitplanung/allgemeine-information-zur-bauleitplanung.html](https://www.oldenburg.de/startseite/leben-umwelt/planen-bauen/stadtplanung/bauleitplanung/allgemeine-information-zur-bauleitplanung.html)  
13. Bauleitplanung | Nds. Ministerium für Wirtschaft, Verkehr und Bauen, accessed on October 25, 2025, [https://www.mw.niedersachsen.de/startseite/bauen\_wohnen/stadtebau\_bauleitplanung\_baukultur/bauleitplanung-217104.html](https://www.mw.niedersachsen.de/startseite/bauen_wohnen/stadtebau_bauleitplanung_baukultur/bauleitplanung-217104.html)  
14. Bebauungspläne \- Alte Geodatensuche Niedersachsen \- Koordinierungsstelle GDI-NI, accessed on October 25, 2025, [https://geoportal.geodaten.niedersachsen.de/harvest/srv/search?keyword=Bebauungspl%C3%A4ne](https://geoportal.geodaten.niedersachsen.de/harvest/srv/search?keyword=Bebauungspl%C3%A4ne)  
15. Bauaktenarchiv | Stadt Hannover, accessed on October 25, 2025, [https://serviceportal.hannover-stadt.de/buergerservice/dienstleistungen/bauaktenarchiv-900000217-0.html?myMedium=1](https://serviceportal.hannover-stadt.de/buergerservice/dienstleistungen/bauaktenarchiv-900000217-0.html?myMedium=1)  
16. Flächennutzungsplan \- Serviceportal Niedersachsen, accessed on October 25, 2025, [https://service.niedersachsen.de/detail?pstId=8664697](https://service.niedersachsen.de/detail?pstId=8664697)  
17. Flächennutzungsplan Stadt Oldenburg \- Geoportal Niedersachsen, accessed on October 25, 2025, [https://geoportal.geodaten.niedersachsen.de/harvest/srv/api/records/b9e13997-8777-49b3-a097-9ba722be824f](https://geoportal.geodaten.niedersachsen.de/harvest/srv/api/records/b9e13997-8777-49b3-a097-9ba722be824f)  
18. Katasterkarten-online | Landesamt für Geoinformation und ..., accessed on October 25, 2025, [https://www.lgln.niedersachsen.de/katasterkarten-online/katasterkarten-online-174036.html](https://www.lgln.niedersachsen.de/katasterkarten-online/katasterkarten-online-174036.html)  
19. Landesamt für Geoinformation und Landesvermessung Niedersachsen (LGLN) \- Land Niedersachsen, accessed on October 25, 2025, [https://www.lgln.niedersachsen.de/startseite/](https://www.lgln.niedersachsen.de/startseite/)  
20. Online-Anwendungen | Landesamt für Geoinformation und Landesvermessung Niedersachsen, accessed on October 25, 2025, [https://www.lgln.niedersachsen.de/startseite/vertrieb\_support/geodaten\_marktplatz/online\_anwendungen\_alt/](https://www.lgln.niedersachsen.de/startseite/vertrieb_support/geodaten_marktplatz/online_anwendungen_alt/)  
21. OpenGeoData Niedersachsen, accessed on October 25, 2025, [https://ni-lgln-opengeodata.hub.arcgis.com/](https://ni-lgln-opengeodata.hub.arcgis.com/)  
22. ALKIS Landnutzung | OpenGeoData Niedersachsen, accessed on October 25, 2025, [https://ni-lgln-opengeodata.hub.arcgis.com/pages/alkis-landnutzung](https://ni-lgln-opengeodata.hub.arcgis.com/pages/alkis-landnutzung)  
23. Schutzwürdige Böden in Niedersachsen 1 : 50 000 \- Böden mit besonderen Standorteigenschaften \- INSPIRE Geoportal, accessed on October 25, 2025, [https://inspire-geoportal.ec.europa.eu/srv/api/records/0940cd07-5ee9-4eb5-9fb4-78e438acf429](https://inspire-geoportal.ec.europa.eu/srv/api/records/0940cd07-5ee9-4eb5-9fb4-78e438acf429)  
24. cardo.Map::touch \- LBEG, accessed on October 25, 2025, [https://nibis.lbeg.de/cardomap3/](https://nibis.lbeg.de/cardomap3/)  
25. Bodenkundliche Übersichtskarte von Niedersachsen und Bremen 1 : 500 000 \- LBEG, accessed on October 25, 2025, [https://nibis.lbeg.de/geonetwork/srv/api/records/5af56b77-de7f-4a80-8067-9db45e689e01](https://nibis.lbeg.de/geonetwork/srv/api/records/5af56b77-de7f-4a80-8067-9db45e689e01)  
26. Bodenübersichtskarte im Maßstab 1 : 50 000 (BÜK50), accessed on October 25, 2025, [https://www.lbeg.niedersachsen.de/karten\_daten\_publikationen/karten\_daten/boden/bodenkarten/bodenkundliche\_uebersichtskarte\_150000/bodenuebersichtskarte-im-mastab-1--50-000-buek50-654.html](https://www.lbeg.niedersachsen.de/karten_daten_publikationen/karten_daten/boden/bodenkarten/bodenkundliche_uebersichtskarte_150000/bodenuebersichtskarte-im-mastab-1--50-000-buek50-654.html)  
27. Flächennutzungsplan \- Wikipedia, accessed on October 25, 2025, [https://de.wikipedia.org/wiki/Fl%C3%A4chennutzungsplan](https://de.wikipedia.org/wiki/Fl%C3%A4chennutzungsplan)  
28. Bebauungsplan | Stadt Hannover, accessed on October 25, 2025, [https://serviceportal.hannover-stadt.de/buergerservice/dienstleistungen/bebauungsplan-1042-0.html?myMedium=1](https://serviceportal.hannover-stadt.de/buergerservice/dienstleistungen/bebauungsplan-1042-0.html?myMedium=1)  
29. Bauleitplanung \- Serviceportal Niedersachsen, accessed on October 25, 2025, [https://service.niedersachsen.de/detail?areaId=32909\&area=Ohrum%20(38312)\&ags=03158023\&searchtext=\&pstId=8664292\&infotype=0\&pstCatId=\&sort=](https://service.niedersachsen.de/detail?areaId=32909&area=Ohrum+\(38312\)&ags=03158023&searchtext&pstId=8664292&infotype=0&pstCatId&sort)  
30. Bauleitpläne wirksam/rechtskräftig 2025: Aurich.de, accessed on October 25, 2025, [https://www.aurich.de/bauen-wohnen/bauleitplanung/bauleitplaene-wirksam/rechtskraeftig-2025.html](https://www.aurich.de/bauen-wohnen/bauleitplanung/bauleitplaene-wirksam/rechtskraeftig-2025.html)  
31. Internetportal für Umweltverträglichkeitsprüfungen und Bauleitplanung | Nds. Ministerium für Umwelt, Energie und Klimaschutz, accessed on October 25, 2025, [https://www.umwelt.niedersachsen.de/startseite/service/umweltinformationssysteme/uvp\_portal/internetportal-fur-umweltvertraglichkeitsprufungen-und-bauleitplanung-174259.html](https://www.umwelt.niedersachsen.de/startseite/service/umweltinformationssysteme/uvp_portal/internetportal-fur-umweltvertraglichkeitsprufungen-und-bauleitplanung-174259.html)  
32. Das niedersächsische UVP-Portal als Informationsplattform \- IHK Hannover, accessed on October 25, 2025, [https://www.ihk.de/hannover/hauptnavigation/standort/planen-bauen/bauleitplanung/planverfahren/das-niedersaechsische-uvp-portal-als-informationsplattform-5174638](https://www.ihk.de/hannover/hauptnavigation/standort/planen-bauen/bauleitplanung/planverfahren/das-niedersaechsische-uvp-portal-als-informationsplattform-5174638)  
33. Umweltverträglichkeitsprüfungen (UVP) in den Bundesländern ..., accessed on October 25, 2025, [https://uvp.niedersachsen.de/](https://uvp.niedersachsen.de/)  
34. Geoinformationssystem (GIS) | Bürger-Service in der Landeshauptstadt Hannover, accessed on October 25, 2025, [https://www.hannover.de/Leben-in-der-Region-Hannover/B%C3%BCrger-Service/B%C3%BCrger-Service-in-der-Landeshauptstadt-Hannover/Geoinformations%C2%ADsystem-GIS](https://www.hannover.de/Leben-in-der-Region-Hannover/B%C3%BCrger-Service/B%C3%BCrger-Service-in-der-Landeshauptstadt-Hannover/Geoinformations%C2%ADsystem-GIS)  
35. Umringe rechtsverbindlicher Bebauungspläne Stadt Oldenburg \- Geoportal Niedersachsen, accessed on October 25, 2025, [https://geoportal.geodaten.niedersachsen.de/harvest/srv/api/records/4c1a93f9-295a-492f-8d16-aee99a5bb585](https://geoportal.geodaten.niedersachsen.de/harvest/srv/api/records/4c1a93f9-295a-492f-8d16-aee99a5bb585)  
36. Amtliches Topographisch-Kartographisches InformationsSystem (ATKIS) | Landesamt für Geoinformation und Landesvermessung Niedersachsen, accessed on October 25, 2025, [https://www.lgln.niedersachsen.de/startseite/geodaten\_karten/afis\_alkis\_atkis/amtliches-topographisch-kartographisches-informationssystem-atkis-92948.html](https://www.lgln.niedersachsen.de/startseite/geodaten_karten/afis_alkis_atkis/amtliches-topographisch-kartographisches-informationssystem-atkis-92948.html)  
37. Landesamt für Geoinformation und Landesvermessung Niedersachsen \- Wikipedia, accessed on October 25, 2025, [https://de.wikipedia.org/wiki/Landesamt\_f%C3%BCr\_Geoinformation\_und\_Landesvermessung\_Niedersachsen](https://de.wikipedia.org/wiki/Landesamt_f%C3%BCr_Geoinformation_und_Landesvermessung_Niedersachsen)  
38. LGLN: Lagepläne online beantragen \- Business Geomatics, accessed on October 25, 2025, [https://www.business-geomatics.com/lgln-lageplaene-online-beantragen/](https://www.business-geomatics.com/lgln-lageplaene-online-beantragen/)  
39. OpenGeoData.NI: Niedersachsen ermöglicht freien Zugriff auf Geodaten, accessed on October 25, 2025, [https://www.geo.uni-hannover.de/de/fzgeo/news-und-veranstaltungen/details/news/opengeodatani-niedersachsen-ermoeglicht-freien-zugriff-auf-geodaten](https://www.geo.uni-hannover.de/de/fzgeo/news-und-veranstaltungen/details/news/opengeodatani-niedersachsen-ermoeglicht-freien-zugriff-auf-geodaten)  
40. Open Data Portale \- Geodatenportal Niedersachsen, accessed on October 25, 2025, [https://www.geodaten.niedersachsen.de/startseite/datenangebot/open\_data\_portale/open-data-portale-136000.html](https://www.geodaten.niedersachsen.de/startseite/datenangebot/open_data_portale/open-data-portale-136000.html)  
41. Digitales Landschaftsmodell (Basis-DLM) \- Landesamt für Geoinformation und Landesvermessung Niedersachsen (LGLN), accessed on October 25, 2025, [https://www.lgln.niedersachsen.de/startseite/geodaten\_karten/topographische\_geodaten\_aus\_atkis/dlm/digitales-landschaftsmodell-basis-dlm-144141.html](https://www.lgln.niedersachsen.de/startseite/geodaten_karten/topographische_geodaten_aus_atkis/dlm/digitales-landschaftsmodell-basis-dlm-144141.html)  
42. Geodatenportal Niedersachsen, accessed on October 25, 2025, [https://www.geodaten.niedersachsen.de/startseite/](https://www.geodaten.niedersachsen.de/startseite/)  
43. Kontaktstellen GDI-DE | Geodateninfrastruktur Deutschland, accessed on October 25, 2025, [https://www.gdi-de.org/GDI-DE/Kontaktstellen](https://www.gdi-de.org/GDI-DE/Kontaktstellen)  
44. Katasterkarten-online OpenData, accessed on October 25, 2025, [https://maps.lgln.niedersachsen.de/katasterkarten-online/mapbender/application/katasterkarten-online\_opendata](https://maps.lgln.niedersachsen.de/katasterkarten-online/mapbender/application/katasterkarten-online_opendata)  
45. Geobasisdaten Niedersachsen, accessed on October 25, 2025, [https://www.geobasis.niedersachsen.de/](https://www.geobasis.niedersachsen.de/)  
46. Viewer \- Landesamt für Geoinformation und Landesvermessung Niedersachsen, accessed on October 25, 2025, [https://www.lgln.niedersachsen.de/startseite/wir\_uber\_uns/hilfe\_support/lgln\_lexikon/v/viewer-199984.html](https://www.lgln.niedersachsen.de/startseite/wir_uber_uns/hilfe_support/lgln_lexikon/v/viewer-199984.html)