"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"
import { api } from "@/lib/api"
import { inr } from "@/lib/utils"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  RouteIcon,
  DriveIcon,
  FuelIcon,
  EcoIcon,
  RupeeIcon,
  StarFilledIcon,
  CarIcon,
  DownloadIcon,
} from "@/components/ui/icons"

interface MyReport {
  kpis: {
    totalTrips: number
    tripsAsDriver: number
    tripsAsPassenger: number
    distanceKm: number
    co2SavedKg: number
    fuelSavedL: number
    treesEquivalent: number
    spent: number
    earned: number
    ecoPoints: number
    rating: number
    costPerKm: number
  }
  monthly: { month: string; trips: number; co2Kg: number }[]
  roleSplit: { role: string; value: number }[]
  vehicleWise: { name: string; trips: number; distanceKm: number }[]
  recentTrips: {
    date: string
    route: string
    role: "Driver" | "Passenger"
    amount: number
    status: string
  }[]
}

const CHART = ["var(--chart-1)", "var(--chart-4)"]
const axis = { fontSize: 11, fill: "var(--muted-foreground)" }
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]
const monthLabel = (m: string) => {
  const [y, mo] = m.split("-")
  return `${MONTHS[Number(mo) - 1] ?? mo} ${(y ?? "").slice(2)}`
}

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

export default function ReportsPage() {
  const [exporting, setExporting] = useState(false)
  const r = useQuery({
    queryKey: ["report", "me"],
    queryFn: () => api.get<MyReport>("/reports/me"),
  })

  const exportPdf = async () => {
    setExporting(true)
    try {
      await api.download(
        "/reports/me/pdf",
        `ridebuddy-my-report-${new Date().toISOString().slice(0, 10)}.pdf`
      )
    } catch {
      toast.error("Could not generate your report")
    } finally {
      setExporting(false)
    }
  }

  const exportBtn = (
    <Button variant="outline" onClick={exportPdf} disabled={exporting}>
      <DownloadIcon /> {exporting ? "Preparing…" : "Export PDF"}
    </Button>
  )

  if (r.isLoading || !r.data) {
    return (
      <div>
        <PageHeader
          title="My Reports"
          description="Your travel activity and savings."
          action={exportBtn}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    )
  }
  const d = r.data
  const k = d.kpis

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Reports"
        description="Your travel activity, savings and impact."
        action={exportBtn}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total trips"
          value={k.totalTrips}
          sub={`${k.tripsAsDriver} driven · ${k.tripsAsPassenger} rode`}
          icon={RouteIcon}
        />
        <StatCard
          label="Distance driven"
          value={`${k.distanceKm} km`}
          icon={DriveIcon}
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
          label="Eco points"
          value={k.ecoPoints}
          icon={EcoIcon}
          accent="warning"
        />
        <StatCard
          label="Spent as rider"
          value={inr(k.spent * 100)}
          icon={RupeeIcon}
          accent="info"
        />
        <StatCard
          label="Earned as driver"
          value={inr(k.earned * 100)}
          icon={RupeeIcon}
        />
        <StatCard
          label="Fuel saved"
          value={`${k.fuelSavedL} L`}
          icon={FuelIcon}
          accent="warning"
        />
        <StatCard
          label="Rating"
          value={k.rating ? k.rating.toFixed(1) : "—"}
          icon={StarFilledIcon}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={d.monthly}
                  margin={{ left: -20, right: 8, top: 8 }}
                >
                  <defs>
                    <linearGradient id="gMy" x1="0" y1="0" x2="0" y2="1">
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
                    dataKey="month"
                    tickFormatter={monthLabel}
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
                  <Tooltip content={<ChartTip />} labelFormatter={monthLabel} />
                  <Area
                    type="monotone"
                    dataKey="trips"
                    name="Trips"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#gMy)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Driver vs passenger</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-40 w-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={d.roleSplit}
                      dataKey="value"
                      nameKey="role"
                      innerRadius={44}
                      outerRadius={64}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {d.roleSplit.map((_, i) => (
                        <Cell key={i} fill={CHART[i % CHART.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
                {d.roleSplit.map((x, i) => (
                  <li
                    key={x.role}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-sm"
                        style={{ background: CHART[i % CHART.length] }}
                      />
                      <span className="text-muted-foreground">{x.role}</span>
                    </span>
                    <span className="tabular font-medium">{x.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent trips</CardTitle>
        </CardHeader>
        <CardContent>
          {d.recentTrips.length === 0 ? (
            <p className="text-sm text-muted-foreground">No trips yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {d.recentTrips.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-16 shrink-0 text-xs text-muted-foreground">
                      {new Date(t.date).toLocaleDateString([], {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    <span className="truncate">{t.route}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge variant={t.role === "Driver" ? "info" : "secondary"}>
                      {t.role}
                    </Badge>
                    <span className="tabular w-16 text-right text-muted-foreground">
                      {t.role === "Passenger" ? inr(t.amount * 100) : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {d.vehicleWise.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CarIcon className="size-4 text-primary" /> Vehicle-wise usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {d.vehicleWise.map((v) => (
                <div
                  key={v.name}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span>{v.name}</span>
                  <span className="tabular text-muted-foreground">
                    {v.trips} trips · {v.distanceKm} km
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Cost per km ≈ {inr(k.costPerKm * 100)} (from company fuel rules)
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
