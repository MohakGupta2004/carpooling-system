"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"
import { api } from "@/lib/api"
import { useAuth } from "@/stores/auth"
import { inr } from "@/lib/utils"
import { PageHeader } from "@repo/ui/page-header"
import { StatCard } from "@repo/ui/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card"
import { Button } from "@repo/ui/button"
import { Badge } from "@repo/ui/badge"
import { Skeleton } from "@repo/ui/skeleton"
import {
  RouteIcon,
  EcoIcon,
  FuelIcon,
  TreesIcon,
  SearchIcon,
  DriveIcon,
  RupeeIcon,
  UsersIcon,
  CarIcon,
  ChartIcon,
  CompanyIcon,
  KeyIcon,
  VerifiedIcon,
} from "@repo/ui/icons"

const axis = { fontSize: 11, fill: "var(--muted-foreground)" }
const dayLabel = (d: string) =>
  new Date(d).toLocaleDateString([], { day: "numeric", month: "short" })
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      {label !== undefined && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.fill }}>
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const user = useAuth((s) => s.user)
  const permissions = useAuth((s) => s.permissions)
  const first = user?.fullName?.split(" ")[0] ?? "there"

  if (permissions.has("org:manage")) return <SuperAdminDashboard name={first} />
  if (permissions.has("analytics:view"))
    return <AdminDashboard name={first} orgName={user?.organization?.name} />
  return <EmployeeDashboard name={first} />
}

/* ───────────────── Super Admin — platform-wide ───────────────── */
interface Comparison {
  organizations: {
    id: string
    name: string
    status: string
    activeUsers: number
    vehicles: number
    rides: number
    completedTrips: number
    co2SavedKg: number
    avgOccupancy: number
    revenue: number
  }[]
  totals: {
    organizations: number
    activeUsers: number
    vehicles: number
    completedTrips: number
    co2SavedKg: number
    revenue: number
  }
}
function SuperAdminDashboard({ name }: { name: string }) {
  const q = useQuery({
    queryKey: ["org-comparison"],
    queryFn: () => api.get<Comparison>("/reports/org-comparison"),
  })
  const t = q.data?.totals
  const orgs = q.data?.organizations ?? []
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Platform overview`}
        description={`Hi ${name} — every organization on RideBuddy at a glance.`}
        action={
          <div className="flex gap-2">
            <Button size="sm" asChild>
              <Link href="/admin/organizations">
                <CompanyIcon /> Organizations
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/admin/reports">
                <ChartIcon /> Analytics
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {q.isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))
        ) : (
          <>
            <StatCard
              label="Organizations"
              value={t?.organizations ?? 0}
              icon={CompanyIcon}
            />
            <StatCard
              label="Active users"
              value={t?.activeUsers ?? 0}
              icon={UsersIcon}
              accent="info"
            />
            <StatCard
              label="Vehicles"
              value={t?.vehicles ?? 0}
              icon={CarIcon}
            />
            <StatCard
              label="Completed trips"
              value={t?.completedTrips ?? 0}
              icon={RouteIcon}
              accent="info"
            />
            <StatCard
              label="CO₂ saved"
              value={`${t?.co2SavedKg ?? 0} kg`}
              icon={EcoIcon}
              accent="eco"
            />
            <StatCard
              label="Revenue"
              value={inr((t?.revenue ?? 0) * 100)}
              icon={RupeeIcon}
              accent="warning"
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Organizations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {orgs.map((o) => (
                <Link
                  key={o.id}
                  href="/admin/reports"
                  className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-accent"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
                      <CompanyIcon className="size-5" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">
                        {o.name}
                        {o.status !== "ACTIVE" && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({o.status})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {o.activeUsers} users · {o.vehicles} vehicles ·{" "}
                        {o.completedTrips} trips
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="tabular text-sm font-semibold">
                      {inr(o.revenue * 100)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {o.co2SavedKg}kg CO₂
                    </p>
                  </div>
                </Link>
              ))}
              {orgs.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No organizations yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Trips by organization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={orgs} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={axis}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={axis}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<ChartTip />} />
                  <Bar
                    dataKey="completedTrips"
                    name="Trips"
                    radius={[4, 4, 0, 0]}
                    fill="var(--chart-1)"
                  />
                  <Bar
                    dataKey="co2SavedKg"
                    name="CO₂ (kg)"
                    radius={[4, 4, 0, 0]}
                    fill="var(--chart-3)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ───────────────── Company Admin — org portal ───────────────── */
interface Analytics {
  kpis: {
    employees: number
    activeEmployees: number
    adoptionRate: number
    vehicles: number
    verifiedVehicles: number
    totalTrips: number
    activeTrips: number
    cancelledTrips: number
    cancellationRate: number
    revenue: number
    monthRevenue: number
    avgOccupancy: number
    totalDistanceKm: number
    co2SavedKg: number
    fuelSavedL: number
    treesEquivalent: number
    ecoPoints: number
  }
  tripsPerDay: { date: string; trips: number }[]
  tripsByStatus: { status: string; count: number }[]
}
interface AdminVehicle {
  verification: string
  pendingChanges: unknown | null
}
function AdminDashboard({ name, orgName }: { name: string; orgName?: string }) {
  const a = useQuery({
    queryKey: ["analytics", "dash"],
    queryFn: () => api.get<Analytics>("/reports/analytics"),
  })
  const veh = useQuery({
    queryKey: ["admin", "vehicles"],
    queryFn: () => api.get<AdminVehicle[]>("/admin/vehicles"),
  })
  const k = a.data?.kpis
  const pendingApprovals =
    veh.data?.filter((v) => v.verification === "PENDING").length ?? 0
  const pendingEdits = veh.data?.filter((v) => v.pendingChanges).length ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${orgName ?? "Organization"} dashboard`}
        description={`Hi ${name} — your organization's operations, adoption and sustainability.`}
        action={
          <div className="flex gap-2">
            <Button size="sm" asChild>
              <Link href="/admin/reports">
                <ChartIcon /> Full analytics
              </Link>
            </Button>
          </div>
        }
      />

      {(pendingApprovals > 0 || pendingEdits > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {pendingApprovals > 0 && (
            <Link href="/admin/vehicles">
              <Card className="border-[var(--warning)]/40 transition-colors hover:bg-accent">
                <CardContent className="flex items-center justify-between p-4">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <CarIcon className="size-5 text-primary" /> Vehicles
                    awaiting verification
                  </span>
                  <Badge variant="warning">{pendingApprovals}</Badge>
                </CardContent>
              </Card>
            </Link>
          )}
          {pendingEdits > 0 && (
            <Link href="/admin/vehicles">
              <Card className="border-[var(--info)]/40 transition-colors hover:bg-accent">
                <CardContent className="flex items-center justify-between p-4">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <EditPending /> Owner edits to review
                  </span>
                  <Badge variant="info">{pendingEdits}</Badge>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {a.isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))
        ) : (
          <>
            <StatCard
              label="Employees"
              value={k?.employees ?? 0}
              sub={`${k?.adoptionRate ?? 0}% adoption`}
              icon={UsersIcon}
            />
            <StatCard
              label="Vehicles"
              value={k?.vehicles ?? 0}
              sub={`${k?.verifiedVehicles ?? 0} verified`}
              icon={CarIcon}
            />
            <StatCard
              label="Completed trips"
              value={k?.totalTrips ?? 0}
              sub={`${k?.cancellationRate ?? 0}% cancelled`}
              icon={RouteIcon}
              accent="info"
            />
            <StatCard
              label="Revenue"
              value={inr((k?.revenue ?? 0) * 100)}
              sub={`${inr((k?.monthRevenue ?? 0) * 100)} this month`}
              icon={RupeeIcon}
              accent="warning"
            />
            <StatCard
              label="CO₂ saved"
              value={`${k?.co2SavedKg ?? 0} kg`}
              sub={`${k?.treesEquivalent ?? 0} trees`}
              icon={EcoIcon}
              accent="eco"
            />
            <StatCard
              label="Avg occupancy"
              value={k?.avgOccupancy ?? 0}
              sub="passengers / trip"
              icon={DriveIcon}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Trips per day</CardTitle>
            <p className="text-xs text-muted-foreground">
              Completed rides over the last 30 days
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={a.data?.tripsPerDay ?? []}
                  margin={{ left: -20, right: 8, top: 8 }}
                >
                  <defs>
                    <linearGradient id="gT" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--chart-1)"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--chart-1)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={dayLabel}
                    tick={axis}
                    interval={4}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={axis}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<ChartTip />} />
                  <Area
                    type="monotone"
                    dataKey="trips"
                    name="Trips"
                    stroke="var(--chart-1)"
                    fill="url(#gT)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Manage</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <QuickLink
              href="/admin/employees"
              icon={<UsersIcon className="size-5" />}
              label="Employees"
            />
            <QuickLink
              href="/admin/vehicles"
              icon={<CarIcon className="size-5" />}
              label="Vehicles"
            />
            <QuickLink
              href="/admin/reports"
              icon={<ChartIcon className="size-5" />}
              label="Analytics"
            />
            <QuickLink
              href="/admin/rbac"
              icon={<KeyIcon className="size-5" />}
              label="Roles & Access"
            />
            <QuickLink
              href="/admin/company"
              icon={<CompanyIcon className="size-5" />}
              label="Company"
            />
            <QuickLink
              href="/admin/reports"
              icon={<VerifiedIcon className="size-5" />}
              label="Sustainability"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
function EditPending() {
  return <VerifiedIcon className="size-5 text-primary" />
}
function QuickLink({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-center transition-colors hover:bg-accent"
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
        {icon}
      </span>
      <span className="text-xs font-medium">{label}</span>
    </Link>
  )
}

/* ───────────────── Employee — personal ───────────────── */
interface MeReport {
  totalTrips: number
  totalDistanceKm: number
  fuelSavedL: number
  co2SavedKg: number
}
interface Sustain {
  co2SavedKg: number
  fuelSavedL: number
  treesEquivalent: number
  greenScore: number
}
function EmployeeDashboard({ name }: { name: string }) {
  const report = useQuery({
    queryKey: ["report", "me"],
    queryFn: () => api.get<MeReport>("/reports/me"),
  })
  const sustain = useQuery({
    queryKey: ["sustainability"],
    queryFn: () => api.get<Sustain>("/reports/sustainability"),
  })

  return (
    <div>
      <PageHeader
        title={`Hi, ${name} 👋`}
        description="Your commuting impact at a glance."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {report.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))
        ) : (
          <>
            <StatCard
              label="Total trips"
              value={report.data?.totalTrips ?? 0}
              icon={RouteIcon}
            />
            <StatCard
              label="Distance shared"
              value={`${report.data?.totalDistanceKm ?? 0} km`}
              icon={DriveIcon}
              accent="info"
            />
            <StatCard
              label="Fuel saved"
              value={`${report.data?.fuelSavedL ?? 0} L`}
              icon={FuelIcon}
              accent="warning"
            />
            <StatCard
              label="CO₂ saved"
              value={`${report.data?.co2SavedKg ?? 0} kg`}
              icon={EcoIcon}
              accent="eco"
            />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/find">
                <SearchIcon /> Find a ride
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/offer">
                <DriveIcon /> Offer a ride
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/trips">
                <RouteIcon /> My trips
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <EcoIcon className="size-4 text-primary" /> Sustainability
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sustain.isLoading ? (
              <Skeleton className="h-24" />
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <TreesIcon className="size-4" /> Trees equivalent
                  </span>
                  <span className="tabular font-semibold">
                    {sustain.data?.treesEquivalent ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <FuelIcon className="size-4" /> Fuel saved
                  </span>
                  <span className="tabular font-semibold">
                    {sustain.data?.fuelSavedL ?? 0} L
                  </span>
                </div>
                <div className="pt-2">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Green score</span>
                    <span>{sustain.data?.greenScore ?? 0}/100</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${sustain.data?.greenScore ?? 0}%` }}
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
