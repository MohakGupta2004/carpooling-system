"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import { api } from "@/lib/api"
import { PageHeader } from "@repo/ui/page-header"
import { Card, CardContent } from "@repo/ui/card"
import { Button } from "@repo/ui/button"
import { Input } from "@repo/ui/input"
import { Label } from "@repo/ui/label"
import { Badge } from "@repo/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select"
import {
  CarIcon,
  PlusIcon,
  VerifiedIcon,
  EditIcon,
  TrashIcon,
} from "@repo/ui/icons"

interface Vehicle {
  id: string
  type: string
  brand: string
  model: string
  registrationNo: string
  licenseNo: string
  driverName: string
  isAc: boolean | null
  fuelType: string
  seats: number
  verification: string
  pendingChanges: Record<string, unknown> | null
}
type Form = {
  type: string
  brand: string
  model: string
  registrationNo: string
  licenseNo: string
  driverName: string
  isAc: boolean
  fuelType: string
  seats: number
}
const emptyForm: Form = {
  type: "CAR",
  brand: "",
  model: "",
  registrationNo: "",
  licenseNo: "",
  driverName: "",
  isAc: false,
  fuelType: "PETROL",
  seats: 4,
}

export default function VehiclesPage() {
  const qc = useQueryClient()
  const vehicles = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => api.get<Vehicle[]>("/vehicles"),
  })
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(emptyForm)

  const invalidate = () => qc.invalidateQueries({ queryKey: ["vehicles"] })
  const reset = () => {
    setOpen(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        seats: Number(form.seats),
        isAc: form.type === "BIKE" ? false : form.isAc,
      }
      return editingId
        ? api.patch(`/vehicles/${editingId}`, payload)
        : api.post("/vehicles", payload)
    },
    onSuccess: () => {
      toast.success(
        editingId
          ? "Changes submitted — sent to admin for review"
          : "Vehicle added — awaiting admin verification"
      )
      reset()
      invalidate()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/vehicles/${id}`),
    onSuccess: () => {
      toast.success("Vehicle removed")
      invalidate()
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not delete"),
  })

  function startEdit(v: Vehicle) {
    setEditingId(v.id)
    setForm({
      type: v.type,
      brand: v.brand,
      model: v.model,
      registrationNo: v.registrationNo,
      licenseNo: v.licenseNo,
      driverName: v.driverName,
      isAc: !!v.isAc,
      fuelType: v.fuelType,
      seats: v.seats,
    })
    setOpen(true)
  }
  function startAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setOpen((o) => (editingId ? true : !o))
  }

  return (
    <div>
      <PageHeader
        title="Vehicles"
        description="Register vehicles to offer rides. Only verified vehicles can publish."
        action={
          <Button onClick={startAdd}>
            <PlusIcon /> Add vehicle
          </Button>
        }
      />

      {open && (
        <Card className="mb-6">
          <CardContent className="p-5">
            {editingId && (
              <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Editing a verified vehicle sends your changes to the company
                admin for review. The vehicle keeps working with its current
                details until the admin approves.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
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
              <Field label="Registration">
                <Input
                  value={form.registrationNo}
                  onChange={(e) =>
                    setForm({ ...form, registrationNo: e.target.value })
                  }
                  placeholder="GJ01AB1234"
                />
              </Field>
              <Field label="License Number">
                <Input
                  value={form.licenseNo}
                  onChange={(e) =>
                    setForm({ ...form, licenseNo: e.target.value })
                  }
                  placeholder="DL Number"
                />
              </Field>
              <Field label="Driver Name">
                <Input
                  value={form.driverName}
                  onChange={(e) =>
                    setForm({ ...form, driverName: e.target.value })
                  }
                  placeholder="Driver's full name"
                />
              </Field>
              <Field label="Type">
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["CAR", "BIKE", "EV"].map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {form.type !== "BIKE" && (
                <Field label="AC">
                  <Select
                    value={form.isAc ? "AC" : "NON_AC"}
                    onValueChange={(v) =>
                      setForm({ ...form, isAc: v === "AC" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AC">AC</SelectItem>
                      <SelectItem value="NON_AC">Non-AC</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="Fuel">
                <Select
                  value={form.fuelType}
                  onValueChange={(v) => setForm({ ...form, fuelType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["PETROL", "DIESEL", "CNG", "ELECTRIC", "HYBRID"].map(
                      (o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Seats">
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={form.seats}
                  onChange={(e) => setForm({ ...form, seats: +e.target.value })}
                />
              </Field>
              <div className="flex gap-2 sm:col-span-3">
                <Button
                  onClick={() => save.mutate()}
                  disabled={
                    save.isPending ||
                    !form.brand ||
                    !form.registrationNo ||
                    !form.licenseNo ||
                    !form.driverName
                  }
                >
                  {editingId ? "Save changes" : "Save vehicle"}
                </Button>
                <Button variant="ghost" onClick={reset}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {vehicles.data?.map((v) => (
          <Card key={v.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
                  <CarIcon className="size-5" />
                </span>
                {v.verification === "VERIFIED" ? (
                  <Badge variant="success" className="gap-1">
                    <VerifiedIcon className="size-3" /> Verified
                  </Badge>
                ) : v.verification === "REJECTED" ? (
                  <Badge variant="destructive">Rejected</Badge>
                ) : (
                  <Badge variant="warning">Pending approval</Badge>
                )}
              </div>
              <p className="mt-3 font-medium">
                {v.brand} {v.model}
              </p>
              <p className="text-sm text-muted-foreground">
                {v.registrationNo}
              </p>
              <p className="text-xs text-muted-foreground">
                License: {v.licenseNo}
              </p>
              <p className="text-xs text-muted-foreground">
                Driver: {v.driverName}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {v.type} · {v.fuelType} · {v.seats} seats
                {v.type !== "BIKE" ? ` · ${v.isAc ? "AC" : "Non-AC"}` : ""}
              </p>
              {v.pendingChanges && (
                <p className="mt-2 rounded-md border border-[var(--info)]/30 bg-accent/60 px-2 py-1 text-xs text-foreground">
                  ✎ Your edits are awaiting admin review
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startEdit(v)}
                >
                  <EditIcon className="size-3.5" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (
                      confirm(
                        `Remove ${v.brand} ${v.model}? Past rides stay intact.`
                      )
                    )
                      remove.mutate(v.id)
                  }}
                  disabled={remove.isPending}
                >
                  <TrashIcon className="size-3.5" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {vehicles.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No vehicles yet.</p>
        )}
      </div>
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
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
