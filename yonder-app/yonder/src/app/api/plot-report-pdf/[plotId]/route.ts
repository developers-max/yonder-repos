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
    await verifySession();
    
    const { plotId } = await params;
    console.log('[plot-report-pdf API] Fetching PDF for plotId:', plotId);

    // Query enrichedPlots to get the plotReportUrl
    const [plot] = await db
      .select({
        id: enrichedPlots.id,
        plotReportUrl: enrichedPlots.plotReportUrl,
      })
      .from(enrichedPlots)
      .where(eq(enrichedPlots.id, plotId))
      .limit(1);

    if (!plot) {
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

      // Generate new report via Python service (which updates the DB itself)
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
    } else {
      console.log('[plot-report-pdf API] Found existing plotReportUrl:', reportUrl);
    }

    // Get file metadata
    console.log('[plot-report-pdf API] Attempting to get file metadata for:', reportUrl);
    const metadata = await getFileMetadata(reportUrl);
    if (!metadata) {
      console.error('[plot-report-pdf API] Failed to retrieve PDF metadata for URL:', reportUrl);
      return NextResponse.json(
        { error: 'Failed to retrieve PDF metadata from storage' },
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
  } catch (error) {
    console.error('[plot-report-pdf API] Error streaming PDF:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Handle auth errors
    if (errorMessage.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: `Failed to stream PDF: ${errorMessage}` },
      { status: 500 }
    );
  }
}
