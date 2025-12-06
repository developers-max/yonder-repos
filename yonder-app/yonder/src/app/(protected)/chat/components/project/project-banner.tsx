"use client";

import { useMemo } from "react";
import { authClient } from "@/lib/auth/auth-client";
import { trpc } from "@/trpc/client";
import { ProgressStepper, type Step as ProgressStep } from "@/app/_components/project-stepper";
import { Badge } from "@/app/_components/ui/badge";
import { Calendar } from "lucide-react";

// Stable stages list
const STAGES = [
  "Add land",
  "Outreach to Realtors",
  "Realtor response",
  "Handover to local contact",
] as const;

interface ProjectBannerProps {
  className?: string;
  compact?: boolean;
}

export default function ProjectBanner({ className, compact = false }: ProjectBannerProps) {
  const { data: activeOrg } = authClient.useActiveOrganization();
  const orgId = activeOrg?.id;

  const { data: projectData } = trpc.projects.getOrganizationProject.useQuery(
    { organizationId: orgId || "" },
    { enabled: !!orgId }
  );
  const { data: projectPlots } = trpc.projects.getOrganizationPlots.useQuery(
    { organizationId: orgId || "" },
    { enabled: !!orgId }
  );
  
  const computedStage: string | undefined = (projectData as { computedStage?: string } | null)?.computedStage;

  const activeIndex = useMemo(() => {
    const name = (computedStage || "").toLowerCase();
    const map: Record<string, number> = {
      'add plots': 0,
      'add land': 0,
      'contact realtors': 1,
      'outreach to realtors': 1,
      'waiting for realtors response': 2,
      'realtor response': 2,
      'contact local expert': 3,
      'handover to local contact': 3,
    };
    const idx = map[name];
    return typeof idx === 'number' ? idx : 0;
  }, [computedStage]);

  const steps = useMemo<ProgressStep[]>(() => (
    STAGES.map((label, i) => {
      const status: 'completed' | 'current' | 'upcoming' = i < activeIndex
        ? 'completed'
        : i === activeIndex
        ? 'current'
        : 'upcoming';
      return { number: i + 1, label, status };
    })
  ), [activeIndex]);

  // Guard after all hooks have been called to keep a stable hooks order
  if (!orgId) return null;

  return (
    <div className={`border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 ${className ?? ''}`}>
      <div className={`px-6 ${compact ? 'py-1' : 'py-3'}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground truncate">{`Project: ${activeOrg?.name ?? ''}`.trim()}</h2>
          <Badge variant="outline" className="text-xs">
            {(projectPlots?.length || 0)} plot{(projectPlots?.length || 0) !== 1 ? 's' : ''}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>Created {projectData?.createdAt ? new Date(projectData.createdAt).toLocaleDateString() : '-'}</span>
        </div>
        {/* Stage progress */}
        <div className="mt-3 flex justify-center">
          <ProgressStepper size={compact ? 'sm' : 'md'} steps={steps} />
        </div>
      </div>
    </div>
  );
}

