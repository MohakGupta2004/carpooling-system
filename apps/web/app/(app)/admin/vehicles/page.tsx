"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import { api } from "@/lib/api"
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
import {
  CarIcon,
  ApproveIcon,
  IconX,
  EditIcon,
  TrashIcon,
  PlusIcon,
  VerifiedIcon,
} from "@/components/ui/icons"

interface Vehicle {
  id: string
  brand: string
  model: string
  registrationNo: string
  type: string
  fuelType: string
  seats: number
  color: string | null
  insuranceNo: string | null
  pucValidTill: string | null
  verification: string
  createdAt: string
  ownerId: string
  owner: { fullName: string; email: string }
  pendingChanges: Record<string, unknown> | null
}
interface Employee {
  id: string
  fullName: string
  email: string
}

const TYPES = ["CAR", "BIKE", "EV"]
const FUELS = ["PETROL", "DIESEL", "CNG", "ELECTRIC", "HYBRID"]
const EMPTY = {
  ownerId: "",
  type: "CAR",
  brand: "",
  model: "",
  registrationNo: "",
  color: "",
  fuelType: "PETROL",
  seats: 4,
  insuranceNo: "",
  pucValidTill: "",
}

const FIELD_LABELS: Record<string, string> = {
  type: "Type",
  brand: "Brand",
  model: "Model",
  registrationNo: "Registration",
  color: "Colour",
  fuelType: "Fuel",
  seats: "Seats",
  insuranceNo: "Insurance",
  pucValidTill: "PUC valid till",
}
const initials = (n: string) =>
  n
    .split(" ")
    .map((x) => x[0])
    .join("")
    .toUpperCase()
const fmt = (v: unknown) =>
  v == null || v === ""
    ? "—"
    : String(v).includes("T") && String(v).length > 10
      ? String(v).slice(0, 10)
      : String(v)

export default function AdminVehiclesPage() {
  const qc = useQueryClient()
  const vehicles = useQuery({
    queryKey: ["admin", "vehicles"],
    queryFn: () => api.get<Vehicle[]>("/admin/vehicles"),
  })
  const employees = useQuery({
    queryKey: ["admin", "employees"],
    queryFn: () => api.get<Employee[]>("/admin/employees"),
  })

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY)

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "vehicles"] })
    qc.invalidateQueries({ queryKey: ["vehicles"] })
  }
  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY)
  }

  const verify = useMutation({
    mutationFn: ({
      id,
      decision,
    }: {
      id: string
      decision: "VERIFIED" | "REJECTED"
    }) => api.post(`/admin/vehicles/${id}/verify`, { decision }),
    onSuccess: () => {
      toast.success("Updated")
      refresh()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  })
  const del = useMutation({
    mutationFn: (id: string) => api.del(`/admin/vehicles/${id}`),
    onSuccess: () => {
      toast.success("Vehicle removed")
      refresh()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  })
  const reviewChanges = useMutation({
    mutationFn: ({
      id,
      decision,
    }: {
      id: string
      decision: "APPROVE" | "REJECT"
    }) => api.post(`/admin/vehicles/${id}/review-changes`, { decision }),
    onSuccess: (_d, v) => {
      toast.success(
        v.decision === "APPROVE" ? "Changes applied" : "Changes discarded"
      )
      refresh()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  })
  const saveVehicle = useMutation({
    mutationFn: () => {
      const payload = {
        type: form.type,
        brand: form.brand.trim(),
        model: form.model.trim(),
        registrationNo: form.registrationNo.trim(),
        color: form.color || undefined,
        fuelType: form.fuelType,
        seats: Number(form.seats),
        insuranceNo: form.insuranceNo || undefined,
        ...(form.pucValidTill
          ? { pucValidTill: new Date(form.pucValidTill).toISOString() }
          : {}),
      }
      return editingId
        ? api.patch(`/admin/vehicles/${editingId}`, payload)
        : api.post("/admin/vehicles", { ...payload, ownerId: form.ownerId })
    },
    onSuccess: () => {
      toast.success(editingId ? "Vehicle updated" : "Vehicle added")
      closeForm()
      refresh()
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Failed to save"),
  })

  const startEdit = (v: Vehicle) => {
    setEditingId(v.id)
    setForm({
      ownerId: v.ownerId,
      type: v.type,
      brand: v.brand,
      model: v.model,
      registrationNo: v.registrationNo,
      color: v.color ?? "",
      fuelType: v.fuelType,
      seats: v.seats,
      insuranceNo: v.insuranceNo ?? "",
      pucValidTill: v.pucValidTill ? v.pucValidTill.slice(0, 10) : "",
    })
    setShowForm(true)
  }

  const valid =
    form.brand.trim() &&
    form.model.trim() &&
    form.registrationNo.trim().length >= 3 &&
    (editingId || form.ownerId)
  const list = vehicles.data ?? []
  const pendingReviews = list.filter((v) => v.pendingChanges).length
  const unverified = list.filter((v) => v.verification === "PENDING").length

  return (
    <div>
      <PageHeader
        title="Vehicle Management"
        description="Every vehicle registered in your organization — add, edit, verify, and review owner changes."
        action={
          <Button
            size="sm"
            onClick={() =>
              showForm
                ? closeForm()
                : (setEditingId(null), setForm(EMPTY), setShowForm(true))
            }
          >
            {showForm ? (
              "Close"
            ) : (
              <>
                <PlusIcon /> Add vehicle
              </>
            )}
          </Button>
        }
      />

      {/* Summary */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Total vehicles" value={list.length} />
        <Stat
          label="Awaiting verification"
          value={unverified}
          tone={unverified ? "warning" : undefined}
        />
        <Stat
          label="Edits to review"
          value={pendingReviews}
          tone={pendingReviews ? "info" : undefined}
        />
      </div>

      {/* Add / edit form */}
      {showForm && (
        <Card className="mb-6 border-primary/30">
          <CardContent className="p-6">
            <p className="mb-4 text-sm font-semibold">
              {editingId ? "Edit vehicle" : "Add a vehicle"}
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-3">
                <Label>Owner</Label>
                {editingId ? (
                  <Input
                    value={
                      list.find((v) => v.id === editingId)?.owner.fullName ?? ""
                    }
                    disabled
                  />
                ) : (
                  <Dropdown
                    value={form.ownerId}
                    onChange={(v) => setForm({ ...form, ownerId: v })}
                    options={[
                      ["", "Select an employee"],
                      ...(employees.data ?? []).map(
                        (e) =>
                          [e.id, `${e.fullName} · ${e.email}`] as [
                            string,
                            string,
                          ]
                      ),
                    ]}
                  />
                )}
              </div>
              <Field label="Type">
                <Dropdown
                  value={form.type}
                  onChange={(v) => setForm({ ...form, type: v })}
                  options={TYPES.map((t) => [t, t])}
                />
              </Field>
              <Field label="Brand">
                <Input
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  placeholder="Toyota"
                />
              </Field>
              <Field label="Model">
                <Input
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="Innova"
                />
              </Field>
              <Field label="Registration no.">
                <Input
                  value={form.registrationNo}
                  onChange={(e) =>
                    setForm({ ...form, registrationNo: e.target.value })
                  }
                  placeholder="GJ01AB1234"
                />
              </Field>
              <Field label="Fuel type">
                <Dropdown
                  value={form.fuelType}
                  onChange={(v) => setForm({ ...form, fuelType: v })}
                  options={FUELS.map((f) => [f, f])}
                />
              </Field>
              <Field label="Seats">
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={form.seats}
                  onChange={(e) =>
                    setForm({ ...form, seats: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Colour">
                <Input
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  placeholder="White"
                />
              </Field>
              <Field label="Insurance no.">
                <Input
                  value={form.insuranceNo}
                  onChange={(e) =>
                    setForm({ ...form, insuranceNo: e.target.value })
                  }
                />
              </Field>
              <Field label="PUC valid till">
                <Input
                  type="date"
                  value={form.pucValidTill}
                  onChange={(e) =>
                    setForm({ ...form, pucValidTill: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="mt-5 flex gap-2">
              <Button
                onClick={() => saveVehicle.mutate()}
                disabled={!valid || saveVehicle.isPending}
              >
                {saveVehicle.isPending
                  ? "Saving…"
                  : editingId
                    ? "Save changes"
                    : "Add vehicle"}
              </Button>
              <Button variant="ghost" onClick={closeForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vehicle cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((v) => (
          <Card
            key={v.id}
            className={v.pendingChanges ? "border-[var(--info)]/40" : ""}
          >
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
                    <CarIcon className="size-6" />
                  </span>
                  <div>
                    <p className="leading-tight font-semibold">
                      {v.brand} {v.model}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {v.registrationNo}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  {v.verification === "VERIFIED" ? (
                    <Badge variant="success">
                      <VerifiedIcon /> Verified
                    </Badge>
                  ) : v.verification === "REJECTED" ? (
                    <Badge variant="destructive">Rejected</Badge>
                  ) : (
                    <Badge variant="warning">Pending</Badge>
                  )}
                  {v.pendingChanges && (
                    <Badge variant="info">Edit to review</Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Avatar className="size-7">
                  <AvatarFallback className="text-[10px]">
                    {initials(v.owner.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {v.owner.fullName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {v.owner.email}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Chip>{v.type}</Chip>
                <Chip>{v.fuelType}</Chip>
                <Chip>{v.seats} seats</Chip>
                {v.color && <Chip>{v.color}</Chip>}
              </div>

              {v.pendingChanges && (
                <div className="rounded-lg border border-[var(--info)]/40 bg-accent/50 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold">
                    <EditIcon className="size-3.5" /> Owner requested these
                    edits
                  </p>
                  <div className="mt-2.5 space-y-1.5">
                    {Object.entries(v.pendingChanges)
                      .filter(
                        ([k, val]) =>
                          k in FIELD_LABELS &&
                          fmt(val) !==
                            fmt((v as unknown as Record<string, unknown>)[k])
                      )
                      .map(([k, val]) => (
                        <div
                          key={k}
                          className="grid grid-cols-[84px_1fr] items-center gap-2 text-xs"
                        >
                          <span className="text-muted-foreground">
                            {FIELD_LABELS[k]}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground line-through">
                              {fmt(
                                (v as unknown as Record<string, unknown>)[k]
                              )}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="rounded bg-[var(--success)]/15 px-1.5 py-0.5 font-medium">
                              {fmt(val)}
                            </span>
                          </span>
                        </div>
                      ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        reviewChanges.mutate({ id: v.id, decision: "APPROVE" })
                      }
                      disabled={reviewChanges.isPending}
                    >
                      <ApproveIcon /> Apply
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        reviewChanges.mutate({ id: v.id, decision: "REJECT" })
                      }
                      disabled={reviewChanges.isPending}
                    >
                      <IconX /> Discard
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                {v.verification !== "VERIFIED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      verify.mutate({ id: v.id, decision: "VERIFIED" })
                    }
                  >
                    <ApproveIcon /> Verify
                  </Button>
                )}
                {v.verification !== "REJECTED" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      verify.mutate({ id: v.id, decision: "REJECTED" })
                    }
                  >
                    <IconX /> Reject
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => startEdit(v)}>
                  <EditIcon /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm(`Remove ${v.brand} ${v.model}?`))
                      del.mutate(v.id)
                  }}
                >
                  <TrashIcon /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!vehicles.isLoading && list.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No vehicles registered yet. Use “Add vehicle” to register one.
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: "warning" | "info"
}) {
  const color =
    tone === "warning"
      ? "text-[var(--warning-foreground)]"
      : tone === "info"
        ? "text-[var(--info)]"
        : "text-foreground"
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`tabular text-2xl font-semibold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      {children}
    </span>
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
    <Select value={value} onValueChange={onChange}>
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
