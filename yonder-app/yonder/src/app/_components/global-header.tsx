'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/app/_components/ui/button';
import { Settings, LogOut, Plus, ChevronsUpDown, Building2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/app/_components/ui/dropdown-menu';
import { useSession, signOut, authClient } from '@/lib/auth/auth-client';
import type { User } from '@/lib/auth/auth-client';
import ProjectMenuInline from '@/app/_components/project-menu-inline';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/_components/ui/popover';
import CreateProjectDialog from '@/app/_components/create-project-dialog';
import ProjectBanner from '../(protected)/chat/components/project/project-banner';

function getInitials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const [a, b] = [parts[0], parts[1]];
  return ((a?.[0] || '') + (b?.[0] || '')).toUpperCase() || name[0]?.toUpperCase() || '?';
}

export function GlobalHeader() {
  const { data: session } = useSession();
  const router = useRouter();
  const user = (session?.user ?? undefined) as User | undefined;
  const [createOpen, setCreateOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const { data: activeOrganization } = authClient.useActiveOrganization();
  const projectLabel = activeOrganization?.name ?? 'Projects';

  const displayName = user?.first_name || user?.last_name
    ? `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim()
    : (user?.email ?? 'Account');
  const initials = getInitials(`${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || user?.email);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const setVar = () => {
      const h = el.offsetHeight || 0;
      document.documentElement.style.setProperty('--header-h', `${h}px`);
    };
    setVar();
    const ro = new ResizeObserver(() => setVar());
    ro.observe(el);
    window.addEventListener('resize', setVar);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', setVar);
    };
  }, []);

  return (
    <header ref={headerRef} className="sticky top-0 z-40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="w-full pl-3 sm:pl-4 pr-3 sm:pr-4 py-3 flex items-center gap-4 relative">
        <Link href="/chat" className="font-semibold text-foreground" aria-label="Go to dashboard">
          <Image src="/logo.svg" alt="Yonder" width={100} height={100} className="h-7 w-auto" />
        </Link>

        {/* Centered project actions */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <Button size="sm" variant="ghost" className="h-8 px-3" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Create project
          </Button>
          <Popover open={projectsOpen} onOpenChange={setProjectsOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-3">
                {projectLabel}
                <ChevronsUpDown className="w-3.5 h-3.5 ml-1 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="center" className="p-0 w-[340px]">
              <ProjectMenuInline
                className="w-full"
                onOrganizationChange={() => {
                  setProjectsOpen(false);
                  router.push('/chat');
                }}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="ml-auto mr-0 flex items-center gap-2">
          {user ? (
            <DropdownMenu open={accountOpen} onOpenChange={setAccountOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 px-2">
                  <div className="size-7 rounded-full bg-muted mr-2 flex items-center justify-center text-xs font-medium">
                    {initials}
                  </div>
                  <span className="hidden sm:inline-block max-w-[180px] truncate">{displayName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[220px]">
                <DropdownMenuLabel className="text-base font-semibold leading-tight">
                  <div className="flex flex-col text-left">
                    <span className="truncate">{displayName}</span>
                    <span className="text-muted-foreground text-sm font-normal truncate">{user?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-sm font-medium">Projects</DropdownMenuLabel>
                <div className="p-1">
                  <ProjectMenuInline
                    className="w-[320px]"
                    onOrganizationChange={() => {
                      setAccountOpen(false);
                      router.push('/chat');
                    }}
                  />
                </div>
                <DropdownMenuSeparator />
                {user?.role === 'admin' && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                      <Settings className="size-4" />
                      <span>Admin Panel</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                {user?.role === 'realtor' && (
                  <DropdownMenuItem asChild>
                    <Link href="/realtor" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                      <Building2 className="size-4" />
                      <span>Realtor Panel</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  variant="destructive"
                  onClick={async () => {
                    await signOut();
                    router.push('/');
                  }}
                  className="flex items-center gap-2"
                >
                  <LogOut className="size-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>

      </div>
      <div className="w-1/2 mx-auto">
        <ProjectBanner compact />
      </div>
      {/* Create project dialog (shared) */}
      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </header>
  );
}
