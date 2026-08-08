import Link from "next/link"

import { Badge } from "@repo/ui/badge"
import { buttonVariants } from "@repo/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/card"
import type { IconType } from "@repo/ui/hugeicon"
import { IconChevronRight, SosIcon } from "@repo/ui/icons"
import { Skeleton } from "@repo/ui/skeleton"
import { StatCard, type StatAccent } from "@repo/ui/stat-card"

import { cn } from "@/lib/utils"

/**
 * Small building blocks shared by the three dashboards.
 * Each one does a single visual job, takes plain props, and has no data logic.
 */

/**
 * The dashboard is squarer than the rest of the app: every surface uses this
 * radius instead of the design system's default pill-like corners.
 * Change it here once and the whole dashboard follows.
 */
export const surface = "rounded-lg"

/** Green call-to-action button. Use it for the main action of a screen. */
export function actionButton(
  variant: "eco" | "outline" | "secondary" = "eco",
  size: "sm" | "default" = "sm"
) {
  return cn(buttonVariants({ variant, size }), surface)
}

/** Tinted background + matching icon colour for every accent we support. */
const accentSurface: Record<StatAccent, string> = {
  default: "bg-secondary/10 text-secondary",
  info: "bg-info/10 text-info",
  eco: "bg-eco/10 text-eco",
  warning: "bg-warning/10 text-warning",
}

/** A small square with an icon inside — the dashboard's signature detail. */
export function IconBadge({
  icon: Icon,
  accent = "default",
  className,
}: {
  icon: IconType
  accent?: StatAccent
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-md",
        accentSurface[accent],
        className
      )}
    >
      <Icon className="size-5" />
    </span>
  )
}

/** The greeting panel at the top of every dashboard. */
export function DashboardHero({
  title,
  description,
  action,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden border-l-2 border-eco bg-card p-6 ring-1 ring-foreground/5",
        surface
      )}
    >
      {/* Soft colour wash — decoration only, never blocks clicks. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-eco/10 via-transparent to-secondary/5"
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate font-heading text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="flex shrink-0 gap-2">{action}</div>}
      </div>
    </div>
  )
}

/** A card with an icon, a title and an optional action in the header. */
export function SectionCard({
  icon,
  accent = "default",
  title,
  description,
  action,
  className,
  contentClassName,
  children,
}: {
  icon: IconType
  accent?: StatAccent
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
  contentClassName?: string
  children: React.ReactNode
}) {
  return (
    <Card className={cn(surface, className)}>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2.5">
          <IconBadge icon={icon} accent={accent} className="size-8" />
          {title}
        </CardTitle>
        {description && (
          <CardDescription className="text-xs">{description}</CardDescription>
        )}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  )
}

/** One number on the dashboard. Dashboards build an array of these. */
export interface Stat {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon: IconType
  accent?: StatAccent
}

/** Renders the stat row, or same-sized skeletons while the data loads. */
export function StatGrid({
  stats,
  loading,
  className,
}: {
  stats: Stat[]
  loading?: boolean
  className?: string
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
      {loading
        ? stats.map((stat) => (
            <Skeleton key={stat.label} className={cn("h-[88px]", surface)} />
          ))
        : stats.map((stat) => (
            <StatCard key={stat.label} {...stat} className={surface} />
          ))}
    </div>
  )
}

/** A tappable row in a list — icon, text, numbers on the right. */
export function LinkRow({
  href,
  icon,
  accent = "default",
  title,
  meta,
  value,
  valueMeta,
}: {
  href: string
  icon: IconType
  accent?: StatAccent
  title: React.ReactNode
  meta?: React.ReactNode
  value?: React.ReactNode
  valueMeta?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 border-l-2 border-transparent px-5 py-3 transition-colors hover:border-eco hover:bg-accent"
    >
      <IconBadge icon={icon} accent={accent} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        {meta && (
          <p className="truncate text-xs text-muted-foreground">{meta}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        {value && <p className="text-sm font-semibold tabular-nums">{value}</p>}
        {valueMeta && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {valueMeta}
          </p>
        )}
      </div>
      <IconChevronRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  )
}

/** A square shortcut to another page. */
export function TileLink({
  href,
  icon,
  accent = "default",
  label,
}: {
  href: string
  icon: IconType
  accent?: StatAccent
  label: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-2 border border-border p-4 text-center transition-colors hover:border-eco/40 hover:bg-eco/5",
        surface
      )}
    >
      <IconBadge icon={icon} accent={accent} />
      <span className="text-xs font-medium">{label}</span>
    </Link>
  )
}

/** A highlighted card telling an admin something is waiting for them. */
export function ActionCard({
  href,
  icon,
  accent,
  label,
  count,
}: {
  href: string
  icon: IconType
  accent: "warning" | "info"
  label: string
  count: number
}) {
  return (
    <Link href={href}>
      <Card
        className={cn(
          "border-l-2 transition-colors hover:bg-accent",
          surface,
          accent === "warning"
            ? "border-warning ring-warning/40"
            : "border-info ring-info/40"
        )}
      >
        <CardContent className="flex items-center gap-3">
          <IconBadge icon={icon} accent={accent} />
          <span className="flex-1 text-sm font-medium">{label}</span>
          <Badge variant={accent}>{count}</Badge>
        </CardContent>
      </Card>
    </Link>
  )
}

/** Shown inside a card when there is nothing to draw. */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

/** Shown above the page when a request failed. */
export function LoadError({ children }: { children: React.ReactNode }) {
  return (
    <Card
      size="sm"
      className={cn(
        "border-l-2 border-destructive ring-destructive/30",
        surface
      )}
    >
      <CardContent className="flex items-center gap-2 text-sm">
        <SosIcon className="size-4 shrink-0 text-destructive" />
        <span className="text-muted-foreground">
          {children} Refresh to try again.
        </span>
      </CardContent>
    </Card>
  )
}
