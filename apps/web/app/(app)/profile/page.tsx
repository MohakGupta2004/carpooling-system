"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import { api } from "@/lib/api"
import { useAuth } from "@/stores/auth"
import { PageHeader } from "@repo/ui/page-header"
import { Card, CardContent } from "@repo/ui/card"
import { Button } from "@repo/ui/button"
import { Input } from "@repo/ui/input"
import { Label } from "@repo/ui/label"
import { Badge } from "@repo/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/avatar"
import {
  Select as UISelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select"
import { GroupLabel } from "@repo/ui/group-label"
import { LocationPicker, type Place } from "@/components/maps/location-picker"

interface Me {
  id: string
  fullName: string
  email: string
  phone: string | null
  gender: string | null
  photoUrl: string | null
  employeeCode: string | null
  ecoPoints: number
  rating: string
  status: string
  createdAt: string
  homeAddress: string | null
  homeLat: string | null
  homeLng: string | null
  emergencyName: string | null
  emergencyPhone: string | null
  department: { id: string; name: string } | null
  organization: { name: string; slug: string; domain: string } | null
  roles: { role: { key: string; name: string } }[]
  preferences: {
    pickupRadiusM?: number
    smokingAllowed?: boolean
    acPreference?: string
  } | null
}

const initials = (n?: string) =>
  n
    ? n
        .split(" ")
        .map((x) => x[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?"

export default function ProfilePage() {
  const me = useQuery({
    queryKey: ["me-profile"],
    queryFn: () => api.get<Me>("/users/me"),
  })

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    gender: "",
    photoUrl: "",
    employeeCode: "",
    emergencyName: "",
    emergencyPhone: "",
    acPreference: "ANY",
    smokingAllowed: false,
  })
  const [home, setHome] = useState<Place | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Populate the form once the profile loads.
  useEffect(() => {
    const d = me.data
    if (!d) return
    setForm({
      fullName: d.fullName ?? "",
      phone: d.phone ?? "",
      gender: d.gender ?? "",
      photoUrl: d.photoUrl ?? "",
      employeeCode: d.employeeCode ?? "",
      emergencyName: d.emergencyName ?? "",
      emergencyPhone: d.emergencyPhone ?? "",
      acPreference: d.preferences?.acPreference ?? "ANY",
      smokingAllowed: d.preferences?.smokingAllowed ?? false,
    })
    if (d.homeAddress && d.homeLat && d.homeLng) {
      setHome({ label: d.homeAddress, lat: +d.homeLat, lng: +d.homeLng })
    }
  }, [me.data])

  const save = useMutation({
    mutationFn: () =>
      api.patch("/users/me", {
        fullName: form.fullName,
        phone: form.phone || undefined,
        gender: form.gender || undefined,
        employeeCode: form.employeeCode || undefined,
        emergencyName: form.emergencyName || undefined,
        emergencyPhone: form.emergencyPhone || undefined,
        ...(home
          ? { homeAddress: home.label, homeLat: home.lat, homeLng: home.lng }
          : {}),
        preferences: {
          acPreference: form.acPreference,
          smokingAllowed: form.smokingAllowed,
        },
      }),
    onSuccess: () => {
      toast.success("Profile updated")
      // keep the header name in sync
      useAuth.setState((s) => ({
        user: s.user ? { ...s.user, fullName: form.fullName } : s.user,
      }))
      me.refetch()
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Failed to save"),
  })

  // Direct image upload → Cloudinary (server-side), returns the hosted URL.
  const uploadPhoto = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append("file", file)
      return api.upload<{ photoUrl: string }>("/users/me/photo", fd)
    },
    onSuccess: ({ photoUrl }) => {
      toast.success("Photo updated")
      setForm((f) => ({ ...f, photoUrl }))
      useAuth.setState((s) => ({
        user: s.user ? { ...s.user, photoUrl } : s.user,
      }))
      me.refetch()
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Upload failed"),
  })

  const d = me.data

  return (
    <div>
      <PageHeader
        title="My Profile"
        description="View your organization details and manage your personal information."
      />

      {!d ? (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground">
            Loading…
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          {/* Read-only account / org card */}
          <Card className="h-fit">
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-col items-center text-center">
                <Avatar className="size-20">
                  <AvatarImage
                    src={form.photoUrl || undefined}
                    alt={d.fullName}
                  />
                  <AvatarFallback className="text-xl">
                    {initials(d.fullName)}
                  </AvatarFallback>
                </Avatar>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) uploadPhoto.mutate(f)
                    e.target.value = ""
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadPhoto.isPending}
                >
                  {uploadPhoto.isPending ? "Uploading…" : "Change photo"}
                </Button>
                <p className="mt-3 text-lg font-semibold">{d.fullName}</p>
                <p className="text-sm text-muted-foreground">{d.email}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {d.roles.map((r) => (
                    <Badge key={r.role.key} variant="secondary">
                      {r.role.name}
                    </Badge>
                  ))}
                  <Badge variant={d.status === "ACTIVE" ? "eco" : "warning"}>
                    {d.status}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2 border-t border-border pt-4 text-sm">
                <Row label="Organization" value={d.organization?.name} />
                <Row label="Domain" value={d.organization?.domain} />
                <Row label="Department" value={d.department?.name ?? "—"} />
                <Row label="Employee code" value={d.employeeCode ?? "—"} />
                <Row label="Eco points" value={`${d.ecoPoints} 🍃`} />
                <Row label="Rating" value={`${(+d.rating).toFixed(1)} ★`} />
                <Row
                  label="Member since"
                  value={new Date(d.createdAt).toLocaleDateString()}
                />
              </div>
            </CardContent>
          </Card>

          {/* Editable form */}
          <Card>
            <CardContent className="space-y-7 p-6">
              <Section title="Personal details">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name">
                    <Input
                      value={form.fullName}
                      onChange={(e) =>
                        setForm({ ...form, fullName: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Email (read-only)">
                    <Input value={d.email} disabled />
                  </Field>
                  <Field label="Phone">
                    <Input
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                      placeholder="+91…"
                    />
                  </Field>
                  <Field label="Gender">
                    <Select
                      value={form.gender}
                      onChange={(v) => setForm({ ...form, gender: v })}
                      options={[
                        ["", "—"],
                        ["MALE", "Male"],
                        ["FEMALE", "Female"],
                      ]}
                    />
                  </Field>
                  <Field label="Employee code">
                    <Input
                      value={form.employeeCode}
                      onChange={(e) =>
                        setForm({ ...form, employeeCode: e.target.value })
                      }
                      placeholder="EMP-1024"
                    />
                  </Field>
                  <Field label="AC preference">
                    <Select
                      value={form.acPreference}
                      onChange={(v) => setForm({ ...form, acPreference: v })}
                      options={[
                        ["ANY", "Any"],
                        ["AC", "AC"],
                        ["NON_AC", "Non-AC"],
                      ]}
                    />
                  </Field>
                </div>
              </Section>

              <Section title="Home address">
                <LocationPicker
                  value={home}
                  onChange={setHome}
                  placeholder="Search your home location"
                />
              </Section>

              <Section title="Emergency & preferences">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Emergency contact name">
                    <Input
                      value={form.emergencyName}
                      onChange={(e) =>
                        setForm({ ...form, emergencyName: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Emergency contact phone">
                    <Input
                      value={form.emergencyPhone}
                      onChange={(e) =>
                        setForm({ ...form, emergencyPhone: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <label className="mt-3 flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm">
                  <span>Smoking allowed in my rides</span>
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={form.smokingAllowed}
                    onChange={(e) =>
                      setForm({ ...form, smokingAllowed: e.target.checked })
                    }
                  />
                </label>
              </Section>

              <div className="flex justify-end border-t border-border pt-5">
                <Button
                  onClick={() => save.mutate()}
                  disabled={save.isPending || form.fullName.trim().length < 2}
                >
                  {save.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value ?? "—"}</span>
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
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <GroupLabel className="mb-3">{title}</GroupLabel>
      {children}
    </section>
  )
}
// Radix Select forbids empty-string values, so map "" ↔ a sentinel internally.
const EMPTY = "__empty"
function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: [string, string][]
}) {
  return (
    <UISelect
      value={value === "" ? EMPTY : value}
      onValueChange={(v) => onChange(!v || v === EMPTY ? "" : v)}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v === "" ? EMPTY : v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </UISelect>
  )
}
