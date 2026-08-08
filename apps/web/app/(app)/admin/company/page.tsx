"use client"

import { useRef, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import { api } from "@/lib/api"
import { PageHeader } from "@repo/ui/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card"
import { Badge } from "@repo/ui/badge"
import { Button } from "@repo/ui/button"
import { Input } from "@repo/ui/input"
import { Label } from "@repo/ui/label"
import { Switch } from "@repo/ui/switch"
import { Skeleton } from "@repo/ui/skeleton"
import { LocationPicker, type Place } from "@/components/maps/LocationPicker"
import { CompanyIcon, PlusIcon, IconX } from "@repo/ui/icons"

interface Company {
  name: string
  slug: string
  domain: string | null
  logoUrl: string | null
  fuelCostRules: {
    petrolPricePerL?: number
    dieselPricePerL?: number
    cngPricePerKg?: number
    evPricePerKwh?: number
  } | null
  travelAllowance: { perKm?: number } | null
  ridePolicies: {
    maxRideDistanceKm?: number
    womenOnlyAllowed?: boolean
    instantBookingAllowed?: boolean
  } | null
  departments: { id: string; name: string }[]
  officeLocations: {
    id: string
    name: string
    address: string
    lat: number
    lng: number
  }[]
}

export default function CompanyPage() {
  const qc = useQueryClient()
  const company = useQuery({
    queryKey: ["company"],
    queryFn: () => api.get<Company>("/companies/me"),
  })
  if (company.isLoading || !company.data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    )
  return <CompanyEditor c={company.data} />
}

function CompanyEditor({ c }: { c: Company }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const invalidate = () => qc.invalidateQueries({ queryKey: ["company"] })

  // form state seeded from the loaded config
  const [fuel, setFuel] = useState({
    petrolPricePerL: c.fuelCostRules?.petrolPricePerL ?? 105,
    dieselPricePerL: c.fuelCostRules?.dieselPricePerL ?? 92,
    cngPricePerKg: c.fuelCostRules?.cngPricePerKg ?? 78,
    evPricePerKwh: c.fuelCostRules?.evPricePerKwh ?? 9,
    perKm: c.travelAllowance?.perKm ?? 0,
  })
  const [policy, setPolicy] = useState({
    maxRideDistanceKm: c.ridePolicies?.maxRideDistanceKm ?? 60,
    womenOnlyAllowed: c.ridePolicies?.womenOnlyAllowed ?? true,
    instantBookingAllowed: c.ridePolicies?.instantBookingAllowed ?? true,
  })
  const [newDept, setNewDept] = useState("")
  const [officeName, setOfficeName] = useState("")
  const [officePlace, setOfficePlace] = useState<Place | null>(null)

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch("/companies/me", body),
    onSuccess: () => {
      toast.success("Saved")
      invalidate()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  })

  const uploadLogo = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append("file", file)
      return api.upload<{ logoUrl: string }>("/companies/me/logo", fd)
    },
    onSuccess: () => {
      toast.success("Logo updated")
      invalidate()
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Upload failed"),
  })

  const addDept = useMutation({
    mutationFn: (name: string) =>
      api.post("/companies/me/departments", { name }),
    onSuccess: () => {
      setNewDept("")
      invalidate()
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not add"),
  })
  const delDept = useMutation({
    mutationFn: (id: string) => api.del(`/companies/me/departments/${id}`),
    onSuccess: invalidate,
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not remove"),
  })

  const addOffice = useMutation({
    mutationFn: () =>
      api.post("/companies/me/offices", {
        name: officeName.trim(),
        address: officePlace!.address ?? officePlace!.label,
        lat: officePlace!.lat,
        lng: officePlace!.lng,
      }),
    onSuccess: () => {
      setOfficeName("")
      setOfficePlace(null)
      toast.success("Office added")
      invalidate()
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not add office"),
  })
  const delOffice = useMutation({
    mutationFn: (id: string) => api.del(`/companies/me/offices/${id}`),
    onSuccess: invalidate,
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not remove"),
  })

  const saveFuel = () =>
    patch.mutate({
      fuelCostRules: {
        petrolPricePerL: fuel.petrolPricePerL,
        dieselPricePerL: fuel.dieselPricePerL,
        cngPricePerKg: fuel.cngPricePerKg,
        evPricePerKwh: fuel.evPricePerKwh,
      },
      travelAllowance: { perKm: fuel.perKm },
    })
  const savePolicy = () => patch.mutate({ ridePolicies: policy })
  const officeValid = officeName.trim() && officePlace

  return (
    <div>
      <PageHeader
        title="Company"
        description="Organization configuration and operational rules."
      />

      {/* Logo */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Company logo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <span className="flex size-20 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary">
            {c.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.logoUrl}
                alt={`${c.name} logo`}
                className="size-full object-contain"
              />
            ) : (
              <CompanyIcon className="size-8 text-muted-foreground" />
            )}
          </span>
          <div>
            <p className="text-sm font-medium">{c.name}</p>
            <p className="mb-2 text-xs text-muted-foreground">
              PNG, JPG or SVG · up to 5 MB
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) uploadLogo.mutate(f)
                e.target.value = ""
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploadLogo.isPending}
            >
              {uploadLogo.isPending
                ? "Uploading…"
                : c.logoUrl
                  ? "Change logo"
                  : "Upload logo"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Fuel & travel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fuel & travel rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Num
                label="Petrol / L (₹)"
                value={fuel.petrolPricePerL}
                onChange={(v) => setFuel({ ...fuel, petrolPricePerL: v })}
              />
              <Num
                label="Diesel / L (₹)"
                value={fuel.dieselPricePerL}
                onChange={(v) => setFuel({ ...fuel, dieselPricePerL: v })}
              />
              <Num
                label="CNG / kg (₹)"
                value={fuel.cngPricePerKg}
                onChange={(v) => setFuel({ ...fuel, cngPricePerKg: v })}
              />
              <Num
                label="EV / kWh (₹)"
                value={fuel.evPricePerKwh}
                onChange={(v) => setFuel({ ...fuel, evPricePerKwh: v })}
              />
              <Num
                label="Travel allowance / km (₹)"
                value={fuel.perKm}
                onChange={(v) => setFuel({ ...fuel, perKm: v })}
              />
            </div>
            <Button size="sm" onClick={saveFuel} disabled={patch.isPending}>
              Save rules
            </Button>
          </CardContent>
        </Card>

        {/* Ride policies */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ride policies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Num
              label="Max ride distance (km)"
              value={policy.maxRideDistanceKm}
              onChange={(v) => setPolicy({ ...policy, maxRideDistanceKm: v })}
            />
            <div className="flex items-center justify-between pt-1">
              <Label>Women-only rides allowed</Label>
              <Switch
                checked={policy.womenOnlyAllowed}
                onCheckedChange={(v) =>
                  setPolicy({ ...policy, womenOnlyAllowed: v })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Instant booking allowed</Label>
              <Switch
                checked={policy.instantBookingAllowed}
                onCheckedChange={(v) =>
                  setPolicy({ ...policy, instantBookingAllowed: v })
                }
              />
            </div>
            <Button size="sm" onClick={savePolicy} disabled={patch.isPending}>
              Save policies
            </Button>
          </CardContent>
        </Card>

        {/* Departments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Departments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {c.departments.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No departments yet.
                </p>
              )}
              {c.departments.map((d) => (
                <Badge key={d.id} variant="secondary" className="gap-1 pr-1">
                  {d.name}
                  <button
                    onClick={() => delDept.mutate(d.id)}
                    className="rounded-full p-0.5 hover:bg-black/10"
                    aria-label={`Remove ${d.name}`}
                  >
                    <IconX className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                placeholder="New department name"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newDept.trim())
                    addDept.mutate(newDept.trim())
                }}
              />
              <Button
                size="sm"
                onClick={() => addDept.mutate(newDept.trim())}
                disabled={!newDept.trim() || addDept.isPending}
              >
                <PlusIcon /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Office locations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Office locations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {c.officeLocations.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No office locations yet.
                </p>
              )}
              {c.officeLocations.map((o) => (
                <div
                  key={o.id}
                  className="flex items-start justify-between gap-2 rounded-md border border-border p-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{o.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {o.address}
                    </p>
                  </div>
                  <button
                    onClick={() => delOffice.mutate(o.id)}
                    className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                    aria-label={`Remove ${o.name}`}
                  >
                    <IconX className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
              <Input
                value={officeName}
                onChange={(e) => setOfficeName(e.target.value)}
                placeholder="Office name (e.g. HQ, Ahmedabad)"
              />
              <LocationPicker
                value={officePlace}
                onChange={setOfficePlace}
                placeholder="Search the office address"
              />
              <Button
                size="sm"
                onClick={() => addOffice.mutate()}
                disabled={!officeValid || addOffice.isPending}
              >
                <PlusIcon /> Add office
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}
