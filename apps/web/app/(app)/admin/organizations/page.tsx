"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import { api } from "@/lib/api"
import { PageHeader } from "@repo/ui/page-header"
import { Card, CardContent } from "@repo/ui/card"
import { Button } from "@repo/ui/button"
import { Badge } from "@repo/ui/badge"
import { Input } from "@repo/ui/input"
import { Label } from "@repo/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select"
import { CardGridSkeleton } from "@repo/ui/page-skeleton"
import {
  CompanyIcon,
  PlusIcon,
  EditIcon,
  UsersIcon,
  CarIcon,
  RouteIcon,
} from "@repo/ui/icons"

interface Org {
  id: string
  name: string
  slug: string
  domain: string | null
  status: string
  createdAt: string
  counts: {
    users: number
    departments: number
    vehicles: number
    rides: number
  }
}
const NEW = {
  name: "",
  slug: "",
  domain: "",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
}
const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

export default function OrganizationsPage() {
  const qc = useQueryClient()
  const orgs = useQuery({
    queryKey: ["orgs"],
    queryFn: () => api.get<Org[]>("/admin/organizations"),
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ["orgs"] })

  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(NEW)
  const [editId, setEditId] = useState<string | null>(null)
  const [edit, setEdit] = useState({ name: "", domain: "", status: "ACTIVE" })

  const create = useMutation({
    mutationFn: () => api.post("/admin/organizations", form),
    onSuccess: () => {
      toast.success("Organization created with its Company Admin")
      setForm(NEW)
      setCreating(false)
      refresh()
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Failed to create"),
  })
  const update = useMutation({
    mutationFn: (v: { id: string; data: Record<string, unknown> }) =>
      api.patch(`/admin/organizations/${v.id}`, v.data),
    onSuccess: () => {
      toast.success("Updated")
      setEditId(null)
      refresh()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  })
  const archive = useMutation({
    mutationFn: (id: string) => api.del(`/admin/organizations/${id}`),
    onSuccess: () => {
      toast.success("Organization archived")
      refresh()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  })

  const startEdit = (o: Org) => {
    setEditId(o.id)
    setEdit({ name: o.name, domain: o.domain ?? "", status: o.status })
  }
  const saveEdit = (id: string) => {
    const domain = edit.domain.trim()
    update.mutate({
      id,
      data: {
        name: edit.name.trim(),
        status: edit.status,
        // The API rejects a blank domain (min 3 chars) — omit it instead.
        ...(domain ? { domain } : {}),
      },
    })
  }
  // Mirrors createOrgSchema on the API so a submit can't bounce back as a 400.
  const validNew =
    form.name.trim().length >= 2 &&
    /^[a-z0-9-]{2,60}$/.test(form.slug) &&
    form.domain.trim().length >= 3 &&
    form.adminName.trim().length >= 2 &&
    /.+@.+\..+/.test(form.adminEmail) &&
    form.adminPassword.length >= 8 &&
    form.adminPassword.length <= 128
  const validEdit = edit.name.trim().length >= 2
  const list = orgs.data ?? []

  return (
    <div>
      <PageHeader
        title="Organizations"
        description="Create and manage every company on the platform."
        action={
          <Button size="sm" onClick={() => setCreating((v) => !v)}>
            {creating ? (
              "Close"
            ) : (
              <>
                <PlusIcon /> Create organization
              </>
            )}
          </Button>
        }
      />

      {creating && (
        <Card className="mb-6 border-primary/30">
          <CardContent className="p-6">
            <p className="mb-4 text-sm font-semibold">New organization</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Company name">
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: e.target.value,
                      slug: form.slug || slugify(e.target.value),
                    })
                  }
                  placeholder="Acme Corp"
                />
              </Field>
              <Field label="Slug">
                <Input
                  value={form.slug}
                  onChange={(e) =>
                    setForm({ ...form, slug: slugify(e.target.value) })
                  }
                  placeholder="acme"
                />
              </Field>
              <Field label="Email domain">
                <Input
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  placeholder="acme.com"
                />
              </Field>
            </div>
            <p className="mt-6 mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              First Company Admin
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Admin name">
                <Input
                  value={form.adminName}
                  onChange={(e) =>
                    setForm({ ...form, adminName: e.target.value })
                  }
                  placeholder="Jane Admin"
                />
              </Field>
              <Field label="Admin email">
                <Input
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) =>
                    setForm({ ...form, adminEmail: e.target.value })
                  }
                  placeholder="jane@acme.com"
                />
              </Field>
              <Field label="Temp password">
                <Input
                  value={form.adminPassword}
                  onChange={(e) =>
                    setForm({ ...form, adminPassword: e.target.value })
                  }
                  placeholder="min 8 chars"
                />
              </Field>
            </div>
            <div className="mt-5">
              <Button
                onClick={() => create.mutate()}
                disabled={!validNew || create.isPending}
              >
                {create.isPending ? "Creating…" : "Create organization"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {orgs.isLoading && <CardGridSkeleton count={4} />}

      {orgs.isError && (
        <Card>
          <CardContent className="space-y-3 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              {orgs.error instanceof Error
                ? orgs.error.message
                : "Could not load organizations."}
            </p>
            <Button size="sm" variant="outline" onClick={() => orgs.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((o) => (
          <Card
            key={o.id}
            className={o.status === "SUSPENDED" ? "opacity-70" : ""}
          >
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
                    <CompanyIcon className="size-6" />
                  </span>
                  <div>
                    <p className="leading-tight font-semibold">{o.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.slug} · {o.domain ?? "—"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge variant={o.status === "ACTIVE" ? "eco" : "warning"}>
                    {o.status}
                  </Badge>
                </div>
              </div>

              {editId === o.id ? (
                <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Name">
                      <Input
                        value={edit.name}
                        onChange={(e) =>
                          setEdit({ ...edit, name: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Domain">
                      <Input
                        value={edit.domain}
                        onChange={(e) =>
                          setEdit({ ...edit, domain: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Status">
                      <Dropdown
                        value={edit.status}
                        onChange={(v) => setEdit({ ...edit, status: v })}
                        options={[
                          ["ACTIVE", "Active"],
                          ["SUSPENDED", "Suspended"],
                        ]}
                      />
                    </Field>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => saveEdit(o.id)}
                      disabled={!validEdit || update.isPending}
                    >
                      {update.isPending ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2 rounded-lg bg-muted/40 p-3 text-center">
                    <CountStat
                      icon={<UsersIcon className="size-4" />}
                      label="Users"
                      value={o.counts.users}
                    />
                    <CountStat
                      icon={<CarIcon className="size-4" />}
                      label="Vehicles"
                      value={o.counts.vehicles}
                    />
                    <CountStat
                      icon={<RouteIcon className="size-4" />}
                      label="Rides"
                      value={o.counts.rides}
                    />
                    <CountStat
                      icon={<CompanyIcon className="size-4" />}
                      label="Depts"
                      value={o.counts.departments}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      render={<Link href={`/admin/organizations/${o.id}`} />}
                    >
                      View details
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(o)}
                    >
                      <EditIcon /> Edit
                    </Button>
                    {o.status === "ACTIVE" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={archive.isPending}
                        onClick={() => {
                          if (
                            confirm(
                              `Archive ${o.name}? Its data is kept but the org is suspended.`
                            )
                          )
                            archive.mutate(o.id)
                        }}
                      >
                        Archive
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto"
                        disabled={update.isPending}
                        onClick={() =>
                          update.mutate({
                            id: o.id,
                            data: { status: "ACTIVE" },
                          })
                        }
                      >
                        Restore
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {!orgs.isLoading && !orgs.isError && list.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No organizations yet.
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
function CountStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div>
      <span className="mx-auto flex size-7 items-center justify-center rounded-md text-primary">
        {icon}
      </span>
      <p className="tabular text-lg font-semibold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}
function Dropdown({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: [string, string][]
}) {
  return (
    <Select
      items={options.map(([v, l]) => ({ value: v, label: l }))}
      value={value}
      onValueChange={(v) => v && onChange(v)}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
