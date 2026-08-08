"use client"

import Link from "next/link"

import {
  CarIcon,
  ChartIcon,
  CompanyIcon,
  EcoIcon,
  RouteIcon,
  RupeeIcon,
  UsersIcon,
} from "@repo/ui/icons"
import { Skeleton } from "@repo/ui/skeleton"

import { inr } from "@/lib/utils"

import { TripsByOrgChart } from "./charts"
import { usePlatformReport } from "./queries"
import {
  actionButton,
  DashboardHero,
  EmptyState,
  LinkRow,
  LoadError,
  SectionCard,
  StatGrid,
  type Stat,
} from "./ui"

/** What a platform owner sees: every organization on Workway. */
export function SuperAdminDashboard({ name }: { name: string }) {
  const report = usePlatformReport()
  const totals = report.data?.totals
  const organizations = report.data?.organizations ?? []

  const stats: Stat[] = [
    {
      label: "Organizations",
      value: totals?.organizations ?? 0,
      icon: CompanyIcon,
    },
    {
      label: "Active users",
      value: totals?.activeUsers ?? 0,
      icon: UsersIcon,
      accent: "info",
    },
    { label: "Vehicles", value: totals?.vehicles ?? 0, icon: CarIcon },
    {
      label: "Completed trips",
      value: totals?.completedTrips ?? 0,
      icon: RouteIcon,
      accent: "info",
    },
    {
      label: "CO₂ saved",
      value: `${totals?.co2SavedKg ?? 0} kg`,
      icon: EcoIcon,
      accent: "eco",
    },
    {
      label: "Revenue",
      value: inr((totals?.revenue ?? 0) * 100),
      icon: RupeeIcon,
      accent: "warning",
    },
  ]

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Platform overview"
        description={`Hi ${name} — every organization on Workway at a glance.`}
        action={
          <>
            <Link href="/admin/organizations" className={actionButton()}>
              <CompanyIcon /> Organizations
            </Link>
            <Link href="/admin/reports" className={actionButton("outline")}>
              <ChartIcon /> Analytics
            </Link>
          </>
        }
      />

      {report.isError && (
        <LoadError>Platform totals are unavailable.</LoadError>
      )}

      <StatGrid
        stats={stats}
        loading={report.isLoading}
        className="lg:grid-cols-3 xl:grid-cols-6"
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <SectionCard
          icon={CompanyIcon}
          title="Organizations"
          description="Tap one to open its report"
          contentClassName="p-0"
        >
          <div className="divide-y divide-border">
            {report.isLoading &&
              [0, 1, 2, 3].map((row) => (
                <div key={row} className="px-5 py-3">
                  <Skeleton className="h-9 rounded-xl" />
                </div>
              ))}

            {!report.isLoading &&
              organizations.map((org) => (
                <LinkRow
                  key={org.id}
                  href={`/admin/reports?org=${org.id}`}
                  icon={CompanyIcon}
                  title={
                    <>
                      {org.name}
                      {org.status !== "ACTIVE" && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({org.status})
                        </span>
                      )}
                    </>
                  }
                  meta={`${org.activeUsers} users · ${org.vehicles} vehicles · ${org.completedTrips} trips`}
                  value={inr(org.revenue * 100)}
                  valueMeta={`${org.co2SavedKg}kg CO₂`}
                />
              ))}

            {!report.isLoading && organizations.length === 0 && (
              <EmptyState>
                {report.isError
                  ? "Couldn't load organizations."
                  : "No organizations yet."}
              </EmptyState>
            )}
          </div>
        </SectionCard>

        <SectionCard
          icon={ChartIcon}
          accent="info"
          title="Trips by organization"
          description="Completed trips and CO₂ saved"
        >
          <TripsByOrgChart data={organizations} loading={report.isLoading} />
        </SectionCard>
      </div>
    </div>
  )
}
