"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Skeleton } from "@repo/ui/skeleton"

import { EmptyState } from "./ui"
import type { OrgSummary, TripsPerDay } from "./types"

/**
 * The two charts of the dashboard, plus the pieces they share.
 * Each chart takes its data and its loading flag, and handles the
 * loading / empty / chart states itself so pages stay short.
 */

/** Same tick styling on every axis. */
const tickStyle = { fontSize: 11, fill: "var(--muted-foreground)" }

/** Axis props we never vary — spread onto <XAxis> and <YAxis>. */
const axisProps = { tick: tickStyle, tickLine: false, axisLine: false } as const

/** Grid props we never vary. */
const gridProps = {
  strokeDasharray: "3 3",
  stroke: "var(--border)",
  vertical: false,
} as const

/** "2026-08-08" → "8 Aug". Returns "" for anything unparseable. */
function toDayLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString([], { day: "numeric", month: "short" })
}

/** Keeps long organization names from crowding the x-axis. */
function shorten(text: string, max = 12) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

interface TooltipEntry {
  name?: string | number
  value?: string | number
  color?: string
  fill?: string
}

/** The little popup that follows the cursor across a chart. */
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      {label !== undefined && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color ?? entry.fill }}>
          {entry.name}: <span className="font-semibold">{entry.value}</span>
        </p>
      ))}
    </div>
  )
}

/** Gives every chart the same height and the same loading / empty states. */
function ChartFrame({
  loading,
  empty,
  emptyText,
  height = "h-64",
  children,
}: {
  loading?: boolean
  empty?: boolean
  emptyText: string
  height?: string
  children: React.ReactElement
}) {
  if (loading) return <Skeleton className={`${height} w-full rounded-lg`} />
  if (empty)
    return (
      <div className={height}>
        <EmptyState>{emptyText}</EmptyState>
      </div>
    )
  return (
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

/** Completed trips per day, for the last 30 days. */
export function TripsPerDayChart({
  data,
  loading,
}: {
  data: TripsPerDay[]
  loading?: boolean
}) {
  return (
    <ChartFrame
      loading={loading}
      empty={data.length === 0}
      emptyText="No completed trips in the last 30 days."
    >
      <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="tripsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--eco)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--eco)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis
          dataKey="date"
          tickFormatter={toDayLabel}
          interval={4}
          {...axisProps}
        />
        <YAxis allowDecimals={false} {...axisProps} />
        <Tooltip
          content={<ChartTooltip />}
          labelFormatter={(value) => toDayLabel(String(value))}
        />
        <Area
          type="monotone"
          dataKey="trips"
          name="Trips"
          stroke="var(--eco)"
          fill="url(#tripsFill)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartFrame>
  )
}

/** Trips and CO₂ saved, one pair of bars per organization. */
export function TripsByOrgChart({
  data,
  loading,
}: {
  data: OrgSummary[]
  loading?: boolean
}) {
  return (
    <ChartFrame
      loading={loading}
      empty={data.length === 0}
      emptyText="No organization data yet."
      height="h-72"
    >
      <BarChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <CartesianGrid {...gridProps} />
        <XAxis
          dataKey="name"
          tickFormatter={(value: string) => shorten(value)}
          {...axisProps}
        />
        <YAxis allowDecimals={false} {...axisProps} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
        <Bar
          dataKey="completedTrips"
          name="Trips"
          radius={[2, 2, 0, 0]}
          fill="var(--secondary)"
        />
        <Bar
          dataKey="co2SavedKg"
          name="CO₂ (kg)"
          radius={[2, 2, 0, 0]}
          fill="var(--eco)"
        />
      </BarChart>
    </ChartFrame>
  )
}
