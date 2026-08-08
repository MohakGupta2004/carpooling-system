"use client"

import Link from "next/link"
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import { api } from "@/lib/api"
import { PageHeader } from "@repo/ui/page-header"
import { Card, CardContent } from "@repo/ui/card"
import { Button } from "@repo/ui/button"
import { Input } from "@repo/ui/input"
import { Badge } from "@repo/ui/badge"
import { LocationPicker, type Place } from "@/components/maps/LocationPicker"
import {
  RouteIcon,
  CarIcon,
  WalletIcon,
  HistoryIcon,
  ChartIcon,
  UsersIcon,
  EcoIcon,
  HomeIcon,
  PinIcon,
  PlusIcon,
} from "@repo/ui/icons"

interface SavedPlace {
  id: string
  label: string
  address: string
  lat: string
  lng: string
}
interface MeData {
  ecoPoints: number
  savedPlaces: SavedPlace[]
}

const LINKS = [
  { href: "/profile", label: "My Profile", icon: UsersIcon },
  { href: "/trips", label: "My Trips", icon: RouteIcon },
  { href: "/vehicles", label: "My Vehicles", icon: CarIcon },
  { href: "/wallet", label: "Payment & Wallet", icon: WalletIcon },
  { href: "/history", label: "Ride History", icon: HistoryIcon },
  { href: "/reports", label: "Reports", icon: ChartIcon },
]

const FUEL_FACTORS = [
  ["Petrol", "2.31 kg CO₂ / litre"],
  ["Diesel", "2.67 kg CO₂ / litre"],
  ["CNG", "2.16 kg CO₂ / kg"],
  ["Electric", "grid-based (~0.7 kg CO₂ / kWh)"],
]

export default function SettingsPage() {
  const me = useQuery({
    queryKey: ["me-settings"],
    queryFn: () => api.get<MeData>("/users/me"),
  })

  const [label, setLabel] = useState("")
  const [place, setPlace] = useState<Place | null>(null)

  const addPlace = useMutation({
    mutationFn: () =>
      api.post("/users/me/saved-places", {
        label: label.trim(),
        address: place!.address ?? place!.label,
        lat: place!.lat,
        lng: place!.lng,
      }),
    onSuccess: () => {
      toast.success("Place saved")
      setLabel("")
      setPlace(null)
      me.refetch()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  })
  const delPlace = useMutation({
    mutationFn: (id: string) => api.del(`/users/me/saved-places/${id}`),
    onSuccess: () => {
      toast.success("Removed")
      me.refetch()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  })

  const places = me.data?.savedPlaces ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Your account, preferences, saved places, and how eco points work."
      />

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((l) => {
          const Icon = l.icon
          return (
            <Link key={l.href} href={l.href}>
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="flex items-center gap-3 p-5">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
                    <Icon className="size-5" />
                  </span>
                  <span className="font-medium">{l.label}</span>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* ── Eco points explainer ── */}
      <Card className="overflow-hidden border-primary/30">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <EcoIcon className="size-5" />
              </span>
              <div>
                <p className="font-semibold">How your eco points work</p>
                <p className="text-sm text-muted-foreground">
                  Points reward the CO₂ you keep out of the air by sharing
                  rides.
                </p>
              </div>
            </div>
            <Badge variant="eco" className="text-sm">
              You have {me.data?.ecoPoints ?? 0} eco pts
            </Badge>
          </div>

          <div className="mt-5 rounded-lg bg-primary/5 p-4 text-center">
            <p className="text-sm text-muted-foreground">The rule</p>
            <p className="text-lg font-semibold text-primary">
              10 eco points for every 1 kg of CO₂ you save 🍃
            </p>
            <p className="text-xs text-muted-foreground">
              (1 point per 100 g of CO₂ avoided)
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">
                How the CO₂ saving is calculated
              </p>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <span className="mr-2 font-semibold text-foreground">1.</span>
                  Each rider who shares avoids one solo trip →{" "}
                  <em>distance × riders</em> = solo driving avoided.
                </li>
                <li>
                  <span className="mr-2 font-semibold text-foreground">2.</span>
                  Fuel saved = distance ÷ mileage (≈ 15 km/L).
                </li>
                <li>
                  <span className="mr-2 font-semibold text-foreground">3.</span>
                  CO₂ saved = fuel saved × the fuel’s emission factor.
                </li>
                <li>
                  <span className="mr-2 font-semibold text-foreground">4.</span>
                  Points = CO₂ saved ÷ 100 g. The driver earns the full ride’s
                  saving; passengers share it by seats.
                </li>
              </ol>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Emission factors used</p>
              <div className="divide-y divide-border rounded-lg border border-border text-sm">
                {FUEL_FACTORS.map(([fuel, factor]) => (
                  <div
                    key={fuel}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <span className="font-medium">{fuel}</span>
                    <span className="text-muted-foreground">{factor}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                EVs count grid emissions instead of tailpipe fuel.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Saved places ── */}
      <Card>
        <CardContent className="p-6">
          <p className="font-semibold">Saved places</p>
          <p className="text-sm text-muted-foreground">
            Quick pick these when offering or booking a ride.
          </p>

          <div className="mt-4 space-y-2">
            {places.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No saved places yet.
              </p>
            )}
            {places.map((p) => {
              const Icon = p.label.toLowerCase().includes("home")
                ? HomeIcon
                : PinIcon
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon className="size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{p.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.address}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => delPlace.mutate(p.id)}
                    disabled={delPlace.isPending}
                  >
                    Remove
                  </Button>
                </div>
              )
            })}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Label
              </label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Gym, Mom's"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Location
              </label>
              <LocationPicker
                value={place}
                onChange={setPlace}
                placeholder="Search a place to save"
              />
            </div>
            <Button
              onClick={() => addPlace.mutate()}
              disabled={!label.trim() || !place || addPlace.isPending}
            >
              <PlusIcon /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Preferences ── */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-6">
          <div>
            <p className="font-semibold">Ride preferences</p>
            <p className="text-sm text-muted-foreground">
              AC preference, pickup radius, smoking, home address and emergency
              contact.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/profile">Edit in profile</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
