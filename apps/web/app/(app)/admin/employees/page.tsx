"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import { api } from "@/lib/api"
import { useAuth } from "@/stores/auth"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ApproveIcon } from "@/components/ui/icons"

interface Employee {
  id: string
  fullName: string
  email: string
  status: string
  department: { name: string } | null
  roles: { role: { name: string } }[]
}

interface Department {
  id: string
  name: string
}

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

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => api.get<Employee[]>("/admin/employees"),
  })
  const company = useQuery({
    queryKey: ["company-departments"],
    queryFn: () => api.get<{ departments: Department[] }>("/companies/me"),
    enabled: canCreate,
  })

  const act = useMutation({
    mutationFn: ({ id, verb }: { id: string; verb: "approve" | "suspend" }) =>
      api.post(`/admin/employees/${id}/${verb}`),
    onSuccess: () => {
      toast.success("Updated")
      qc.invalidateQueries({ queryKey: ["employees"] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  })

  const createUser = useMutation({
    mutationFn: () =>
      api.post<{ emailSent: boolean }>("/admin/users", {
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
    form.password.length >= 8

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Approve, suspend, and review your organization's members."
        action={
          canCreate && (
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Close" : "Add account"}
            </Button>
          )
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
                value={form.role}
                onValueChange={(v) =>
                  setForm({ ...form, role: v as typeof form.role })
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
                value={form.departmentId || "none"}
                onValueChange={(v) =>
                  setForm({ ...form, departmentId: v === "none" ? "" : v })
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

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {employees.data?.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {e.fullName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{e.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.email} · {e.department?.name ?? "—"} ·{" "}
                      {e.roles[0]?.role.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      e.status === "ACTIVE"
                        ? "success"
                        : e.status === "PENDING"
                          ? "warning"
                          : "destructive"
                    }
                  >
                    {e.status}
                  </Badge>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/admin/employees/${e.id}`}>View details</Link>
                  </Button>
                  {e.status !== "ACTIVE" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => act.mutate({ id: e.id, verb: "approve" })}
                    >
                      <ApproveIcon /> Approve
                    </Button>
                  )}
                  {e.status === "ACTIVE" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                      onClick={() => act.mutate({ id: e.id, verb: "suspend" })}
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
    </div>
  )
}
