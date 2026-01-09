/**
 * Next.js API Route for streaming PDF reports from GCS
 * GET /api/plot-report-pdf/[plotId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enrichedPlots } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getFileStream, getFileMetadata, fileExists } from '@/lib/utils/remote-clients/gcs-client';
import { verifySession } from '@/lib/dal/authDal';
import { generatePlotReport as generatePlotReportClient } from '@/lib/utils/remote-clients/yonder-agent-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ plotId: string }> }
) {
  try {
    // Verify authentication using DAL pattern
    console.log('[plot-report-pdf API] Verifying session...');
    try {
      await verifySession();
      console.log('[plot-report-pdf API] Session verified successfully');
    } catch (authError) {
      console.error('[plot-report-pdf API] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      );
    }
    
    const { plotId } = await params;
    console.log('[plot-report-pdf API] Fetching PDF for plotId:', plotId);

    // Query enrichedPlots to get the plotReportUrl
    console.log('[plot-report-pdf API] Querying database for plot...');
    const [plot] = await db
      .select({
        id: enrichedPlots.id,
        plotReportUrl: enrichedPlots.plotReportUrl,
      })
      .from(enrichedPlots)
      .where(eq(enrichedPlots.id, plotId))
      .limit(1);

    if (!plot) {
      console.error('[plot-report-pdf API] Plot not found in database:', plotId);
      return NextResponse.json(
        { error: 'Plot not found' },
        { status: 404 }
      );
    }

    let reportUrl: string | null = plot.plotReportUrl;

    console.log('[plot-report-pdf API] Retrieved plotReportUrl from DB:', reportUrl);

    // If no report URL or file doesn't exist, generate new report
    if (!reportUrl || !(await fileExists(reportUrl))) {
      if (!reportUrl) {
        console.log('[plot-report-pdf API] No plotReportUrl found, generating new report');
      } else {
        console.log('[plot-report-pdf API] PDF file not found in storage, generating new report. URL was:', reportUrl);
      }

      try {
        // Generate new report via Python service (which updates the DB itself)
        console.log('[plot-report-pdf API] Calling yonder-agent to generate report...');
        const generatedReport = await generatePlotReportClient({
          plot_id: plotId,
        });

        console.log('[plot-report-pdf API] Report generated successfully:', {
          pdfUrl: generatedReport.pdf_url,
          status: generatedReport.status,
        });

        // Use the URL from the generation response
        reportUrl = generatedReport.pdf_url;
        console.log('[plot-report-pdf API] Using generated report URL:', reportUrl);
      } catch (generateError) {
        console.error('[plot-report-pdf API] Failed to generate report:', generateError);
        const genErrorMsg = generateError instanceof Error ? generateError.message : 'Unknown error';
        return NextResponse.json(
          { error: `Failed to generate report: ${genErrorMsg}` },
          { status: 500 }
        );
      }
    } else {
      console.log('[plot-report-pdf API] Found existing plotReportUrl:', reportUrl);
    }

    // Get file metadata
    console.log('[plot-report-pdf API] Attempting to get file metadata for:', reportUrl);
    try {
      const metadata = await getFileMetadata(reportUrl);
      if (!metadata) {
        console.error('[plot-report-pdf API] Failed to retrieve PDF metadata for URL:', reportUrl);
        console.error('[plot-report-pdf API] Check GCS credentials (GOOGLE_BUCKET_ACCESS_ACCOUNT, GCP_PROJECT_ID, GCS_BUCKET_NAME)');
        return NextResponse.json(
          { error: 'Failed to retrieve PDF metadata from storage. Check GCS credentials.' },
          { status: 500 }
        );
      }

      console.log('[plot-report-pdf API] Retrieved metadata:', { size: metadata.size, contentType: metadata.contentType });

      // Get the readable stream from GCS
      console.log('[plot-report-pdf API] Creating file stream for:', reportUrl);
      const stream = await getFileStream(reportUrl);
      console.log('[plot-report-pdf API] File stream created successfully');

      // Convert Node.js ReadableStream to Web ReadableStream for Next.js response
      const webStream = new ReadableStream({
        async start(controller) {
          stream.on('data', (chunk: Buffer) => {
            controller.enqueue(new Uint8Array(chunk));
          });
          
          stream.on('end', () => {
            controller.close();
          });
          
          stream.on('error', (error: Error) => {
            console.error('[plot-report-pdf API] Stream error:', error);
            controller.error(error);
          });
        },
      });

      // Return the PDF as a streaming response
      return new NextResponse(webStream, {
        status: 200,
        headers: {
          'Content-Type': metadata.contentType || 'application/pdf',
          'Content-Disposition': `attachment; filename="plot-${plotId}-report.pdf"`,
          'Content-Length': metadata.size.toString(),
          'Cache-Control': 'private, max-age=3600',
        },
      });
    } catch (gcsError) {
      console.error('[plot-report-pdf API] GCS operation failed:', gcsError);
      const gcsErrorMsg = gcsError instanceof Error ? gcsError.message : 'Unknown error';
      return NextResponse.json(
        { error: `GCS operation failed: ${gcsErrorMsg}. Check environment variables.` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[plot-report-pdf API] Unexpected error:', error);
    console.error('[plot-report-pdf API] Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { error: `Failed to process PDF request: ${errorMessage}` },
      { status: 500 }
    );
  }
}
