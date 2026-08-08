"use client"

import Link from "next/link"

import {
  CarIcon,
  ChartIcon,
  CompanyIcon,
  DriveIcon,
  EcoIcon,
  EditIcon,
  KeyIcon,
  RouteIcon,
  RupeeIcon,
  UsersIcon,
  VerifiedIcon,
} from "@repo/ui/icons"
import type { IconType } from "@repo/ui/hugeicon"
import type { StatAccent } from "@repo/ui/stat-card"

import { inr } from "@/lib/utils"

import { TripsPerDayChart } from "./charts"
import { useOrgReport, useOrgVehicles } from "./queries"
import {
  actionButton,
  ActionCard,
  DashboardHero,
  LoadError,
  SectionCard,
  StatGrid,
  TileLink,
  type Stat,
} from "./ui"

/** The shortcuts in the "Manage" card. Add a page by adding a line here. */
const managePages: {
  href: string
  icon: IconType
  label: string
  accent?: StatAccent
}[] = [
  { href: "/admin/employees", icon: UsersIcon, label: "Employees" },
  { href: "/admin/vehicles", icon: CarIcon, label: "Vehicles", accent: "info" },
  { href: "/admin/reports", icon: ChartIcon, label: "Analytics" },
  {
    href: "/admin/rbac",
    icon: KeyIcon,
    label: "Roles & Access",
    accent: "warning",
  },
  { href: "/admin/company", icon: CompanyIcon, label: "Company" },
  {
    href: "/admin/reports?tab=sustainability",
    icon: VerifiedIcon,
    label: "Sustainability",
    accent: "eco",
  },
]

/** What a company admin sees: their own organization. */
export function AdminDashboard({
  name,
  orgName,
}: {
  name: string
  orgName?: string
}) {
  const report = useOrgReport()
  const vehiclesQuery = useOrgVehicles()

  const kpis = report.data?.kpis
  const vehicles = vehiclesQuery.data ?? []

  // Two things an admin may need to act on.
  const awaitingVerification = vehicles.filter(
    (vehicle) => vehicle.verification === "PENDING"
  ).length
  const awaitingEditReview = vehicles.filter(
    (vehicle) => vehicle.pendingChanges
  ).length

  const stats: Stat[] = [
    {
      label: "Employees",
      value: kpis?.employees ?? 0,
      sub: `${kpis?.adoptionRate ?? 0}% adoption`,
      icon: UsersIcon,
    },
    {
      label: "Vehicles",
      value: kpis?.vehicles ?? 0,
      sub: `${kpis?.verifiedVehicles ?? 0} verified`,
      icon: CarIcon,
    },
    {
      label: "Completed trips",
      value: kpis?.totalTrips ?? 0,
      sub: `${kpis?.cancellationRate ?? 0}% cancelled`,
      icon: RouteIcon,
      accent: "info",
    },
    {
      label: "Revenue",
      value: inr((kpis?.revenue ?? 0) * 100),
      sub: `${inr((kpis?.monthRevenue ?? 0) * 100)} this month`,
      icon: RupeeIcon,
      accent: "warning",
    },
    {
      label: "CO₂ saved",
      value: `${kpis?.co2SavedKg ?? 0} kg`,
      sub: `${kpis?.treesEquivalent ?? 0} trees`,
      icon: EcoIcon,
      accent: "eco",
    },
    {
      label: "Avg occupancy",
      value: kpis?.avgOccupancy ?? 0,
      sub: "passengers / trip",
      icon: DriveIcon,
    },
  ]

  return (
    <div className="space-y-6">
      <DashboardHero
        title={`${orgName ?? "Organization"} dashboard`}
        description={`Hi ${name} — your operations, adoption and sustainability.`}
        action={
          <Link href="/admin/reports" className={actionButton()}>
            <ChartIcon /> Full analytics
          </Link>
        }
      />

      {report.isError && (
        <LoadError>Organization analytics are unavailable.</LoadError>
      )}

      {(awaitingVerification > 0 || awaitingEditReview > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {awaitingVerification > 0 && (
            <ActionCard
              href="/admin/vehicles"
              icon={CarIcon}
              accent="warning"
              label="Vehicles awaiting verification"
              count={awaitingVerification}
            />
          )}
          {awaitingEditReview > 0 && (
            <ActionCard
              href="/admin/vehicles"
              icon={EditIcon}
              accent="info"
              label="Owner edits to review"
              count={awaitingEditReview}
            />
          )}
        </div>
      )}

      <StatGrid
        stats={stats}
        loading={report.isLoading}
        className="lg:grid-cols-3 xl:grid-cols-6"
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <SectionCard
          icon={RouteIcon}
          accent="info"
          title="Trips per day"
          description="Completed rides over the last 30 days"
        >
          <TripsPerDayChart
            data={report.data?.tripsPerDay ?? []}
            loading={report.isLoading}
          />
        </SectionCard>

        <SectionCard
          icon={CompanyIcon}
          title="Manage"
          description="Jump to an admin page"
          contentClassName="grid grid-cols-2 gap-3"
        >
          {managePages.map((page) => (
            <TileLink key={page.href} {...page} />
          ))}
        </SectionCard>
      </div>
    </div>
  )
}
