import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { enrichedPlots } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

const PLOTS_TO_FETCH = 1000;

const db = drizzle(process.env.DATABASE_URL!, { 
  schema: { enrichedPlots } 
});

// Deprecated: bubble-based image fetching removed.

async function updatePlotImages(plotId: string, images: string[]) {
  try {
    await db
      .update(enrichedPlots)
      .set({ images: images })
      .where(eq(enrichedPlots.id, plotId));
    
    console.log(`Updated plot ${plotId} with ${images.length} images`);
  } catch (error) {
    console.error(`Error updating plot ${plotId}:`, error);
  }
}

async function main() {
  console.warn('This script is deprecated: bubbleId has been removed from the application. Exiting.');
  console.log('Done.');
}

// Run the script
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});