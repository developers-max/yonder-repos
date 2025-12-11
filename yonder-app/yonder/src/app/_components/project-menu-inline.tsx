'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/app/_components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/app/_components/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/_components/ui/avatar';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/app/_components/ui/dialog';
import { Input } from '@/app/_components/ui/input';
import { Label } from '@/app/_components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/_components/ui/select';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/auth-client';
import { trpc } from '@/trpc/client';

interface ProjectMenuInlineProps {
  className?: string;
  onOrganizationChange?: (organizationId: string) => void;
}

type OrganizationsHook = ReturnType<typeof authClient.useListOrganizations>;

type OrganizationFromHook = NonNullable<OrganizationsHook['data']>[number];

export default function ProjectMenuInline({ className, onOrganizationChange }: ProjectMenuInlineProps) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<null | { id: string }>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectWebsite, setProjectWebsite] = useState('');
  const [projectType, setProjectType] = useState('Build prefab Home');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const router = useRouter();

  const { data: organizations, isPending: isOrgsLoading, refetch: refetchOrganizations } = authClient.useListOrganizations();
  const { data: activeOrganization, isPending: isActiveLoading } = authClient.useActiveOrganization();
  const activeOrgId = activeOrganization?.id;
  const deleteOrganizationMutation = trpc.projects.deleteOrganization.useMutation();

  const loading = isOrgsLoading || isActiveLoading;

  const handleSelectOrganization = useCallback(async (organizationId: string) => {
    try {
      const response = await authClient.organization.setActive({ organizationId });
      if (response.data) {
        onOrganizationChange?.(organizationId);
        router.refresh();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('switchToProjectTab'));
          window.dispatchEvent(new Event('refreshProjectData'));
        }
      }
    } catch (error) {
      console.error('Failed to set active organization:', error);
    }
  }, [onOrganizationChange, router]);

  // If user has no organizations, prompt to create one
  useEffect(() => {
    if (!loading && (!organizations || organizations.length === 0)) {
      setEditing(null);
      setDialogOpen(true);
    }
  }, [loading, organizations]);

  const handleSubmitProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      setCreating(true);

      // Check if user already has a project with this name (case-insensitive)
      const normalizedName = newProjectName.trim().toLowerCase();
      const duplicate = organizations?.find(
        (org) => org.name?.toLowerCase() === normalizedName && org.id !== editing?.id
      );
      if (duplicate) {
        setSubmitError('You already have a project with this name. Please choose a different name.');
        setCreating(false);
        return;
      }
      setSubmitError(null);
      const slug = newProjectName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 60);

      if (editing?.id) {
        const resp = await authClient.organization.update({
          organizationId: editing.id,
          data: { 
            name: newProjectName,
            metadata: {
              description: projectDescription || undefined,
              website: projectWebsite || undefined,
              type: projectType || 'Build prefab Home',
            },
          },
        });
        if (resp.data) {
          try {
            if (projectWebsite) {
              const r = await fetch('/api/project-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: projectWebsite, type: projectType || undefined, name: newProjectName || undefined, description: projectDescription || undefined }),
              });
              const data = (await r.json()) as unknown as { url?: unknown };
              const img = typeof data?.url === 'string' ? data.url : null;
              if (img) {
                await authClient.organization.update({
                  organizationId: editing.id,
                  data: { metadata: { description: projectDescription || undefined, website: projectWebsite || undefined, type: projectType || 'Build prefab Home', imageUrl: img } },
                });
              }
            }
          } catch {}
          if (activeOrgId === editing.id) {
            onOrganizationChange?.(editing.id);
            try { await authClient.organization.setActive({ organizationId: editing.id }); } catch {}
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new Event('refreshProjectData'));
              window.dispatchEvent(new Event('switchToProjectTab'));
            }
          }
        } else if (resp.error) {
          const maybe = resp.error as { code?: string; message?: string };
          setSubmitError(maybe.code === 'ORGANIZATION_ALREADY_EXISTS' ? 'A project with this name already exists. Please choose a different name.' : (maybe.message || 'Failed to save changes. Please try again.'));
          setCreating(false);
          return;
        }
      } else {
        const response = await authClient.organization.create({
          name: newProjectName,
          slug,
        });
        if (response.data) {
          const newOrg = response.data;
          try {
            if (projectDescription || projectWebsite || projectType) {
              await authClient.organization.update({
                organizationId: newOrg.id,
                data: {
                  metadata: {
                    description: projectDescription || undefined,
                    website: projectWebsite || undefined,
                    type: projectType || 'Build prefab Home',
                  },
                },
              });
            }
          } catch {}
          try {
            if (projectWebsite) {
              const r = await fetch('/api/project-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: projectWebsite, type: projectType || undefined, name: newProjectName || undefined, description: projectDescription || undefined }),
              });
              const data = (await r.json()) as unknown as { url?: unknown };
              const img = typeof data?.url === 'string' ? data.url : null;
              if (img) {
                await authClient.organization.update({
                  organizationId: newOrg.id,
                  data: { metadata: { description: projectDescription || undefined, website: projectWebsite || undefined, type: projectType || 'Build prefab Home', imageUrl: img } },
                });
              }
            }
          } catch {}
          await handleSelectOrganization(newOrg.id);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('refreshProjectData'));
          }
        } else if (response.error) {
          const maybe = response.error as { code?: string; message?: string };
          setSubmitError(maybe.code === 'ORGANIZATION_ALREADY_EXISTS' ? 'A project with this name already exists. Please choose a different name.' : (maybe.message || 'Failed to create project. Please try again.'));
          setCreating(false);
          return;
        }
      }

      setNewProjectName('');
      setProjectDescription('');
      setProjectWebsite('');
      setProjectType('Build prefab Home');
      setEditing(null);
      setCreating(false);
      setDialogOpen(false);
      router.refresh();
    } catch (error: unknown) {
      console.error('Failed to submit project:', error);
      let message = 'Something went wrong. Please try again.';
      if (typeof error === 'object' && error) {
        const maybe = error as { error?: { message?: string }; message?: string };
        message = maybe.error?.message || maybe.message || message;
      }
      setSubmitError(message.includes('ORGANIZATION_ALREADY_EXISTS') ? 'A project with this name already exists. Please choose a different name.' : message);
      setCreating(false);
    }
  };

  const openEditDialog = (org: OrganizationFromHook) => {
    setEditing({ id: org.id });
    setNewProjectName(org.name || '');
    const meta = org.metadata ?? {};
    const desc = typeof meta?.description === 'string' ? meta.description : '';
    const web = typeof meta?.website === 'string' ? meta.website : '';
    const typeCandidate = (meta as Record<string, unknown>)?.type;
    const typ = typeof typeCandidate === 'string' ? typeCandidate : 'Build prefab Home';
    setProjectDescription(desc ?? '');
    setProjectWebsite(web ?? '');
    setProjectType(typ ?? 'Build prefab Home');
    setSubmitError(null);
    setDialogOpen(true);
  };

  const handleDeleteProject = async () => {
    if (!editing?.id) return;
    const deletedOrgId = editing.id;
    const wasActiveProject = deletedOrgId === activeOrgId;
    
    try {
      const ok = confirm('Delete this project? This will remove the project and related data.');
      if (!ok) return;
      await deleteOrganizationMutation.mutateAsync({ organizationId: deletedOrgId });
      
      // Refresh the organizations list
      await refetchOrganizations();
      
      // If we deleted the active project, switch to the first available one
      if (wasActiveProject) {
        // Wait a bit for the refetch to complete, then check the updated list
        setTimeout(async () => {
          const remainingOrgs = organizations?.filter(org => org.id !== deletedOrgId);
          if (remainingOrgs && remainingOrgs.length > 0) {
            const firstAvailableOrg = remainingOrgs[0];
            await authClient.organization.setActive({ organizationId: firstAvailableOrg.id });
            onOrganizationChange?.(firstAvailableOrg.id);
          }
        }, 100);
      }
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('refreshProjectData'));
      }
      setDialogOpen(false);
      setEditing(null);
      setNewProjectName('');
      setProjectDescription('');
      setProjectWebsite('');
      setProjectType('Build prefab Home');
      router.refresh();
    } catch (err) {
      const msg = (err && typeof err === 'object' && 'message' in (err as Record<string, unknown>))
        ? String((err as { message?: string }).message)
        : 'Failed to delete project. Please try again.';
      setSubmitError(msg);
    }
  };

  return (
    <div className={className} onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Command>
        <CommandInput 
          placeholder="Search projects..." 
          value={newProjectName}
          onValueChange={setNewProjectName}
        />
        <CommandList>
          <CommandEmpty>
            <div className="text-center py-2">
              <p className="text-sm text-muted-foreground">No projects found</p>
            </div>
          </CommandEmpty>
          {organizations && organizations.length > 0 && (
            <CommandGroup heading="Your Projects">
              {organizations.map((org) => (
                <CommandItem
                  key={org.id}
                  value={org.name}
                  onSelect={() => handleSelectOrganization(org.id)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2 w-full">
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={org.logo || undefined} />
                      <AvatarFallback>
                        {org.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="truncate block">{org.name}</span>
                      {org?.metadata?.website && (
                        <span className="truncate block text-xs text-muted-foreground">{org.metadata.website}</span>
                      )}
                    </div>
                    <Button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openEditDialog(org); }}
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Edit project"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {activeOrganization?.id === org.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit project' : 'Create a new project'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="project-name">Project name</Label>
              <Input
                id="project-name"
                value={newProjectName}
                onChange={(e) => { setNewProjectName(e.target.value); if (submitError) setSubmitError(null); }}
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
              <div className="-mt-2 mb-2 text-sm text-red-600" role="alert">
                {submitError}
              </div>
            )}
          </div>
          <DialogFooter>
          {editing && (
            <Button
              type="button"
              variant="outline"
              onClick={handleDeleteProject}
              disabled={creating || deleteOrganizationMutation.isPending}
              className="mr-auto"
              title="Delete project"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete project
            </Button>
          )}
          <Button onClick={handleSubmitProject} disabled={creating}>
            {creating ? (editing ? 'Saving...' : 'Creating...') : (editing ? 'Save changes' : 'Create project')}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
