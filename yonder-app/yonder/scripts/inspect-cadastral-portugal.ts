import { db } from "@/lib/db";
import { enrichedPlots } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function inspectPortugalCadastral() {
  // Find a Portuguese plot by looking for cadastral reference pattern
  // Portuguese refs start with letters (e.g., AAA000124392)
  // Spanish refs are numeric (e.g., 18283N30F4912N)
  
  const plots = await db.query.enrichedPlots.findMany({
    limit: 100,
  });
  
  const portugalPlot = plots.find(p => {
    const enrichmentData = p.enrichmentData as Record<string, unknown> | null;
    const cadastralData = enrichmentData?.cadastral as Record<string, unknown> | null;
    const ref = cadastralData?.cadastral_reference as string | undefined;
    // Portuguese cadastral refs typically start with 3 letters
    return ref && /^[A-Z]{3}\d/.test(ref);
  });

  if (!portugalPlot) {
    console.log("No Portuguese plot found");
    return;
  }
  
  const plot = portugalPlot;

  console.log("\n=== PLOT INFO ===");
  console.log("ID:", plot.id);
  
  const enrichmentData = plot.enrichmentData as Record<string, unknown> | null;
  const cadastralData = enrichmentData?.cadastral as Record<string, unknown> | null;

  console.log("\n=== CADASTRAL DATA STRUCTURE ===");
  console.log("Has cadastral data:", !!cadastralData);
  
  if (cadastralData) {
    console.log("\nTop-level fields:");
    console.log("- cadastral_reference:", cadastralData.cadastral_reference);
    console.log("- address:", cadastralData.address);
    console.log("- municipality:", cadastralData.municipality);
    console.log("- province:", cadastralData.province);
    console.log("- parcel_count:", cadastralData.parcel_count);
    
    console.log("\nParcel object:");
    const parcel = cadastralData.parcel as Record<string, unknown> | undefined;
    if (parcel) {
      console.log("- Has parcel object: YES");
      console.log("- parcel.cadastral_reference:", parcel.cadastral_reference);
      console.log("- parcel.area_value:", parcel.area_value);
      console.log("- parcel.label:", parcel.label);
    } else {
      console.log("- Has parcel object: NO");
    }
    
    console.log("\nParcels array:");
    const parcels = cadastralData.parcels as unknown[] | undefined;
    if (parcels && parcels.length > 0) {
      console.log("- Has parcels array: YES");
      console.log("- Number of parcels:", parcels.length);
      console.log("- First parcel:", JSON.stringify(parcels[0], null, 2));
    } else {
      console.log("- Has parcels array: NO or empty");
    }
    
    console.log("\n=== FULL CADASTRAL DATA ===");
    console.log(JSON.stringify(cadastralData, null, 2));
  }
}

inspectPortugalCadastral()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
