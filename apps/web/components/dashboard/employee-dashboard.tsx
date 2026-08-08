"use client"

import Link from "next/link"

import {
  DriveIcon,
  EcoIcon,
  FuelIcon,
  RouteIcon,
  SearchIcon,
  TreesIcon,
} from "@repo/ui/icons"
import type { IconType } from "@repo/ui/hugeicon"
import { Progress, ProgressLabel, ProgressValue } from "@repo/ui/progress"
import { Skeleton } from "@repo/ui/skeleton"

import { useMyReport, useMySustainability } from "./queries"
import {
  actionButton,
  DashboardHero,
  EmptyState,
  IconBadge,
  LoadError,
  SectionCard,
  StatGrid,
  type Stat,
} from "./ui"

/** What an employee sees: their own commute. */
export function EmployeeDashboard({ name }: { name: string }) {
  const report = useMyReport()
  const sustainability = useMySustainability()

  // The API should already send 0-100, but never let the bar overflow.
  const greenScore = clamp(sustainability.data?.greenScore ?? 0, 0, 100)

  const stats: Stat[] = [
    {
      label: "Total trips",
      value: report.data?.totalTrips ?? 0,
      icon: RouteIcon,
    },
    {
      label: "Distance shared",
      value: `${report.data?.totalDistanceKm ?? 0} km`,
      icon: DriveIcon,
      accent: "info",
    },
    {
      label: "Fuel saved",
      value: `${report.data?.fuelSavedL ?? 0} L`,
      icon: FuelIcon,
      accent: "warning",
    },
    {
      label: "CO₂ saved",
      value: `${report.data?.co2SavedKg ?? 0} kg`,
      icon: EcoIcon,
      accent: "eco",
    },
  ]

  return (
    <div className="space-y-6">
      <DashboardHero
        title={`Hi, ${name} 👋`}
        description="Your commuting impact at a glance."
      />

      {report.isError && (
        <LoadError>Your trip stats are unavailable.</LoadError>
      )}

      <StatGrid
        stats={stats}
        loading={report.isLoading}
        className="lg:grid-cols-4"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          icon={SearchIcon}
          title="Quick actions"
          description="Everything you need for today's commute"
          className="lg:col-span-2"
          contentClassName="flex flex-wrap gap-3"
        >
          <Link href="/find" className={actionButton("eco", "default")}>
            <SearchIcon /> Find a ride
          </Link>
          <Link href="/offer" className={actionButton("secondary", "default")}>
            <DriveIcon /> Offer a ride
          </Link>
          <Link href="/trips" className={actionButton("outline", "default")}>
            <RouteIcon /> My trips
          </Link>
        </SectionCard>

        <SectionCard
          icon={EcoIcon}
          accent="eco"
          title="Sustainability"
          description="What your shared rides saved"
          contentClassName="space-y-4"
        >
          {sustainability.isLoading && (
            <Skeleton className="h-28 rounded-2xl" />
          )}

          {sustainability.isError && (
            <EmptyState>
              Couldn&apos;t load your sustainability stats.
            </EmptyState>
          )}

          {sustainability.isSuccess && (
            <>
              <SavingRow
                icon={TreesIcon}
                label="Trees equivalent"
                value={sustainability.data.treesEquivalent}
              />
              <SavingRow
                icon={FuelIcon}
                label="Fuel saved"
                value={`${sustainability.data.fuelSavedL} L`}
              />
              <Progress
                value={greenScore}
                className="pt-1 [&_[data-slot=progress-indicator]]:bg-eco [&_[data-slot=progress-track]]:rounded-sm"
              >
                <ProgressLabel className="text-xs text-muted-foreground">
                  Green score
                </ProgressLabel>
                <ProgressValue className="text-xs font-semibold">
                  {(_, value) => `${value ?? 0}/100`}
                </ProgressValue>
              </Progress>
            </>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

/** One "icon — label — number" line inside the sustainability card. */
function SavingRow({
  icon,
  label,
  value,
}: {
  icon: IconType
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <IconBadge icon={icon} accent="eco" className="size-8" />
      <span className="flex-1 text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  )
}

/** Keeps a number inside min..max. */
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
