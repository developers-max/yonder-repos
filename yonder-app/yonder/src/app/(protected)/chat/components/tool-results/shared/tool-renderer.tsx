import { PlotSearchResults } from '../plot/plot-search-components';
import type { SearchPlotsResult } from '@/lib/ai/tools/search-plots';
import { OutreachComponent } from '../plot/outreach-component';
import type { InitiateOutreachResult } from '@/lib/ai/tools/initiate-outreach';
import { PlotDetailsResultComponent } from '../plot/plot-details-result';
import type { PlotDetailsResult } from '@/lib/ai/tools/get-plot-details';
import { SelectedPlotResultComponent } from '../plot/selected-plot-result';
import type { SetSelectedPlotResult } from '@/lib/ai/tools/set-selected-plot';
import { ProgressUpdated } from '../project/progress-updated';
import type { ProgressUpdateResult } from '@/lib/ai/tools/update-progress';
import { StepInfo } from '../project/step-info';
import type { GetNextStepResult } from '@/lib/ai/tools/get-next-step';
import { ProjectProgressChecklist } from '../project/project-progress-checklist';
import type { GetProjectProgressResult } from '@/lib/ai/tools/get-project-progress';
import { GenerateReportResultComponent } from '../project/generate-report-result';
import type { GenerateReportResult } from '@/lib/ai/tools/generate-report';
import { LayerInfoResultComponent } from '../layer/layer-info-result';
import type { GetLayerInfoResult } from '@/lib/ai/tools/get-layer-info';

interface ToolRendererProps {
  toolName: string;
  result: unknown;
  chatId: string;
}

export function ToolRenderer({ 
  toolName, 
  result, 
  chatId
}: ToolRendererProps) {
  switch (toolName) {
    case 'searchPlots':
      return (
        <PlotSearchResults 
          result={result as SearchPlotsResult}
        />
      );

    case 'initiateOutreach':
      return (
        <OutreachComponent
          result={result as InitiateOutreachResult}
          variant="tool-response"
        />
      );

    case 'getPlotDetails':
      return (
        <PlotDetailsResultComponent
          result={result as PlotDetailsResult}
        />
      );

    case 'setSelectedPlot':
      return (
        <SelectedPlotResultComponent
          result={result as SetSelectedPlotResult}
        />
      );

    case 'updateProgress':
      return (
        <ProgressUpdated
          result={result as ProgressUpdateResult}
          chatId={chatId}
        />
      );

    case 'getNextStep':
      return (
        <StepInfo
          result={result as GetNextStepResult}
        />
      );

    case 'getProjectProgress':
      return (
        <ProjectProgressChecklist
          data={result as GetProjectProgressResult}
        />
      );

    case 'generateReport':
      return (
        <GenerateReportResultComponent
          result={result as GenerateReportResult}
        />
      );

    case 'getProjectContext':
      // This tool doesn't have specific UI components, fall through to default
      return (
        <div className="bg-muted p-3 rounded-lg mt-2">
          <div className="text-sm text-muted-foreground mb-1">
            Tool Result: {toolName}
          </div>
          <pre className="text-xs overflow-x-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      );

    case 'getAcquisitionSteps':
      // This tool should not show any UI
      return null;

    case 'getLayerInfo':
      return (
        <LayerInfoResultComponent
          result={result as GetLayerInfoResult}
        />
      );

    default:
      return (
        <div className="bg-muted p-3 rounded-lg mt-2">
          <div className="text-sm text-muted-foreground mb-1">
            Tool Result: {toolName}
          </div>
          <pre className="text-xs overflow-x-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      );
  }
} 