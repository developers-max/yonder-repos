"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Building2, Leaf, Menu, X } from "lucide-react";
import { Button } from "@/app/_components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/app/_components/ui/dropdown-menu";
import { cn } from "@/lib/utils/utils";

const solutions = [
  {
    href: "/landing/realtor",
    label: "For Realtors",
    description: "Tools for real estate professionals",
    icon: Building2,
    disabled: false,
  },
  {
    href: "/landing/landowner",
    label: "For Land Owners",
    description: "Coming soon",
    icon: Leaf,
    disabled: true,
  },
];

export function PublicHeader() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActiveSolution = solutions.some((s) => pathname === s.href);

  return (
    <header className="sticky top-0 z-20 bg-background border-b border-gray-100">
      <div className="mx-auto max-w-7xl px-8 py-4 flex items-center justify-between">
        <Link href="/" className="font-semibold">
          <Image src="/logo.svg" alt="Yonder" width={100} height={100} />
        </Link>

        <div className="flex items-center gap-1">
          <nav className="hidden md:flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    isActiveSolution
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  Solutions
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {solutions.map((solution) => {
                  const Icon = solution.icon;
                  const isActive = pathname === solution.href;
                  
                  if (solution.disabled) {
                    return (
                      <div
                        key={solution.href}
                        className="flex items-start gap-3 p-3 cursor-not-allowed opacity-50"
                      >
                        <Icon className="h-5 w-5 mt-0.5 text-muted-foreground" />
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-muted-foreground">{solution.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {solution.description}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <DropdownMenuItem key={solution.href} asChild>
                      <Link
                        href={solution.href}
                        className={cn(
                          "flex items-start gap-3 p-3 cursor-pointer",
                          isActive && "bg-accent"
                        )}
                      >
                        <Icon className="h-5 w-5 mt-0.5 text-primary" />
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{solution.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {solution.description}
                          </span>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <span
              className="px-3 py-2 text-sm font-medium text-muted-foreground/50 rounded-md cursor-not-allowed"
              title="Coming soon"
            >
              Pricing
            </span>
          </nav>

          <Button variant="ghost" asChild className="font-medium">
            <Link href="/login">Login</Link>
          </Button>

          <button
            className="md:hidden p-2 rounded-md hover:bg-accent"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-background">
          <nav className="flex flex-col px-4 py-3 gap-1">
            {solutions.map((solution) => {
              const Icon = solution.icon;
              const isActive = pathname === solution.href;
              
              if (solution.disabled) {
                return (
                  <div
                    key={solution.href}
                    className="flex items-center gap-3 px-3 py-3 rounded-md cursor-not-allowed opacity-50"
                  >
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="font-medium text-sm text-muted-foreground">{solution.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {solution.description}
                      </span>
                    </div>
                  </div>
                );
              }
              
              return (
                <Link
                  key={solution.href}
                  href={solution.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-md transition-colors",
                    "hover:bg-accent",
                    isActive ? "bg-accent" : ""
                  )}
                >
                  <Icon className="h-5 w-5 text-primary" />
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{solution.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {solution.description}
                    </span>
                  </div>
                </Link>
              );
            })}

            <span
              className="flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-muted-foreground/50 cursor-not-allowed"
              title="Coming soon"
            >
              Pricing
            </span>

            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium hover:bg-accent transition-colors"
            >
              Login
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
