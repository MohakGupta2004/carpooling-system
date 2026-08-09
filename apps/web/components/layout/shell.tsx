"use client"

import { useSyncExternalStore } from "react"
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
  const hydrated = useSyncExternalStore(
    useSidebar.persist.onFinishHydration,
    useSidebar.persist.hasHydrated,
    () => false
  )
  const isCollapsed = hydrated && collapsed

  // Super Admins are platform operators — their home org is an implementation
  // detail, never surfaced as "their company".
  const isSuper = permissions.has("org:manage")

  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.filter(
      (i) => !i.permission || permissions.has(i.permission)
    ),
  })).filter((g) => g.items.length > 0)

  return (
    <TooltipProvider delay={0}>
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
              <span className="flex-1 truncate text-base font-semibold tracking-tight">
                Workway
              </span>
            )}
            <Tooltip>
              <TooltipTrigger
                onClick={toggle}
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
              >
                <SidebarToggleIcon className="size-5" />
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
                  <div className="mb-1 px-3 text-xs font-medium text-muted-foreground">
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
                        // Carries the current page to assistive tech, and lets the
                        // tint below be a reinforcement rather than the only signal.
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group flex items-center gap-3 rounded-md text-sm transition-colors duration-(--duration-fast)",
                          isCollapsed ? "justify-center p-2" : "px-3 py-2",
                          active
                            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-5 shrink-0",
                            active
                              ? "text-sidebar-primary"
                              : "text-muted-foreground"
                          )}
                        />
                        {!isCollapsed && item.label}
                      </Link>
                    )
                    return isCollapsed ? (
                      <Tooltip key={item.href}>
                        <TooltipTrigger render={link} />
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
          <header className="sticky top-0 z-(--z-sticky) flex h-16 items-center justify-between border-b border-border bg-background px-6">
            <div className="min-w-0 truncate text-sm text-muted-foreground">
              {isSuper ? "Platform" : (user?.organization?.name ?? "Workway")}
            </div>
            <div className="flex items-center gap-3">
              {/* Eco points are a passive counter, not an active state — neutral
                  chrome, with the figure itself carrying the emphasis. */}
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
                <EcoIcon className="size-3.5" />
                <span className="font-medium text-foreground tabular-nums">
                  {user?.ecoPoints ?? 0}
                </span>
                eco pts
              </span>
              <NotificationBell />
            </div>
          </header>

          <main className="min-w-0 flex-1 p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  )
}
