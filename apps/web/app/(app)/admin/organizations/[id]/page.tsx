"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { PageHeader } from "@repo/ui/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card"
import { Button } from "@repo/ui/button"
import { Badge } from "@repo/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/avatar"
import { Skeleton } from "@repo/ui/skeleton"
import {
  CompanyIcon,
  UsersIcon,
  CarIcon,
  RouteIcon,
  PhoneIcon,
} from "@repo/ui/icons"

interface OrgUser {
  id: string
  fullName: string
  email: string
  phone: string | null
  status: string
  photoUrl: string | null
  createdAt: string
  department: { name: string } | null
  roles: { role: { key: string; name: string } }[]
}
interface OrgDetail {
  id: string
  name: string
  slug: string
  domain: string | null
  logoUrl: string | null
  status: string
  createdAt: string
  departments: { id: string; name: string }[]
  officeLocations: { id: string; name: string; address: string }[]
  users: OrgUser[]
  counts: {
    users: number
    vehicles: number
    rides: number
    departments: number
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
const isAdminRole = (r: { role: { key: string } }) =>
  r.role.key === "COMPANY_ADMIN" || r.role.key === "SUPER_ADMIN"
const isAdmin = (u: OrgUser) => u.roles.some(isAdminRole)
const statusVariant = (s: string): "eco" | "warning" | "destructive" =>
  s === "ACTIVE" ? "eco" : s === "PENDING" ? "warning" : "destructive"

export default function OrgDetailPage() {
  const { id } = useParams<{ id: string }>()
  const q = useQuery({
    queryKey: ["org", id],
    queryFn: () => api.get<OrgDetail>(`/admin/organizations/${id}`),
    enabled: !!id,
  })

  if (q.isError) {
    return (
      <Card>
        <CardContent className="space-y-3 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {q.error instanceof Error
              ? q.error.message
              : "Could not load this organization."}
          </p>
          <div className="flex justify-center gap-2">
            <Button size="sm" variant="outline" onClick={() => q.refetch()}>
              Retry
            </Button>
            <Button
              size="sm"
              variant="ghost"
              nativeButton={false}
              render={<Link href="/admin/organizations" />}
            >
              Back to organizations
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }
  if (q.isLoading || !q.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    )
  }
  const o = q.data
  const admins = o.users.filter(isAdmin)
  const employees = o.users.filter((u) => !isAdmin(u))

  return (
    <div className="space-y-6">
      <PageHeader
        title={o.name}
        description={`${o.slug} · ${o.domain ?? "—"}`}
        action={
          <div className="flex items-center gap-2">
            <Badge variant={o.status === "ACTIVE" ? "eco" : "warning"}>
              {o.status}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href="/admin/organizations" />}
            >
              Back
            </Button>
          </div>
        }
      />

      {/* Profile + counts */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 p-6">
          <span className="flex size-16 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
            {o.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={o.logoUrl}
                alt={`${o.name} logo`}
                className="size-full object-contain"
              />
            ) : (
              <CompanyIcon className="size-7 text-muted-foreground" />
            )}
          </span>
          <Stat
            icon={<UsersIcon className="size-4" />}
            label="Users"
            value={o.counts.users}
          />
          <Stat
            icon={<CarIcon className="size-4" />}
            label="Vehicles"
            value={o.counts.vehicles}
          />
          <Stat
            icon={<RouteIcon className="size-4" />}
            label="Rides"
            value={o.counts.rides}
          />
          <Stat
            icon={<CompanyIcon className="size-4" />}
            label="Departments"
            value={o.counts.departments}
          />
          <div className="ml-auto text-right">
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="text-sm font-medium">
              {new Date(o.createdAt).toLocaleDateString()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Administrators */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Administrators ({admins.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {admins.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="flex items-center gap-3">
                <Avatar className="size-9">
                  <AvatarImage src={u.photoUrl || undefined} />
                  <AvatarFallback>{initials(u.fullName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{u.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.email}
                  </p>
                  {u.phone && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <PhoneIcon className="size-3" /> {u.phone}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant="secondary">
                  {u.roles.find(isAdminRole)?.role.name ?? "Admin"}
                </Badge>
                <Badge variant={statusVariant(u.status)}>{u.status}</Badge>
              </div>
            </div>
          ))}
          {admins.length === 0 && (
            <p className="text-sm text-muted-foreground">No administrators.</p>
          )}
        </CardContent>
      </Card>

      {/* Employees */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Employees ({employees.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Department</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          <AvatarImage src={u.photoUrl || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {initials(u.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{u.fullName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {u.email}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {u.department?.name ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {u.roles[0]?.role.name ?? "—"}
                    </td>
                    <td className="px-5 py-2.5">
                      <Badge variant={statusVariant(u.status)}>
                        {u.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-muted-foreground"
                    >
                      No employees yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Departments + offices */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Departments</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {o.departments.map((d) => (
              <Badge key={d.id} variant="secondary">
                {d.name}
              </Badge>
            ))}
            {o.departments.length === 0 && (
              <p className="text-sm text-muted-foreground">None.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Office locations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {o.officeLocations.map((l) => (
              <div key={l.id}>
                <p className="font-medium">{l.name}</p>
                <p className="text-muted-foreground">{l.address}</p>
              </div>
            ))}
            {o.officeLocations.length === 0 && (
              <p className="text-muted-foreground">None.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <div>
        <p className="tabular text-lg leading-none font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}
