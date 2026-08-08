"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ComposedChart,
  Line,
  RadialBarChart,
  RadialBar,
} from "recharts"
import { api } from "@/lib/api"
import { useAuth } from "@/stores/auth"
import { inr } from "@/lib/utils"
import { PageHeader } from "@/components/ui/page-header"
import { DateRangePicker, type Range } from "@/components/ui/date-range-picker"
import { StatCard } from "@/components/ui/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  UsersIcon,
  CarIcon,
  RouteIcon,
  EcoIcon,
  RupeeIcon,
  FuelIcon,
  TreesIcon,
  DownloadIcon,
} from "@/components/ui/icons"

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
  peakHours: { hour: number; count: number }[]
  popularRoutes: { route: string; count: number }[]
  paymentMethods: { method: string; count: number; amount: number }[]
  monthlyTrend: { month: string; revenue: number; co2Kg: number }[]
  topDrivers: { name: string; trips: number; distanceKm: number }[]
  departmentAdoption: { department: string; trips: number; employees: number }[]
  vehicleTypes: { type: string; count: number }[]
}

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

const CHART = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]
const axis = { fontSize: 11, fill: "var(--muted-foreground)" }

function ChartCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function ChartTip({ active, payload, label, fmt }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      {label !== undefined && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.fill }}>
          {p.name}:{" "}
          <span className="font-semibold">{fmt ? fmt(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  )
}

const dayLabel = (d: string) =>
  new Date(d).toLocaleDateString([], { day: "numeric", month: "short" })
const hourLabel = (h: number) => `${h}:00`

export default function OrgAnalyticsPage() {
  const isSuper = useAuth((s) => s.permissions.has("org:manage"))
  const [range, setRange] = useState<Range | null>(null)
  const [orgId, setOrgId] = useState<string>("") // "" = my own org

  // Super Admin: org picker + cross-org comparison.
  const orgList = useQuery({
    queryKey: ["orgs-lite"],
    queryFn: () =>
      api.get<{ id: string; name: string }[]>("/admin/organizations"),
    enabled: isSuper,
  })
  const comparison = useQuery({
    queryKey: ["org-comparison"],
    queryFn: () => api.get<Comparison>("/reports/org-comparison"),
    enabled: isSuper,
  })

  const params = new URLSearchParams()
  if (range) {
    params.set("from", range.from.toISOString())
    params.set("to", range.to.toISOString())
  }
  if (orgId) params.set("orgId", orgId)
  const qs = params.toString() ? `?${params.toString()}` : ""
  const q = useQuery({
    queryKey: [
      "analytics",
      "org",
      orgId || "self",
      range?.from.toISOString() ?? "all",
      range?.to.toISOString() ?? "all",
    ],
    queryFn: () => api.get<Analytics>(`/reports/analytics${qs}`),
    placeholderData: (prev) => prev, // keep charts visible while refetching
  })

  const filterBar = (
    <div className="flex flex-wrap items-center gap-2">
      {isSuper && (
        <Select
          value={orgId || "__self"}
          onValueChange={(v) => setOrgId(v === "__self" ? "" : v)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__self">My organization</SelectItem>
            {orgList.data?.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <DateRangePicker value={range} onChange={setRange} />
    </div>
  )

  if (q.isLoading || !q.data) {
    return (
      <div>
        <PageHeader
          title="Organization Analytics"
          description="Loading insights…"
          action={filterBar}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    )
  }
  const d = q.data
  const k = d.kpis
  const greenScore = Math.min(
    100,
    Math.round(k.co2SavedKg / 5 + d.topDrivers.length * 4)
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization Analytics"
        description={
          range
            ? `Filtered: ${range.from.toLocaleDateString()} – ${range.to.toLocaleDateString()}`
            : "Live, calculated insights across adoption, operations, revenue and sustainability."
        }
        action={filterBar}
      />

      {/* Super Admin: cross-org comparison */}
      {isSuper && comparison.data && (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <ChartCard
            title="Organization comparison"
            subtitle={`${comparison.data.totals.organizations} orgs · ${comparison.data.totals.activeUsers} active users · ${inr(comparison.data.totals.revenue * 100)} revenue`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Organization</th>
                    <th className="px-2 font-medium">Users</th>
                    <th className="px-2 font-medium">Vehicles</th>
                    <th className="px-2 font-medium">Trips</th>
                    <th className="px-2 font-medium">Occ.</th>
                    <th className="px-2 font-medium">CO₂</th>
                    <th className="px-2 text-right font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.data.organizations.map((o) => (
                    <tr key={o.id} className="border-t border-border">
                      <td className="py-2 pr-3 font-medium">
                        {o.name}
                        {o.status !== "ACTIVE" && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({o.status})
                          </span>
                        )}
                      </td>
                      <td className="tabular px-2">{o.activeUsers}</td>
                      <td className="tabular px-2">{o.vehicles}</td>
                      <td className="tabular px-2">{o.completedTrips}</td>
                      <td className="tabular px-2">{o.avgOccupancy}</td>
                      <td className="tabular px-2">{o.co2SavedKg}kg</td>
                      <td className="tabular px-2 text-right">
                        {inr(o.revenue * 100)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
          <ChartCard
            title="Trips by organization"
            subtitle="Completed trips per company"
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={comparison.data.organizations}
                  margin={{ left: -20, right: 8, top: 8 }}
                >
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
          </ChartCard>
        </div>
      )}

      {isSuper && (
        <p className="text-sm text-muted-foreground">
          Showing detailed analytics for{" "}
          <span className="font-medium text-foreground">
            {orgId
              ? (orgList.data?.find((o) => o.id === orgId)?.name ??
                "selected organization")
              : "your organization"}
          </span>{" "}
          — switch with the selector above.
        </p>
      )}

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Completed trips"
          value={k.totalTrips}
          sub={`${k.activeTrips} active · ${k.cancellationRate}% cancelled`}
          icon={RouteIcon}
        />
        <StatCard
          label="Revenue"
          value={inr(k.revenue * 100)}
          sub={`${inr(k.monthRevenue * 100)} this month`}
          icon={RupeeIcon}
          accent="info"
        />
        <StatCard
          label="Adoption"
          value={`${k.adoptionRate}%`}
          sub={`${k.activeEmployees} active employees`}
          icon={UsersIcon}
          accent="warning"
        />
        <StatCard
          label="Avg occupancy"
          value={k.avgOccupancy}
          sub="passengers / trip"
          icon={CarIcon}
        />
        <StatCard
          label="Distance shared"
          value={`${k.totalDistanceKm} km`}
          icon={RouteIcon}
          accent="info"
        />
        <StatCard
          label="CO₂ saved"
          value={`${k.co2SavedKg} kg`}
          sub={`${k.treesEquivalent} trees`}
          icon={EcoIcon}
          accent="eco"
        />
        <StatCard
          label="Fuel saved"
          value={`${k.fuelSavedL} L`}
          icon={FuelIcon}
          accent="warning"
        />
        <StatCard
          label="Vehicles"
          value={k.vehicles}
          sub={`${k.verifiedVehicles} verified`}
          icon={CarIcon}
        />
      </div>

      {/* Trips over time */}
      <ChartCard
        title="Trips per day"
        subtitle={
          range
            ? "Completed rides in the selected range"
            : "Completed rides over the last 30 days"
        }
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={d.tripsPerDay}
              margin={{ left: -20, right: 8, top: 8 }}
            >
              <defs>
                <linearGradient id="gTrips" x1="0" y1="0" x2="0" y2="1">
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
              <Tooltip content={<ChartTip />} labelFormatter={dayLabel} />
              <Area
                type="monotone"
                dataKey="trips"
                name="Trips"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#gTrips)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Three donuts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Trips by status">
          <Donut
            data={d.tripsByStatus.map((s) => ({
              name: s.status.replaceAll("_", " "),
              value: s.count,
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Payment methods"
          subtitle="Share of completed payments"
        >
          <Donut
            data={d.paymentMethods.map((m) => ({
              name: m.method,
              value: m.count,
            }))}
          />
        </ChartCard>
        <ChartCard title="Fleet mix" subtitle="Registered vehicle types">
          <Donut
            data={d.vehicleTypes.map((v) => ({ name: v.type, value: v.count }))}
          />
        </ChartCard>
      </div>

      {/* Peak hours + popular routes */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Peak departure hours"
          subtitle="When rides start (commute peaks)"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={d.peakHours}
                margin={{ left: -20, right: 8, top: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="hour"
                  tickFormatter={hourLabel}
                  tick={axis}
                  interval={1}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={axis}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={<ChartTip />}
                  labelFormatter={hourLabel}
                  cursor={{ fill: "var(--muted)" }}
                />
                <Bar
                  dataKey="count"
                  name="Rides"
                  fill="var(--chart-2)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Popular routes"
          subtitle="Most-travelled origin → destination"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={d.popularRoutes}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
              >
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={axis}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="route"
                  width={150}
                  tick={{ ...axis, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={<ChartTip />}
                  cursor={{ fill: "var(--muted)" }}
                />
                <Bar
                  dataKey="count"
                  name="Rides"
                  fill="var(--chart-3)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Revenue + CO2 composed */}
      <ChartCard
        title="Revenue & CO₂ savings"
        subtitle="Monthly revenue (₹) with CO₂ saved (kg)"
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={d.monthlyTrend}
              margin={{ left: -12, right: 8, top: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={axis}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="l"
                tick={axis}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="r"
                orientation="right"
                tick={axis}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={<ChartTip />}
                cursor={{ fill: "var(--muted)" }}
              />
              <Bar
                yAxisId="l"
                dataKey="revenue"
                name="Revenue ₹"
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
                barSize={40}
              />
              <Line
                yAxisId="r"
                type="monotone"
                dataKey="co2Kg"
                name="CO₂ kg"
                stroke="var(--chart-4)"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Top drivers + department adoption + green gauge */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Top drivers"
          subtitle="By completed trips"
          className="lg:col-span-1"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={d.topDrivers}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
              >
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={axis}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ ...axis, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={<ChartTip />}
                  cursor={{ fill: "var(--muted)" }}
                />
                <Bar
                  dataKey="trips"
                  name="Trips"
                  fill="var(--chart-1)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Department adoption"
          subtitle="Trips & headcount by team"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={d.departmentAdoption}
                margin={{ left: -20, right: 8, top: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="department"
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
                <Tooltip
                  content={<ChartTip />}
                  cursor={{ fill: "var(--muted)" }}
                />
                <Bar
                  dataKey="trips"
                  name="Trips"
                  fill="var(--chart-2)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="employees"
                  name="Employees"
                  fill="var(--chart-3)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Green score" subtitle="Overall sustainability index">
          <div className="relative h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="70%"
                outerRadius="100%"
                data={[
                  { name: "Green", value: greenScore, fill: "var(--chart-1)" },
                ]}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar
                  background={{ fill: "var(--muted)" }}
                  dataKey="value"
                  cornerRadius={12}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="tabular text-4xl font-semibold">
                {greenScore}
              </span>
              <span className="text-xs text-muted-foreground">/ 100</span>
              <span className="mt-2 flex items-center gap-1 text-xs text-primary">
                <TreesIcon className="size-3.5" /> {k.treesEquivalent} trees
                saved
              </span>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  )
}

function Donut({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((n, x) => n + x.value, 0)
  return (
    <div className="flex items-center gap-3">
      <div className="h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={44}
              outerRadius={64}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART[i % CHART.length]} />
              ))}
            </Pie>
            <Tooltip
              content={
                <ChartTip
                  fmt={(v: number) =>
                    `${v} (${total ? Math.round((v / total) * 100) : 0}%)`
                  }
                />
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
        {data.map((x, i) => (
          <li key={x.name} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ background: CHART[i % CHART.length] }}
              />
              <span className="truncate text-muted-foreground">{x.name}</span>
            </span>
            <span className="tabular font-medium">{x.value}</span>
          </li>
        ))}
        {data.length === 0 && (
          <li className="text-xs text-muted-foreground">No data yet.</li>
        )}
      </ul>
    </div>
  )
}
