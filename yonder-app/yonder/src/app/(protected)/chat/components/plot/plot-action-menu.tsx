'use client';

import { Button } from '@/app/_components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/app/_components/ui/dropdown-menu';
import { trpc } from '@/trpc/client';
import { useToast } from '@/app/_components/ui/toast-provider';

interface PlotActionMenuProps {
  plotId: string;
  isSelected: boolean;
  organizationId?: string;
  align?: 'start' | 'end';
}

export default function PlotActionMenu({ plotId, isSelected, organizationId, align = 'end' }: PlotActionMenuProps) {
  const utils = trpc.useUtils();
  const { success, error: errorToast } = useToast();

  const updateSelectedPlotMutation = trpc.projects.updateSelectedPlot.useMutation({
    onSuccess: () => {
      if (organizationId) {
        utils.projects.getOrganizationProject.invalidate({ organizationId });
        utils.projects.getOrganizationPlots.invalidate({ organizationId });
      }
      success('Selected plot updated.');
    },
    onError: () => {
      errorToast('Failed to update selected plot.');
    }
  });

  const removePlotsMutation = trpc.projects.removePlotsFromOrganization.useMutation({
    onSuccess: (res) => {
      if (organizationId) {
        utils.projects.getOrganizationProject.invalidate({ organizationId });
        utils.projects.getOrganizationPlots.invalidate({ organizationId });
      }
      const cleared = res?.selectedCleared ? ' (selection cleared)' : '';
      success(`Removed ${res?.removedCount ?? 0} plot${(res?.removedCount ?? 0) !== 1 ? 's' : ''}${cleared}.`);
    },
    onError: () => {
      errorToast('Failed to remove plot from project.');
    }
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7"
          onClick={(e) => e.stopPropagation()}
        >
          Action
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('realtorOutreachRequested', { detail: { selectedPlotIds: [plotId] } })
              );
            }
          }}
        >
          Realtor Outreach
        </DropdownMenuItem>
        {!isSelected ? (
          <DropdownMenuItem
            onClick={async () => {
              if (!organizationId) return;
              try {
                await updateSelectedPlotMutation.mutateAsync({
                  organizationId,
                  plotId,
                });
              } catch {}
            }}
            disabled={updateSelectedPlotMutation.isPending}
          >
            Set as Selected
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={async () => {
              if (!organizationId) return;
              try {
                await updateSelectedPlotMutation.mutateAsync({
                  organizationId,
                });
              } catch {}
            }}
            disabled={updateSelectedPlotMutation.isPending}
          >
            Clear Selection
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={async () => {
            if (!organizationId) return;
            const proceed = window.confirm('Remove this plot from the project?');
            if (!proceed) return;
            try {
              await removePlotsMutation.mutateAsync({
                organizationId,
                plotIds: [plotId],
              });
            } catch {}
          }}
          disabled={removePlotsMutation.isPending}
        >
          Remove from Project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
