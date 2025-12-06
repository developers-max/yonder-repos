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

    // If no report URL or file doesn't exist, generate new report
    if (!reportUrl || !(await fileExists(reportUrl))) {
      if (!reportUrl) {
        console.log('[plot-report-pdf API] No plotReportUrl found, generating new report');
      } else {
        console.log('[plot-report-pdf API] PDF file not found in storage, generating new report');
      }

      // Generate new report via Python service
      const generatedReport = await generatePlotReportClient({
        plot_id: plotId,
      });

      console.log('[plot-report-pdf API] Report generated successfully:', {
        pdfUrl: generatedReport.pdf_url,
        status: generatedReport.status,
      });

      // Update the database with the new report URL
      await db
        .update(enrichedPlots)
        .set({ plotReportUrl: generatedReport.pdf_url })
        .where(eq(enrichedPlots.id, plotId));

      reportUrl = generatedReport.pdf_url;
      console.log('[plot-report-pdf API] Database updated with new report URL');
    } else {
      console.log('[plot-report-pdf API] Found existing plotReportUrl:', reportUrl);
    }

    // Get file metadata
    const metadata = await getFileMetadata(reportUrl);
    if (!metadata) {
      return NextResponse.json(
        { error: 'Failed to retrieve PDF metadata from storage' },
        { status: 500 }
      );
    }

    // Get the readable stream from GCS
    const stream = await getFileStream(reportUrl);

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
