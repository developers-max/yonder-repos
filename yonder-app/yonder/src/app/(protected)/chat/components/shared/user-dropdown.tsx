'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/_components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/_components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/_components/ui/tooltip';
import { LogOut, Settings, Building2, Plus } from 'lucide-react';
import { useSession, signOut, type User as UserType } from '@/lib/auth/auth-client';
import { trpc } from '@/trpc/client';
import CreateProjectDialog from '@/app/_components/create-project-dialog';

interface UserDropdownProps {
  disabled?: boolean;
}

export default function UserDropdown({ disabled = false }: UserDropdownProps) {
  const router = useRouter();
  const { data: session, isPending: isSessionLoading } = useSession();
  const [createOpen, setCreateOpen] = useState(false);
  
  // Safe admin check (does not throw for non-admins)
  const { data: adminCheck } = trpc.admin.isAdmin.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !!session?.user?.id,
  });
  const { data: realtorCheck } = trpc.realtor.isRealtor.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !!session?.user?.id,
  });

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const getUserDisplayName = () => {
    const user = session?.user as UserType;
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return session?.user?.name || session?.user?.email || 'User';
  };

  const getUserInitials = () => {
    const user = session?.user as UserType;
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (session?.user?.name) {
      const names = session.user.name.split(' ');
      return names.length > 1 
        ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
        : names[0][0].toUpperCase();
    }
    return session?.user?.email?.[0]?.toUpperCase() || 'U';
  };

  if (isSessionLoading) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={true}
        className="h-9 w-9 p-0 rounded-full"
      >
        <div className="w-6 h-6 rounded-full bg-muted animate-pulse" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              className="h-9 w-9 p-0 rounded-full hover:bg-primary/10"
            >
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-medium text-primary">
                  {getUserInitials()}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Account menu</p>
          <p className="text-xs opacity-75">View profile and sign out options</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {getUserDisplayName()}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {session?.user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          <span>Create project</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {realtorCheck?.isRealtor && (
          <>
            <DropdownMenuItem onClick={() => window.open('/realtor', '_blank', 'noopener,noreferrer')}>
              <Building2 className="mr-2 h-4 w-4" />
              <span>Realtor Panel</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {adminCheck?.isAdmin && (
          <>
            <DropdownMenuItem onClick={() => window.open('/admin', '_blank', 'noopener,noreferrer')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Admin Panel</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={handleSignOut} variant="destructive">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
      {/* Shared Create Project dialog */}
      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </DropdownMenu>
  );
}
 