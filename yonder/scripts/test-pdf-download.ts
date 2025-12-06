/**
 * Test script to check and download PDF report for a specific plot
 * Usage: tsx scripts/test-pdf-download.ts [plotId]
 */

import { db } from '../src/lib/db';
import { enrichedPlots } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { fileExists, getFileMetadata } from '../src/lib/utils/remote-clients/gcs-client';

const plotId = process.argv[2] || 'e0927cb4-0629-4085-ace7-61b23befa767';

async function testPdfDownload() {
  console.log('🔍 Checking plot:', plotId);
  console.log('');

  try {
    // Query the plot
    const [plot] = await db
      .select({
        id: enrichedPlots.id,
        plotReportUrl: enrichedPlots.plotReportUrl,
      })
      .from(enrichedPlots)
      .where(eq(enrichedPlots.id, plotId))
      .limit(1);

    if (!plot) {
      console.error('❌ Plot not found in database');
      process.exit(1);
    }

    console.log('✅ Plot found');
    console.log('   ID:', plot.id);
    console.log('   Report URL:', plot.plotReportUrl || '(none)');
    console.log('');

    if (!plot.plotReportUrl) {
      console.error('❌ No PDF report URL available for this plot');
      console.log('');
      console.log('💡 To add a PDF report, update the plot_report_url field:');
      console.log(`   UPDATE enriched_plots SET plot_report_url = 'gs://yonder-reports/path/to/report.pdf' WHERE id = '${plotId}';`);
      process.exit(1);
    }

    // Check if file exists in GCS
    console.log('🔍 Checking if PDF exists in GCS...');
    const exists = await fileExists(plot.plotReportUrl);
    
    if (!exists) {
      console.error('❌ PDF file not found in GCS bucket');
      console.log('   URL:', plot.plotReportUrl);
      process.exit(1);
    }

    console.log('✅ PDF exists in GCS');
    console.log('');

    // Get metadata
    console.log('📄 Getting PDF metadata...');
    const metadata = await getFileMetadata(plot.plotReportUrl);
    
    if (!metadata) {
      console.error('❌ Failed to retrieve PDF metadata');
      process.exit(1);
    }

    console.log('✅ PDF metadata retrieved:');
    console.log('   Size:', (metadata.size / 1024 / 1024).toFixed(2), 'MB');
    console.log('   Content Type:', metadata.contentType);
    console.log('   Last Updated:', metadata.updated.toISOString());
    console.log('');

    console.log('✅ PDF report is available for download!');
    console.log('');
    console.log('📥 Download URLs:');
    console.log('   API Route: http://localhost:3000/api/plot-report-pdf/' + plotId);
    console.log('   tRPC: Use plotReport.fetchPlotReportPdf({ plotId: "' + plotId + '" })');
    console.log('');
    console.log('💡 To download via curl (requires authentication):');
    console.log('   curl -H "Cookie: <session-cookie>" http://localhost:3000/api/plot-report-pdf/' + plotId + ' -o report.pdf');

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

testPdfDownload();
