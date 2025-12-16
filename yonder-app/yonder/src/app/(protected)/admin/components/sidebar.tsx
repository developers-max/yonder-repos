"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils/utils";
import { Button } from "@/app/_components/ui/button";
import {
  LayoutDashboard,
  FolderOpen,
  Mail,
  FileSearch,
  LogOut,
  Settings,
  Users,
  Building2,
  MapPin,
  Menu,
  X,
  Landmark
} from 'lucide-react';
import { useSession } from '@/lib/auth/auth-client';
import { useState, useEffect } from 'react';

const navigation = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    description: "Overview and statistics",
  },
  {
    name: "Projects",
    href: "/admin/projects",
    icon: FolderOpen,
    description: "All user projects and progress",
  },
  {
    name: "Outreach Requests",
    href: "/admin/outreach",
    icon: Mail,
    description: "Pending outreach campaigns",
  },
  {
    name: "PDM Requests",
    href: "/admin/pdm-requests",
    icon: FileSearch,
    description: "Municipality PDM request backlog",
  },
  { 
    name: 'Users', 
    href: '/admin/users', 
    icon: Users,
    description: 'Manage roles and access'
  },
  {
    name: 'Realtors',
    href: '/admin/realtors',
    icon: Building2,
    description: 'Realtor companies and contacts'
  },
  {
    name: 'Plots',
    href: '/admin/plots',
    icon: MapPin,
    description: 'Search and edit plot data'
  },
  {
    name: 'Municipalities',
    href: '/admin/municipalities',
    icon: Landmark,
    description: 'Manage PDM documents'
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    const { signOut } = await import("@/lib/auth/auth-client");
    await signOut();
    router.push('/');
  };

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-900">Admin Panel</h1>
            </div>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={() => setIsOpen(false)}
            className="md:hidden p-1 rounded-md hover:bg-gray-100"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className={cn(
                "flex items-center space-x-2 px-3 py-2.5 md:py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-gray-100 text-gray-900 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-200">
        <div className="flex items-center space-x-2 mb-3">
          <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
            <span className="text-gray-700 font-medium text-xs">
              {session?.user?.name?.charAt(0)?.toUpperCase() || "A"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">
              {session?.user?.name || "Admin"}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {session?.user?.email}
            </p>
          </div>
        </div>

        <Button
          onClick={handleSignOut}
          variant="outline"
          size="sm"
          className="w-full justify-start text-xs"
        >
          <LogOut className="w-3 h-3 mr-2" />
          Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 bg-white rounded-lg shadow-md border border-gray-200"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5 text-gray-700" />
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile, shown on desktop */}
      <div className={cn(
        "bg-white border-r border-gray-200 flex flex-col h-full",
        // Mobile: fixed overlay
        "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-out md:relative md:transform-none",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        {sidebarContent}
      </div>
    </>
  );
}
