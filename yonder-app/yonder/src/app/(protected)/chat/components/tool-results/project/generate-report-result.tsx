'use client';

import { useState } from 'react';
import { FileText, AlertCircle, Download, Loader2 } from 'lucide-react';
import { Button } from '@/app/_components/ui/button';
import { useToast } from '@/app/_components/ui/toast-provider';
import type { GenerateReportResult } from '@/lib/ai/tools/generate-report';

interface GenerateReportResultProps {
  result: GenerateReportResult;
}

export function GenerateReportResultComponent({ result }: GenerateReportResultProps) {
  const isError = !!result.error;
  const [isGenerating, setIsGenerating] = useState(false);
  const { info, error: errorToast, dismiss } = useToast();

  const handleDownloadReport = async () => {
    if (!result.data?.plotId) return;

    setIsGenerating(true);
    
    const statusToast = info('Generating plot report...', { duration: 0 });

    try {
      // Download through backend proxy - it handles everything (check DB, generate if needed, stream)
      console.log('[generate-report-result] Downloading PDF through backend proxy');
      const pdfResponse = await fetch(`/api/plot-report-pdf/${result.data.plotId}`);
      
      console.log('[generate-report-result] PDF response status:', pdfResponse.status);
      if (!pdfResponse.ok) {
        if (pdfResponse.status === 404) {
          throw new Error('Plot not found.');
        }
        throw new Error(`Failed to download PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
      }

      // Update toast
      dismiss(statusToast.id);
      const downloadToast = info('Downloading PDF...', { duration: 0 });

      const pdfBlob = await pdfResponse.blob();
      
      // Create a blob URL for the PDF
      const blobUrl = window.URL.createObjectURL(pdfBlob);
      
      // Create download link
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = `plot-report-${result.data.plotId.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      // Clean up the blob URL after a delay
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 1000);
      
      // Dismiss loading toasts
      dismiss(statusToast.id);
      dismiss(downloadToast.id);

      // Show success message
      info(`Report downloaded as PDF!`, { duration: 5000 });
    } catch (err) {
      console.error('Failed to fetch report:', err);
      dismiss(statusToast.id);
      errorToast('Failed to fetch report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl mt-3 overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isError ? 'bg-red-100' : 'bg-blue-100'}`}>
            {isError ? (
              <AlertCircle className="w-4 h-4 text-red-600" />
            ) : (
              <FileText className="w-4 h-4 text-blue-600" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 text-sm">
              {isError ? 'Failed to Prepare Report' : 'Generate Report'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {isError 
                ? String(result.error?.details || 'Unknown error') 
                : 'Click the button to start generation and wait until it completes to download'
              }
            </p>
          </div>
        </div>
        
        {isError ? (
          result.suggestions.length > 0 && (
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-700 mb-2">Suggested actions:</p>
              <ul className="text-xs text-gray-600 space-y-1">
                {result.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="w-1 h-1 bg-gray-400 rounded-full mt-2 flex-shrink-0"></span>
                    {suggestion.action}
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : result.data ? (
          <div className="space-y-3">
            {/* Quick Facts */}
            {result.data.quickFacts && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <p className="text-xs font-semibold text-blue-900 mb-3">Quick Facts</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-blue-700 font-medium">Price:</span>
                    <span className="text-blue-900 ml-2">{result.data.quickFacts.price}</span>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Size:</span>
                    <span className="text-blue-900 ml-2">{result.data.quickFacts.size}</span>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Location:</span>
                    <span className="text-blue-900 ml-2">{result.data.quickFacts.location}</span>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Municipality:</span>
                    <span className="text-blue-900 ml-2">{result.data.quickFacts.municipality}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-blue-700 font-medium">Zoning:</span>
                    <span className="text-blue-900 ml-2">{result.data.quickFacts.zoning}</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Report Summary */}
            {result.data.reportSummary && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-900 mb-2">Report Overview</p>
                <p className="text-xs text-gray-700 whitespace-pre-line">{result.data.reportSummary}</p>
              </div>
            )}
            
            <Button
              onClick={handleDownloadReport}
              disabled={isGenerating}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Fetching Report...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download Plot Report
                </>
              )}
            </Button>

            {!isGenerating && (
              <p className="text-xs text-gray-500 text-center">
                Click the button above to fetch and download the plot report PDF.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
