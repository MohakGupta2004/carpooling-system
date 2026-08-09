"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import { api } from "@/lib/api"
import { useAuth } from "@/stores/auth"
import { PageHeader } from "@repo/ui/page-header"
import { Card, CardContent } from "@repo/ui/card"
import { Button } from "@repo/ui/button"
import { Badge } from "@repo/ui/badge"
import { Input } from "@repo/ui/input"
import { Label } from "@repo/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select"
import { ListSkeleton } from "@repo/ui/page-skeleton"
import { ApproveIcon } from "@repo/ui/icons"

interface Employee {
  id: string
  fullName: string
  email: string
  status: string
  photoUrl: string | null
  department: { name: string } | null
  roles: { role: { name: string } }[]
}

interface Department {
  id: string
  name: string
}

const initials = (n: string) =>
  n
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0] ?? "")
    .join("")
    .toUpperCase()

const ROLE_ITEMS = [
  { value: "EMPLOYEE", label: "Employee" },
  { value: "COMPANY_ADMIN", label: "Company Admin" },
]

const EMPTY = {
  fullName: "",
  email: "",
  password: "",
  role: "EMPLOYEE" as "EMPLOYEE" | "COMPANY_ADMIN",
  departmentId: "",
}

const PASSWORD_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%"
function generatePassword(length = 12) {
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(
    bytes,
    (n) => PASSWORD_CHARS[n % PASSWORD_CHARS.length]
  ).join("")
}

export default function EmployeesPage() {
  const qc = useQueryClient()
  const canCreate = useAuth((s) => s.permissions.has("user:create"))
  const isSuperAdmin = useAuth(
    (s) => s.user?.roles?.some((r) => r.key === "SUPER_ADMIN") ?? false
  )
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [passwordMode, setPasswordMode] = useState<"manual" | "generate">(
    "manual"
  )
  // Super Admins have no company of their own — they pick which one they are
  // looking at, and every read/write below is scoped to that choice. Company
  // Admins never send `orgId`, so the API pins them to their own organization.
  const [orgId, setOrgId] = useState<string>("")
  const orgQuery = orgId ? `?orgId=${encodeURIComponent(orgId)}` : ""

  const orgList = useQuery({
    queryKey: ["orgs-lite"],
    queryFn: () =>
      api.get<{ id: string; name: string }[]>("/admin/organizations"),
    enabled: isSuperAdmin,
  })
  const orgOptions = [
    { value: "__self", label: "My organization" },
    ...(orgList.data ?? []).map((o) => ({ value: o.id, label: o.name })),
  ]

  const employees = useQuery({
    queryKey: ["employees", orgId || "self"],
    queryFn: () => api.get<Employee[]>(`/admin/employees${orgQuery}`),
  })
  const company = useQuery({
    queryKey: ["company-departments", orgId || "self"],
    // Departments belong to the company being edited; a Super Admin working
    // inside another company gets that company's list.
    queryFn: () =>
      orgId
        ? api
            .get<{ departments: Department[] }>(`/admin/organizations/${orgId}`)
            .then((o) => ({ departments: o.departments }))
        : api.get<{ departments: Department[] }>("/companies/me"),
    enabled: canCreate,
  })

  const act = useMutation({
    mutationFn: ({ id, verb }: { id: string; verb: "approve" | "suspend" }) =>
      api.post(`/admin/employees/${id}/${verb}${orgQuery}`),
    onSuccess: () => {
      toast.success("Updated")
      qc.invalidateQueries({ queryKey: ["employees"] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  })

  const createUser = useMutation({
    mutationFn: () =>
      api.post<{ emailSent: boolean }>(`/admin/users${orgQuery}`, {
        ...form,
        departmentId: form.departmentId || undefined,
      }),
    onSuccess: (res) => {
      const who = form.role === "COMPANY_ADMIN" ? "Company Admin" : "Employee"
      if (res.emailSent) {
        toast.success(
          `${who} created and login credentials emailed successfully`
        )
      } else {
        toast.success(
          `${who} created, but the credentials email could not be sent — share the password manually`
        )
      }
      setForm(EMPTY)
      setShowForm(false)
      setPasswordMode("manual")
      qc.invalidateQueries({ queryKey: ["employees"] })
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Failed to create"),
  })

  const formValid =
    form.fullName.trim().length >= 2 &&
    /.+@.+\..+/.test(form.email) &&
    form.password.length >= 8 &&
    form.password.length <= 128

  const departmentItems = [
    { value: "none", label: "No department" },
    ...(company.data?.departments ?? []).map((d) => ({
      value: d.id,
      label: d.name,
    })),
  ]
  const list = employees.data ?? []

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Approve, suspend, and review your organization's members."
        action={
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <Select
                items={orgOptions}
                value={orgId || "__self"}
                onValueChange={(v) => setOrgId(!v || v === "__self" ? "" : v)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {orgOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {canCreate && (
              <Button size="sm" onClick={() => setShowForm((v) => !v)}>
                {showForm ? "Close" : "Add account"}
              </Button>
            )}
          </div>
        }
      />

      {canCreate && showForm && (
        <Card className="mb-4">
          <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Full name</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Ankit Desai"
              />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@odoo.com"
              />
            </div>
            <div className="space-y-1">
              <Label>Temporary password</Label>
              <div className="flex gap-3 pb-1 text-xs">
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={passwordMode === "manual"}
                    onChange={() => {
                      setPasswordMode("manual")
                      setForm({ ...form, password: "" })
                    }}
                  />
                  Type manually
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={passwordMode === "generate"}
                    onChange={() => {
                      setPasswordMode("generate")
                      setForm({ ...form, password: generatePassword() })
                    }}
                  />
                  Generate randomly
                </label>
              </div>
              {passwordMode === "manual" ? (
                <Input
                  type="text"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder="min 8 characters"
                />
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="text"
                    readOnly
                    value={form.password}
                    placeholder="Click generate"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setForm({ ...form, password: generatePassword() })
                    }
                  >
                    Generate
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select
                items={ROLE_ITEMS}
                value={form.role}
                onValueChange={(v) =>
                  v && setForm({ ...form, role: v as typeof form.role })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  {isSuperAdmin && (
                    <SelectItem value="COMPANY_ADMIN">Company Admin</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Department (optional)</Label>
              <Select
                items={departmentItems}
                value={form.departmentId || "none"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    departmentId: !v || v === "none" ? "" : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {company.data?.departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Button
                onClick={() => createUser.mutate()}
                disabled={!formValid || createUser.isPending}
              >
                {createUser.isPending ? "Creating…" : "Create account"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {employees.isLoading ? (
        <Card>
          <CardContent className="p-5">
            <ListSkeleton rows={6} />
          </CardContent>
        </Card>
      ) : employees.isError ? (
        <Card>
          <CardContent className="space-y-3 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              {employees.error instanceof Error
                ? employees.error.message
                : "Could not load employees."}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => employees.refetch()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No employees yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {list.map((e) => (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={e.photoUrl || undefined} />
                      <AvatarFallback>{initials(e.fullName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{e.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.email} · {e.department?.name ?? "—"} ·{" "}
                        {e.roles[0]?.role.name ?? "—"}
                      </p>
                    </div>
                  </div>
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
                      render={
                        <Link href={`/admin/employees/${e.id}${orgQuery}`} />
                      }
                    >
                      View details
                    </Button>
                    {e.status !== "ACTIVE" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={act.isPending}
                        onClick={() =>
                          act.mutate({ id: e.id, verb: "approve" })
                        }
                      >
                        <ApproveIcon /> Approve
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-warning hover:bg-warning/10 hover:text-warning"
                        disabled={act.isPending}
                        onClick={() =>
                          act.mutate({ id: e.id, verb: "suspend" })
                        }
                      >
                        Suspend
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
