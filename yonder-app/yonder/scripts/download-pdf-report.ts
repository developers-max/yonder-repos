/**
 * Download PDF report directly from GCS
 * Usage: tsx scripts/download-pdf-report.ts <plotId> [output-file]
 */

import { db } from '../src/lib/db';
import { enrichedPlots } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getFileStream } from '../src/lib/utils/remote-clients/gcs-client';
import * as fs from 'fs';
import * as path from 'path';

const plotId = process.argv[2];
const outputFile = process.argv[3] || `plot-${plotId}-report.pdf`;

if (!plotId) {
  console.error('❌ Usage: tsx scripts/download-pdf-report.ts <plotId> [output-file]');
  process.exit(1);
}

async function downloadPdf() {
  console.log('🔍 Fetching plot report for:', plotId);
  console.log('');

  try {
    // Get plot and report URL
    const [plot] = await db
      .select({
        id: enrichedPlots.id,
        plotReportUrl: enrichedPlots.plotReportUrl,
      })
      .from(enrichedPlots)
      .where(eq(enrichedPlots.id, plotId))
      .limit(1);

    if (!plot) {
      console.error('❌ Plot not found');
      process.exit(1);
    }

    if (!plot.plotReportUrl) {
      console.error('❌ No PDF report URL available for this plot');
      process.exit(1);
    }

    console.log('✅ Plot found');
    console.log('   Report URL:', plot.plotReportUrl);
    console.log('');

    // Get file stream from GCS
    console.log('📥 Downloading PDF from GCS...');
    const stream = await getFileStream(plot.plotReportUrl);

    // Create output directory if needed
    const outputDir = path.dirname(outputFile);
    if (outputDir !== '.' && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create write stream
    const writeStream = fs.createWriteStream(outputFile);

    // Pipe the download
    stream.pipe(writeStream);

    // Wait for completion
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', (error) => reject(error));
      stream.on('error', (error) => reject(error));
    });

    const stats = fs.statSync(outputFile);
    console.log('✅ PDF downloaded successfully!');
    console.log('');
    console.log('📄 File details:');
    console.log('   Location:', path.resolve(outputFile));
    console.log('   Size:', (stats.size / 1024).toFixed(2), 'KB');
    console.log('');
    console.log('💡 Open with: open', outputFile);

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

downloadPdf();
