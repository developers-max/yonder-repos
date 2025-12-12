# Map Layers Guide - Portugal

This guide explains each map layer available in Yonder, how to interpret the data, and practical use cases for land/property analysis.

---

## Quick Reference

| Layer | What it Shows | Key Use Case |
|-------|---------------|--------------|
| **Cadastre** | Property boundaries | Identify exact parcel limits |
| **CRUS** | Zoning (PDM) | Check what can be built |
| **REN** | Ecological restrictions | Identify building restrictions |
| **RAN** | Agricultural restrictions | Identify building restrictions |
| **COS** | Current land cover | See what's physically on the land |
| **Municipalities** | Administrative boundaries | Identify municipality |

---

## 1. Cadastre (Cadastro Predial)

### What it Shows
Property boundaries from the Portuguese Land Registry (DGT). Each polygon represents a legally registered parcel of land.

### How to Interpret
- **Red outlines** = Individual property parcels
- Each parcel has a unique cadastral reference number
- Boundaries are legally binding

### Use Cases
- ✅ Verify if a plot for sale matches the registered parcel
- ✅ Check if multiple parcels are being sold together
- ✅ Identify neighboring properties
- ✅ Detect boundary disputes or overlaps

### Limitations
- Coverage is not 100% complete across Portugal
- Some rural areas have incomplete cadastre data
- Updates may lag behind recent transactions

---

## 2. CRUS (Zonamento PDM)

### What it Shows
**Carta do Regime de Uso do Solo** - Zoning classification from Municipal Master Plans (PDM).
Shows what the land is **legally designated for**, not what's physically there.

### How to Interpret

| Color | Classification | Meaning |
|-------|----------------|---------|
| 🔴 Red | **Solo Urbano** | Urban land - generally buildable |
| 🟠 Orange | **Solo Urbanizável** | Urbanizable - can be developed in future |
| 🟢 Green | **Solo Rural/Rústico** | Rural land - limited building rights |
| 🌿 Light Green | **Espaço Agrícola** | Agricultural space |
| 🌊 Teal | **Espaço Florestal** | Forest space |
| 🔵 Cyan | **Espaço Natural** | Natural/protected space |

### Use Cases
- ✅ Check if construction is possible on a plot
- ✅ Understand development potential
- ✅ Compare asking price vs. zoning (urban land is more valuable)
- ✅ Identify if rezoning might increase value

### Important Warning
> ⚠️ **CRUS is for informational purposes only.** For legal decisions about construction permits, always consult the actual PDM at the local Câmara Municipal.

### Limitations
- Data is harmonized across municipalities (may lose detail)
- PDM updates may not be immediately reflected
- Does not show building density/height limits

---

## 3. REN (Reserva Ecológica Nacional)

### What it Shows
**National Ecological Reserve** - Areas with special ecological value or susceptibility to natural hazards where construction is restricted or prohibited.

### How to Interpret
- **Green shaded areas** = REN protected zones
- These areas have **legal building restrictions**
- Restrictions aim to protect:
  - Coastal zones
  - Water bodies and wetlands
  - Steep slopes
  - Flood-prone areas
  - Areas of high ecological value

### Use Cases
- ✅ **Critical for buyers** - Check if plot has REN restrictions
- ✅ Understand why a plot might be cheaper
- ✅ Identify environmental risks (flooding, erosion)
- ✅ Plan around unbuildable portions of land

### What REN Restrictions Mean
- 🚫 Generally **cannot build** housing in REN areas
- ⚠️ Some exceptions exist (requires special approval)
- 📋 Must apply for REN exclusion (demorado e incerto)

### Red Flags
- Plot entirely within REN = likely unbuildable
- Cheap "buildable" land in REN = potential scam
- Always verify REN status before purchase

---

## 4. RAN (Reserva Agrícola Nacional)

### What it Shows
**National Agricultural Reserve** - Prime agricultural land where construction and non-agricultural uses are restricted.

### How to Interpret
- **Yellow/amber shaded areas** = RAN protected zones
- Land classified for its **agricultural aptitude**
- Building restrictions similar to REN

### Use Cases
- ✅ Check if plot has agricultural restrictions
- ✅ Understand land use limitations
- ✅ Identify high-quality agricultural land
- ✅ Plan agricultural investments

### What RAN Restrictions Mean
- 🚫 Generally **cannot build** non-agricultural structures
- 🌾 Land should be used for farming
- 📋 Exceptions require DRAP (regional agriculture) approval
- ⏱️ Exclusion process can take 6-12+ months

### Practical Tips
- RAN land is cheaper but has limited uses
- Good for: orchards, vineyards, agriculture
- Bad for: housing, tourism, commercial

---

## 5. COS (Land Use/Cover)

### What it Shows
**Carta de Ocupação do Solo** - What is physically on the land based on satellite imagery and aerial photography (2018 data).

### How to Interpret
This shows **current physical reality**, not legal status:

| Category | Examples |
|----------|----------|
| Urban | Buildings, roads, infrastructure |
| Agricultural | Crops, orchards, vineyards |
| Forest | Pine, eucalyptus, cork oak |
| Shrubland | Mato, scrub vegetation |
| Water | Rivers, reservoirs, wetlands |
| Bare | Rock, sand, cleared land |

### Use Cases
- ✅ Verify seller's description of land
- ✅ Identify existing vegetation/trees
- ✅ Assess land clearing needs
- ✅ Detect recent changes (compare with site visit)
- ✅ Environmental due diligence

### COS vs CRUS Example
| Scenario | COS Shows | CRUS Shows |
|----------|-----------|------------|
| Abandoned farm | Forest/Shrubland | Solo Rural - Agrícola |
| New development | Urban | Solo Urbanizável |
| Protected area | Forest | Espaço Natural |

---

## 6. Administrative Boundaries

### Municipalities (CAOP)
Shows municipal boundaries. Useful for:
- Identifying which Câmara Municipal has jurisdiction
- Understanding which PDM applies
- Property tax (IMI) jurisdiction

### Districts
Shows district boundaries (larger administrative regions).

### Parishes (Freguesias)
Shows parish boundaries (smallest administrative unit).

---

## Practical Workflow: Evaluating a Plot

### Step 1: Identify Location
1. Enable **Municipalities** layer
2. Confirm which municipality the plot is in
3. Note: This determines which PDM and Câmara apply

### Step 2: Check Zoning
1. Enable **CRUS** layer
2. Look at the color classification
3. **Green = Rural** (limited building) / **Red = Urban** (buildable)

### Step 3: Check Restrictions
1. Enable **REN** layer - Any green overlay?
2. Enable **RAN** layer - Any yellow overlay?
3. If either covers the plot → **Building restrictions apply**

### Step 4: Verify Physical State
1. Enable **COS** layer
2. Compare with listing description
3. Note existing vegetation, structures, access

### Step 5: Check Boundaries
1. Enable **Cadastre** layer
2. Verify plot boundaries match what's being sold
3. Check for neighboring properties

---

## Common Scenarios

### ✅ Good Investment Signal
- CRUS shows "Solo Urbano" or "Solo Urbanizável"
- No REN/RAN restrictions
- Cadastre boundaries are clear
- Located near existing infrastructure

### ⚠️ Proceed with Caution
- CRUS shows "Solo Rural" but seller claims "buildable"
- Partial REN/RAN coverage
- Cadastre data incomplete
- Remote location

### 🚫 Red Flags
- Entirely within REN or RAN
- CRUS shows "Espaço Natural" or "Florestal"
- No cadastre data available
- Price seems too good for the zoning

---

## Data Sources

| Layer | Source | Update Frequency |
|-------|--------|------------------|
| Cadastre | DGT OGC API | Ongoing |
| CRUS | DGT (from municipal PDMs) | When PDMs update |
| REN | DGT SRUP | Periodic |
| RAN | DGT SRUP | Periodic |
| COS | DGT | ~5 years (2018 latest) |
| CAOP | DGT | Annual |

---

## Disclaimer

> **This information is for educational and research purposes only.**
> 
> For any legal decisions regarding property purchase, construction permits, or land use, always:
> 1. Consult the local Câmara Municipal
> 2. Obtain official certidões (certificates)
> 3. Hire a qualified lawyer or architect
> 4. Request a topographic survey if needed
>
> Layer data may not reflect the most recent changes to municipal plans or property registrations.

---

*Last updated: December 2024*
