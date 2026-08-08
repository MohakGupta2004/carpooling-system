"use client"

import { useEffect, useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import Link from "next/link"
import dynamic from "next/dynamic"
import { api } from "@/lib/api"
import { useAuth } from "@/stores/auth"
import { PageHeader } from "@repo/ui/page-header"
import { Card, CardContent } from "@repo/ui/card"
import { Button } from "@repo/ui/button"
import { Input } from "@repo/ui/input"
import { Label } from "@repo/ui/label"
import { Badge } from "@repo/ui/badge"
import { LocationPicker, type Place } from "@/components/maps/location-picker"
import { VerifiedIcon, RouteIcon, SpinnerIcon } from "@repo/ui/icons"

const MapPanel = dynamic(() => import("@/components/maps/map-panel"), {
  ssr: false,
  loading: () => (
    <div className="h-[280px] w-full animate-pulse rounded-xl bg-muted" />
  ),
})

interface Vehicle {
  id: string
  brand: string
  model: string
  seats: number
  verification: string
  type: string
  fuelType: string
}
interface RoutePreview {
  distanceKm: number
  durationMin: number
}
interface Directions {
  points: { lat: number; lng: number }[]
  distanceM: number
  durationS: number
}
interface SavedPlace {
  id: string
  label: string
  address: string
  lat: number
  lng: number
}

export default function OfferPage() {
  const router = useRouter()
  const isWoman = useAuth((s) => s.user?.gender === "FEMALE")
  const vehicles = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => api.get<Vehicle[]>("/vehicles"),
  })
  const verified =
    vehicles.data?.filter((v) => v.verification === "VERIFIED") ?? []

  const [origin, setOrigin] = useState<Place | null>(null)
  const [destination, setDestination] = useState<Place | null>(null)
  const [vehicleId, setVehicleId] = useState<string>("")
  const [seats, setSeats] = useState(3)
  const [fare, setFare] = useState(80)
  const [maxDetourM, setMaxDetourM] = useState(3000)
  const [womenOnly, setWomenOnly] = useState(false)
  const [preview, setPreview] = useState<RoutePreview | null>(null)
  const [routePoints, setRoutePoints] = useState<[number, number][] | null>(
    null
  )

  // Clear a stale route/preview whenever the endpoints change.
  useEffect(() => {
    setRoutePoints(null)
    setPreview(null)
  }, [origin, destination])

  const saved = useQuery({
    queryKey: ["saved-places"],
    queryFn: () => api.get<SavedPlace[]>("/users/me/saved-places"),
  })
  useEffect(() => {
    if (!saved.data) return
    const home = saved.data.find((s) => s.label.toLowerCase().includes("home"))
    const office = saved.data.find((s) =>
      s.label.toLowerCase().includes("office")
    )
    if (home && !origin)
      setOrigin({
        label: home.label,
        address: home.address,
        lat: home.lat,
        lng: home.lng,
      })
    if (office && !destination)
      setDestination({
        label: office.label,
        address: office.address,
        lat: office.lat,
        lng: office.lng,
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.data])

  // Confirm route → fetch the real road-following route from Google Directions.
  const previewMut = useMutation({
    mutationFn: () =>
      api.get<Directions>(
        `/maps/directions?oLat=${origin!.lat}&oLng=${origin!.lng}&dLat=${destination!.lat}&dLng=${destination!.lng}`
      ),
    onSuccess: (d) => {
      setPreview({
        distanceKm: +(d.distanceM / 1000).toFixed(1),
        durationMin: Math.round(d.durationS / 60),
      })
      setRoutePoints(
        d.points.length > 1
          ? d.points.map((p) => [p.lat, p.lng] as [number, number])
          : null
      )
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not fetch route"),
  })

  const publish = useMutation({
    mutationFn: () =>
      api.post("/rides", {
        vehicleId: vehicleId || verified[0]?.id,
        origin,
        destination,
        departAt: new Date(Date.now() + 3600_000).toISOString(),
        totalSeats: seats,
        farePerSeat: fare * 100,
        bookingMode: "INSTANT",
        maxDetourM,
        rules: isWoman ? { womenOnly } : undefined,
      }),
    onSuccess: () => {
      toast.success("Ride published!")
      router.push("/trips")
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Publish failed"),
  })

  if (vehicles.isLoading)
    return <div className="text-sm text-muted-foreground">Loading…</div>

  if (verified.length === 0) {
    return (
      <div>
        <PageHeader title="Offer a Ride" />
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              You need a <strong>verified vehicle</strong> before offering a
              ride.
            </p>
            <Button className="mt-4" render={<Link href="/vehicles" />}>
              Add a vehicle
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const markers = [
    ...(origin
      ? [
          {
            lat: origin.lat,
            lng: origin.lng,
            label: origin.label,
            color: "#059669",
          },
        ]
      : []),
    ...(destination
      ? [
          {
            lat: destination.lat,
            lng: destination.lng,
            label: destination.label,
            color: "#e11d48",
          },
        ]
      : []),
  ]
  const path: [number, number][] | undefined =
    routePoints && routePoints.length > 1
      ? routePoints
      : origin && destination
        ? [
            [origin.lat, origin.lng],
            [destination.lat, destination.lng],
          ]
        : undefined
  const canPublish = !!origin && !!destination

  return (
    <div>
      <PageHeader
        title="Offer a Ride"
        description="Publish your commute and share seats."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              <Label>From</Label>
              <LocationPicker
                value={origin}
                onChange={setOrigin}
                placeholder="Starting point"
                accent="#059669"
              />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <LocationPicker
                value={destination}
                onChange={setDestination}
                placeholder="Destination"
                accent="#e11d48"
              />
            </div>
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => previewMut.mutate()}
                disabled={!canPublish || previewMut.isPending}
              >
                {previewMut.isPending ? (
                  <SpinnerIcon className="size-4 animate-spin" />
                ) : (
                  <RouteIcon />
                )}
                Confirm route
              </Button>
              {preview && (
                <Badge variant="secondary" className="ml-2">
                  {preview.distanceKm} km · {preview.durationMin} min
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <Label>Vehicle</Label>
              <div className="space-y-2">
                {verified.map((v) => (
                  <label
                    key={v.id}
                    className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm ${(vehicleId || verified[0]?.id) === v.id ? "border-primary bg-secondary" : "border-border"}`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="veh"
                        checked={(vehicleId || verified[0]?.id) === v.id}
                        onChange={() => setVehicleId(v.id)}
                      />
                      {v.brand} {v.model}
                    </span>
                    <Badge variant="eco" className="gap-1">
                      <VerifiedIcon className="size-3" /> {v.seats} seats
                    </Badge>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Seats offered</Label>
                <Input
                  type="number"
                  min={1}
                  max={6}
                  value={seats}
                  onChange={(e) => setSeats(+e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Fare per seat (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  value={fare}
                  onChange={(e) => setFare(+e.target.value)}
                />
              </div>
            </div>

            {/* How far the driver will go off-route to collect a passenger — this
                controls which passengers can even see/book this ride. */}
            <div className="space-y-2">
              <Label>Pickup flexibility</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { m: 1000, label: "On my way", hint: "≤1 km" },
                  { m: 3000, label: "Small detour", hint: "≤3 km" },
                  { m: 6000, label: "Flexible", hint: "≤6 km" },
                ].map((o) => (
                  <button
                    key={o.m}
                    type="button"
                    onClick={() => setMaxDetourM(o.m)}
                    className={`rounded-md border px-3 py-2 text-center text-sm transition-colors ${maxDetourM === o.m ? "border-primary bg-secondary" : "border-border hover:bg-accent"}`}
                  >
                    <span className="block font-medium">{o.label}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {o.hint}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Only passengers within this detour of your route will see and
                book this ride.
              </p>
            </div>

            {/* Women-only ride — offered only to female drivers; restricts booking to women. */}
            {isWoman && (
              <label className="flex cursor-pointer items-start justify-between gap-3 rounded-md border border-border px-3 py-2.5">
                <span>
                  <span className="block text-sm font-medium">
                    Women-only ride 👩
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Only women passengers can find and book this ride.
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-[var(--primary)]"
                  checked={womenOnly}
                  onChange={(e) => setWomenOnly(e.target.checked)}
                />
              </label>
            )}

            <Button
              className="w-full"
              onClick={() => publish.mutate()}
              disabled={!canPublish || publish.isPending}
            >
              {publish.isPending && (
                <SpinnerIcon className="size-4 animate-spin" />
              )}
              Publish ride
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-sm font-medium">Route preview</p>
            <MapPanel
              markers={markers}
              path={path}
              className="h-[280px] w-full overflow-hidden rounded-xl border border-border"
              center={origin ? [origin.lat, origin.lng] : undefined}
            />
            <div className="rounded-lg bg-muted/50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Seats</span>
                <span className="font-medium tabular-nums">{seats}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Fare / seat</span>
                <span className="font-medium tabular-nums">₹{fare}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Max earnings</span>
                <span className="font-medium tabular-nums">
                  ₹{fare * seats}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
