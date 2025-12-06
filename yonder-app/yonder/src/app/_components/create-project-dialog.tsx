"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/app/_components/ui/dialog";
import { Label } from "@/app/_components/ui/label";
import { Input } from "@/app/_components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/_components/ui/select";
import { Button } from "@/app/_components/ui/button";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { trpc } from "@/trpc/client";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectWebsite, setProjectWebsite] = useState("");
  const [projectType, setProjectType] = useState("Build prefab Home");
  const [creating, setCreating] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createOrgStepsMutation = trpc.processSteps.createOrganizationSteps.useMutation();

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setProjectName("");
      setProjectDescription("");
      setProjectWebsite("");
      setProjectType("Build prefab Home");
      setSubmitError(null);
      setCreating(false);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!projectName.trim()) return;
    try {
      setCreating(true);
      const slug = projectName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 60);

      const resp = await authClient.organization.create({
        name: projectName,
        slug,
      });
      if (resp.data) {
        const newOrg = resp.data;
        try { await authClient.organization.setActive({ organizationId: newOrg.id }); } catch {}
        
        // Ensure organization steps are created (fallback if hook fails)
        try {
          await createOrgStepsMutation.mutateAsync({ organizationId: newOrg.id });
          console.log('✅ Organization steps created successfully');
        } catch (stepsErr) {
          console.warn('⚠️ Failed to create organization steps:', stepsErr);
        }
        
        // Optionally persist metadata (description/website) after creation when provided
        try {
          if (projectDescription || projectWebsite || projectType) {
            await authClient.organization.update({
              organizationId: newOrg.id,
              data: {
                metadata: {
                  description: projectDescription || undefined,
                  website: projectWebsite || undefined,
                  type: projectType || "Build prefab Home",
                }
              }
            });
          }
        } catch {}
        try {
          if (projectWebsite) {
            const r = await fetch('/api/project-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: projectWebsite, type: projectType || undefined }),
            });
            const data = (await r.json()) as unknown as { url?: unknown };
            const img = typeof data?.url === 'string' ? data.url : null;
            if (img) {
              await authClient.organization.update({
                organizationId: newOrg.id,
                data: { metadata: { description: projectDescription || undefined, website: projectWebsite || undefined, type: projectType || 'Build prefab Home', imageUrl: img } }
              });
            }
          }
        } catch {}
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('refreshProjectData'));
          window.dispatchEvent(new Event('switchToProjectTab'));
        }
        onOpenChange(false);
        setProjectName("");
        setProjectDescription("");
        setProjectWebsite("");
        router.refresh();
      } else if (resp.error) {
        const maybe = resp.error as unknown as { code?: string; message?: string };
        setSubmitError(
          maybe.code === 'ORGANIZATION_ALREADY_EXISTS'
            ? 'A project with this name already exists. Please choose a different name.'
            : (maybe.message || 'Failed to create project.')
        );
      }
    } catch {
      setSubmitError('Failed to create project. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new project</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="new-project-name">Project name</Label>
            <Input
              id="new-project-name"
              value={projectName}
              onChange={(e) => { setProjectName(e.target.value); if (submitError) setSubmitError(null); }}
              placeholder="e.g. The Nokken"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-description">Description</Label>
            <Input
              id="project-description"
              value={projectDescription}
              onChange={(e) => { setProjectDescription(e.target.value); if (submitError) setSubmitError(null); }}
              placeholder="Short description"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-website">Website URL</Label>
            <Input
              id="project-website"
              type="url"
              value={projectWebsite}
              onChange={(e) => { setProjectWebsite(e.target.value); if (submitError) setSubmitError(null); }}
              placeholder="https://example.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-type">Project type</Label>
            <Select value={projectType} onValueChange={(v) => { setProjectType(v); if (submitError) setSubmitError(null); }}>
              <SelectTrigger id="project-type" className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Build prefab Home">Build prefab Home</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {submitError && (
            <div className="-mt-2 text-sm text-red-600" role="alert">{submitError}</div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating...' : 'Create project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
