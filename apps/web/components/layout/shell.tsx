"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { IconType } from "@repo/ui/hugeicon"
import { useAuth } from "@/stores/auth"
import { useSidebar } from "@/stores/sidebar"
import { cn } from "@/lib/utils"
import { NotificationBell } from "@/components/realtime/notification-bell"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/tooltip"
import { SidebarUser } from "./sidebar-user"
import {
  DashboardIcon,
  SearchIcon,
  DriveIcon,
  CarIcon,
  RoadIcon,
  RouteIcon,
  WalletIcon,
  HistoryIcon,
  ChartIcon,
  UsersIcon,
  CompanyIcon,
  KeyIcon,
  EcoIcon,
  LeafBrand,
  SidebarToggleIcon,
} from "./navicons"

interface NavItem {
  href: string
  label: string
  icon: IconType
  permission?: string
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
      {
        href: "/rides",
        label: "Available Rides",
        icon: RoadIcon,
        permission: "ride:read",
      },
      {
        href: "/find",
        label: "Find a Ride",
        icon: SearchIcon,
        permission: "ride:search",
      },
      {
        href: "/offer",
        label: "Offer a Ride",
        icon: DriveIcon,
        permission: "ride:create",
      },
      {
        href: "/my-rides",
        label: "My Rides",
        icon: CarIcon,
        permission: "ride:read",
      },
      {
        href: "/trips",
        label: "My Trips",
        icon: RouteIcon,
        permission: "ride:read",
      },
    ],
  },
  {
    section: "Account",
    items: [
      // Personal ride features — employees only (admins are management-only).
      {
        href: "/vehicles",
        label: "Vehicles",
        icon: CarIcon,
        permission: "vehicle:create",
      },
      {
        href: "/wallet",
        label: "Wallet",
        icon: WalletIcon,
        permission: "wallet:read",
      },
      {
        href: "/history",
        label: "Ride History",
        icon: HistoryIcon,
        permission: "booking:read",
      },
      {
        href: "/reports",
        label: "Reports",
        icon: ChartIcon,
        permission: "report:view:self",
      },
    ],
  },
  {
    section: "Administration",
    items: [
      {
        href: "/admin/organizations",
        label: "Organizations",
        icon: CompanyIcon,
        permission: "org:manage",
      },
      {
        href: "/admin/employees",
        label: "Employees",
        icon: UsersIcon,
        permission: "user:approve",
      },
      // Org-wide fleet (all vehicles in the org) — management, not personal.
      {
        href: "/admin/vehicles",
        label: "Vehicles",
        icon: CarIcon,
        permission: "vehicle:verify",
      },
      {
        href: "/admin/company",
        label: "Company",
        icon: CompanyIcon,
        permission: "company:read",
      },
      {
        href: "/admin/rbac",
        label: "Roles & Access",
        icon: KeyIcon,
        permission: "rbac:manage",
      },
      {
        href: "/admin/reports",
        label: "Org Analytics",
        icon: ChartIcon,
        permission: "report:view:org",
      },
    ],
  },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, permissions } = useAuth()
  const collapsed = useSidebar((s) => s.collapsed)
  const toggle = useSidebar((s) => s.toggle)

  // Render expanded on first paint, then apply persisted preference (no hydration mismatch).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isCollapsed = mounted && collapsed

  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.filter(
      (i) => !i.permission || permissions.has(i.permission)
    ),
  })).filter((g) => g.items.length > 0)

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex min-h-screen bg-background">
        {/* Sidebar — pinned to the viewport (100vh) while the page scrolls */}
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 flex-col self-start border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex",
            isCollapsed ? "w-16" : "w-60"
          )}
        >
          {/* Brand + collapse toggle */}
          <div
            className={cn(
              "flex h-16 items-center gap-2",
              isCollapsed ? "justify-center px-2" : "px-5"
            )}
          >
            {!isCollapsed && (
              <>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <LeafBrand className="size-5" />
                </span>
                <span className="flex-1 truncate text-lg font-semibold tracking-tight">
                  RideBuddy
                </span>
              </>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggle}
                  aria-label={
                    isCollapsed ? "Expand sidebar" : "Collapse sidebar"
                  }
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                >
                  <SidebarToggleIcon className="size-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Nav */}
          <nav
            className={cn(
              "flex-1 scrollbar-thin space-y-5 overflow-y-auto py-4",
              isCollapsed ? "px-2" : "px-3"
            )}
          >
            {groups.map((group) => (
              <div key={group.section}>
                {!isCollapsed && (
                  <div className="mb-1 px-3 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                    {group.section}
                  </div>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const active =
                      pathname === item.href ||
                      (item.href !== "/dashboard" &&
                        pathname.startsWith(item.href))
                    const link = (
                      <Link
                        href={item.href}
                        aria-label={item.label}
                        className={cn(
                          "group flex items-center gap-3 rounded-md text-sm transition-colors",
                          isCollapsed ? "justify-center p-2" : "px-3 py-2",
                          active
                            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <Icon className="size-5 shrink-0" />
                        {!isCollapsed && item.label}
                      </Link>
                    )
                    return isCollapsed ? (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <div key={item.href}>{link}</div>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Profile (moved here from the topbar) */}
          <div className="border-t border-sidebar-border p-2">
            <SidebarUser collapsed={isCollapsed} />
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-border bg-card/50 px-6 backdrop-blur">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CompanyIcon className="size-4" />
              {user?.organization?.name ?? "RideBuddy"}
            </div>
            <div className="flex items-center gap-3">
              {/* Subtle on-brand chip — neutral pill + teal leaf, matches the toolbar */}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground shadow-xs">
                <EcoIcon className="size-3.5 text-primary" />
                {user?.ecoPoints ?? 0}
                <span className="font-normal text-muted-foreground">
                  eco pts
                </span>
              </span>
              <NotificationBell />
            </div>
          </header>

          <main className="min-w-0 flex-1 p-6">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  )
}
