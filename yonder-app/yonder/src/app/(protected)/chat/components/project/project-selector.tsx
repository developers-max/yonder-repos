'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, ChevronsUpDown, Plus, Building2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/app/_components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/app/_components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/_components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/_components/ui/avatar';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/app/_components/ui/dialog';
import { Input } from '@/app/_components/ui/input';
import { Label } from '@/app/_components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/_components/ui/select';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/auth-client';
import CreateProjectDialog from '@/app/_components/create-project-dialog';
import { trpc } from '@/trpc/client';

interface ProjectSelectorProps {
  className?: string;
  onOrganizationChange?: (organizationId: string) => void;
}

// Derive the official organization type from the auth client hook
type OrganizationsHook = ReturnType<typeof authClient.useListOrganizations>;
type OrganizationFromHook = NonNullable<OrganizationsHook['data']>[number];

export default function ProjectSelector({ className, onOrganizationChange }: ProjectSelectorProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<null | { id: string }>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectWebsite, setProjectWebsite] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [projectType, setProjectType] = useState('Build prefab Home');
  const router = useRouter();

  // Use Better Auth hooks
  const { data: organizations, isPending: isOrgsLoading, refetch: refetchOrganizations } = authClient.useListOrganizations();
  const { data: activeOrganization, isPending: isActiveLoading } = authClient.useActiveOrganization();
  const activeOrgId = activeOrganization?.id;
  const deleteOrganizationMutation = trpc.projects.deleteOrganization.useMutation();

  const loading = isOrgsLoading || isActiveLoading;


  // Prevent hydration mismatch by ensuring component only renders after mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Notify parent when active organization changes
  useEffect(() => {
    if (activeOrganization?.id) {
      onOrganizationChange?.(activeOrganization.id);
    }
  }, [activeOrganization?.id, onOrganizationChange]);
  
  useEffect(() => {
    const handler = () => {
      router.refresh();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('refreshProjectData', handler as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('refreshProjectData', handler as EventListener);
      }
    };
  }, [router]);

  // If user has no organizations, prompt to create one
  useEffect(() => {
    if (mounted && !loading && (!organizations || organizations.length === 0)) {
      setEditing(null);
      setCreateDialogOpen(true);
      setOpen(false);
    }
  }, [mounted, loading, organizations]);

  const handleSelectOrganization = useCallback(async (organizationId: string) => {
    try {
      const response = await authClient.organization.setActive({
        organizationId
      });

      if (response.data) {
        // Notify parent component
        onOrganizationChange?.(organizationId);
        router.refresh(); // Refresh to update the page with new organization context
        // Tell the plots panel to switch to the Project tab
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('switchToProjectTab'));
        }
        setOpen(false);
      }
    } catch (error) {
      console.error('Failed to set active organization:', error);
    }
  }, [onOrganizationChange, router]);

  // Set default selection to the first project if none is active
  useEffect(() => {
    if (
      mounted &&
      !loading &&
      organizations &&
      organizations.length > 0 &&
      !activeOrgId
    ) {
      // Default to first organization in the list
      void handleSelectOrganization(organizations[0].id);
    }
  }, [mounted, loading, organizations, activeOrgId, handleSelectOrganization]);


  const handleSubmitProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      setCreating(true);
      setSubmitError(null);

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

      const slug = newProjectName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 60);

      if (editing?.id) {
        // Update existing org (BetterAuth expects fields under `data`)
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
          let nextImageUrl: string | null = null;
          try {
            if (projectWebsite) {
              const r = await fetch('/api/project-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: projectWebsite, type: projectType || undefined, name: newProjectName || undefined, description: projectDescription || undefined }),
              });
              const data = (await r.json()) as unknown as { url?: unknown };
              nextImageUrl = typeof data?.url === 'string' ? (data.url as string) : null;
            }
          } catch {}

          await authClient.organization.update({
            organizationId: editing.id,
            data: {
              ...(nextImageUrl ? { logo: nextImageUrl } : {}),
              name: newProjectName,
              metadata: {
                description: projectDescription || undefined,
                website: projectWebsite || undefined,
                type: projectType || 'Build prefab Home',
                imageUrl: nextImageUrl,
              },
            },
          });

          await handleSelectOrganization(editing.id);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('refreshProjectData'));
          }
        } else if (resp.error) {
          const getErrorInfo = (e: unknown) => {
            if (typeof e === 'object' && e) {
              const maybe = e as { code?: string; message?: string };
              return { code: maybe.code ?? '', message: maybe.message ?? '' };
            }
            return { code: '', message: '' };
          };

          const { code, message } = getErrorInfo(resp.error);
          setSubmitError(
            code === 'ORGANIZATION_ALREADY_EXISTS'
              ? 'A project with this name already exists. Please choose a different name.'
              : message || 'Failed to save changes. Please try again.'
          );
          setCreating(false);
          return;
        }
      } else {
        // Create new org
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
                  data: { 
                    ...(img ? { logo: img } : {}),
                    metadata: { description: projectDescription || undefined, website: projectWebsite || undefined, type: projectType || 'Build prefab Home', imageUrl: img }
                  },
                });
              }
            }
          } catch {}
          await handleSelectOrganization(newOrg.id);
          // Notify other components to refresh
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('refreshProjectData'));
          }
        } else if (response.error) {
          const getErrorInfo = (e: unknown) => {
            if (typeof e === 'object' && e) {
              const maybe = e as { code?: string; message?: string };
              return { code: maybe.code ?? '', message: maybe.message ?? '' };
            }
            return { code: '', message: '' };
          };
          const { code, message } = getErrorInfo(response.error);
          setSubmitError(
            code === 'ORGANIZATION_ALREADY_EXISTS'
              ? 'A project with this name already exists. Please choose a different name.'
              : message || 'Failed to create project. Please try again.'
          );
          setCreating(false);
          return;
        }
      }

      // Reset
      setNewProjectName('');
      setProjectDescription('');
      setProjectWebsite('');
      setEditing(null);
      setCreating(false);
      setDialogOpen(false);
      setOpen(false);
      router.refresh();
    } catch (error: unknown) {
      console.error('Failed to submit project:', error);
      let message = 'Something went wrong. Please try again.';
      if (typeof error === 'object' && error) {
        const maybe = error as { error?: { message?: string } ; message?: string };
        message = maybe.error?.message || maybe.message || message;
      }
      setSubmitError(
        message.includes('ORGANIZATION_ALREADY_EXISTS')
          ? 'A project with this name already exists. Please choose a different name.'
          : message
      );
      setCreating(false);
    }
  };

  const openCreateDialog = () => {
    setEditing(null);
    setNewProjectName('');
    setProjectDescription('');
    setProjectWebsite('');
    setProjectType('Build prefab Home');
    setSubmitError(null);
    setCreateDialogOpen(true);
    setOpen(false);
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
      setOpen(false);
      router.refresh();
    } catch (err) {
      const msg = (err && typeof err === 'object' && 'message' in (err as Record<string, unknown>))
        ? String((err as { message?: string }).message)
        : 'Failed to delete project. Please try again.';
      setSubmitError(msg);
    }
  };

  if (!mounted || loading) {
    return (
      <Button
        variant="outline"
        disabled
        className={`w-full justify-between ${className}`}
      >
        <div className="flex items-center gap-2 w-full">
          <div className="w-6 h-6 shrink-0 bg-accent rounded-full animate-pulse" />
          <div className="w-full h-4 bg-accent rounded animate-pulse" />
        </div>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    );
  }

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`w-full justify-between !pl-1.5 !pr-2 h-9 ${className}`}
        >
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <Avatar className="w-6 h-6 flex-shrink-0">
              <AvatarImage src={activeOrganization?.logo || undefined} />
              <AvatarFallback>
                {activeOrganization?.name?.charAt(0) || <Building2 className="w-3 h-3" />}
              </AvatarFallback>
            </Avatar>
            <p className="truncate">
              {activeOrganization?.name || 'Select project'}
            </p>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
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
            
            <CommandSeparator />
            
            <CommandGroup>
              <CommandItem
                onSelect={openCreateDialog}
                className="cursor-pointer"
              >
                <Plus className="mr-2 h-4 w-4" />
                <span>Create new project</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
    <CreateProjectDialog open={createDialogOpen} onOpenChange={(o) => { setCreateDialogOpen(o); if (!o) setOpen(false); }} />
    
    { /* Dialog for create/edit project */ }
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
    </>
  );
}
 