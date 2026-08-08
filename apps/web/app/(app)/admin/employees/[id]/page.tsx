"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { inr } from "@/lib/utils"
import { PageHeader } from "@repo/ui/page-header"
import { StatCard } from "@repo/ui/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card"
import { Button } from "@repo/ui/button"
import { Badge } from "@repo/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/avatar"
import { Skeleton } from "@repo/ui/skeleton"
import {
  CarIcon,
  RouteIcon,
  DriveIcon,
  EcoIcon,
  WalletIcon,
  VerifiedIcon,
} from "@repo/ui/icons"

interface Vehicle {
  id: string
  type: string
  brand: string
  model: string
  registrationNo: string
  licenseNo: string
  isAc: boolean | null
  color: string | null
  fuelType: string
  seats: number
  verification: string
  insuranceNo: string | null
  pucValidTill: string | null
  pendingChanges: Record<string, unknown> | null
  createdAt: string
}
interface EmployeeDetail {
  id: string
  fullName: string
  email: string
  phone: string | null
  gender: string | null
  status: string
  emailVerified: boolean
  employeeCode: string | null
  homeAddress: string | null
  photoUrl: string | null
  ecoPoints: number
  rating: string
  createdAt: string
  department: { name: string } | null
  roles: { role: { key: string; name: string } }[]
  vehicles: Vehicle[]
  stats: {
    ridesOffered: number
    completedAsDriver: number
    completedAsPassenger: number
    distanceKm: number
    co2SavedKg: number
    walletBalance: number
  }
}

const initials = (n: string) =>
  n
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0] ?? "")
    .join("")
    .toUpperCase()
const vBadge = (v: string): "eco" | "destructive" | "warning" =>
  v === "VERIFIED" ? "eco" : v === "REJECTED" ? "destructive" : "warning"

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const q = useQuery({
    queryKey: ["employee", id],
    queryFn: () => api.get<EmployeeDetail>(`/admin/employees/${id}`),
    enabled: !!id,
  })

  if (q.isError)
    return (
      <Card>
        <CardContent className="space-y-3 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {q.error instanceof Error
              ? q.error.message
              : "Could not load this employee."}
          </p>
          <div className="flex justify-center gap-2">
            <Button size="sm" variant="outline" onClick={() => q.refetch()}>
              Retry
            </Button>
            <Button
              size="sm"
              variant="ghost"
              nativeButton={false}
              render={<Link href="/admin/employees" />}
            >
              Back to employees
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  if (q.isLoading || !q.data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    )
  const e = q.data
  const s = e.stats
  const rating = Number(e.rating)

  return (
    <div className="space-y-6">
      <PageHeader
        title={e.fullName}
        description={e.roles.map((r) => r.role.name).join(", ") || "Employee"}
        action={
          <div className="flex items-center gap-2">
            <Badge
              variant={
                e.status === "ACTIVE"
                  ? "eco"
                  : e.status === "PENDING"
                    ? "warning"
                    : "destructive"
              }
            >
              {e.status}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href="/admin/employees" />}
            >
              Back
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Profile */}
        <Card className="h-fit">
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="size-20">
                <AvatarImage src={e.photoUrl || undefined} />
                <AvatarFallback className="text-xl">
                  {initials(e.fullName)}
                </AvatarFallback>
              </Avatar>
              <p className="mt-3 text-lg font-semibold">{e.fullName}</p>
              <p className="text-sm text-muted-foreground">
                {e.email}
                {e.emailVerified && " ✓"}
              </p>
            </div>
            <div className="space-y-2 border-t border-border pt-4 text-sm">
              <Row label="Employee code" value={e.employeeCode ?? "—"} />
              <Row label="Department" value={e.department?.name ?? "—"} />
              <Row label="Phone" value={e.phone ?? "—"} />
              <Row label="Gender" value={e.gender ?? "—"} />
              <Row label="Home" value={e.homeAddress ?? "—"} />
              <Row
                label="Rating"
                value={Number.isFinite(rating) ? `${rating.toFixed(1)} ★` : "—"}
              />
              <Row label="Eco points" value={`${e.ecoPoints} 🍃`} />
              <Row
                label="Member since"
                value={new Date(e.createdAt).toLocaleDateString()}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Activity stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Rides offered"
              value={s.ridesOffered}
              icon={DriveIcon}
            />
            <StatCard
              label="Completed (driver)"
              value={s.completedAsDriver}
              icon={RouteIcon}
              accent="info"
            />
            <StatCard
              label="Completed (passenger)"
              value={s.completedAsPassenger}
              icon={RouteIcon}
            />
            <StatCard
              label="Distance driven"
              value={`${s.distanceKm} km`}
              icon={DriveIcon}
              accent="info"
            />
            <StatCard
              label="CO₂ saved"
              value={`${s.co2SavedKg} kg`}
              icon={EcoIcon}
              accent="eco"
            />
            <StatCard
              label="Wallet"
              value={inr(s.walletBalance)}
              icon={WalletIcon}
              accent="warning"
            />
          </div>

          {/* Vehicles */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CarIcon className="size-4 text-primary" /> Vehicles (
                {e.vehicles.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {e.vehicles.map((v) => (
                <div key={v.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {v.brand} {v.model}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {v.registrationNo}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={vBadge(v.verification)} className="gap-1">
                        {v.verification === "VERIFIED" && (
                          <VerifiedIcon className="size-3" />
                        )}
                        {v.verification}
                      </Badge>
                      {v.pendingChanges && (
                        <Badge variant="info">Edit pending</Badge>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <Detail k="Type" v={v.type} />
                    <Detail k="Fuel" v={v.fuelType} />
                    <Detail k="Seats" v={String(v.seats)} />
                    <Detail
                      k="AC"
                      v={v.type === "BIKE" ? "—" : v.isAc ? "AC" : "Non-AC"}
                    />
                    <Detail k="Colour" v={v.color ?? "—"} />
                    <Detail k="License" v={v.licenseNo} />
                    <Detail k="Insurance" v={v.insuranceNo ?? "—"} />
                    <Detail
                      k="PUC till"
                      v={
                        v.pucValidTill
                          ? new Date(v.pucValidTill).toLocaleDateString()
                          : "—"
                      }
                    />
                  </div>
                </div>
              ))}
              {e.vehicles.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No vehicles registered.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  )
}
function Detail({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="truncate font-medium">{v}</span>
    </div>
  )
}
