"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import { api } from "@/lib/api"
import { inr, km } from "@/lib/utils"
import { PageHeader } from "@repo/ui/page-header"
import { Card, CardContent } from "@repo/ui/card"
import { Button } from "@repo/ui/button"
import { Badge } from "@repo/ui/badge"
import { Label } from "@repo/ui/label"
import { Avatar, AvatarFallback } from "@repo/ui/avatar"
import { Skeleton } from "@repo/ui/skeleton"
import { SeatIndicator } from "@repo/ui/seats"
import {
  LocationPicker,
  type Place as PickerPlace,
} from "@/components/maps/location-picker"
import { SearchIcon, StarFilledIcon, ClockIcon, RoadIcon } from "@repo/ui/icons"

interface Place {
  label: string
  lat: number
  lng: number
}
interface Ride {
  id: string
  driver: { fullName: string; rating: number }
  vehicle: {
    brand: string
    model: string
    type: string
    fuelType: string
    isAc: boolean | null
  }
  origin: Place
  destination: Place
  departAt: string
  totalSeats: number
  seatsAvailable: number
  farePerSeat: number
  distanceM: number | null
  rules: { womenOnly?: boolean; noSmoking?: boolean } | null
  maxDetourM: number
  detourM: number
}
interface SavedPlace {
  id: string
  label: string
  address: string
  lat: number
  lng: number
}

const initials = (n: string) =>
  n
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

export default function AvailableRidesPage() {
  const qc = useQueryClient()
  const [pickup, setPickup] = useState<PickerPlace | null>(null)

  // Default the pickup to the passenger's saved Home so results are relevant immediately.
  const saved = useQuery({
    queryKey: ["saved-places"],
    queryFn: () => api.get<SavedPlace[]>("/users/me/saved-places"),
  })
  useEffect(() => {
    if (pickup || !saved.data) return
    const home = saved.data.find((s) => s.label.toLowerCase().includes("home"))
    if (home)
      setPickup({
        label: home.label,
        address: home.address,
        lat: home.lat,
        lng: home.lng,
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.data])

  const rides = useQuery({
    queryKey: ["rides", "available", pickup?.lat, pickup?.lng],
    queryFn: () => api.post<Ride[]>("/rides/available", { pickup }),
    enabled: !!pickup,
  })

  const book = useMutation({
    mutationFn: (r: Ride) =>
      api.post("/bookings", {
        rideId: r.id,
        seats: 1,
        pickup: pickup!,
        drop: r.destination,
      }),
    onSuccess: () => {
      toast.success("Booked! Check My Trips.")
      qc.invalidateQueries({ queryKey: ["rides", "available"] })
      qc.invalidateQueries({ queryKey: ["trips", "mine"] })
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Booking failed"),
  })

  return (
    <div>
      <PageHeader
        title="Available Rides"
        description="Rides that pass near your pickup — a driver only detours a little to collect you."
        action={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/find" />}
          >
            <SearchIcon /> Search by route
          </Button>
        }
      />

      {/* Pickup selector — results are the rides on the way to their destination from here. */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <Label className="mb-2 block">Your pickup point</Label>
          <div className="max-w-md">
            <LocationPicker
              value={pickup}
              onChange={setPickup}
              placeholder="Where should you be picked up?"
              accent="#059669"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Showing rides whose route passes close enough that picking you up
            adds only a small detour for the driver.
          </p>
        </CardContent>
      </Card>

      {!pickup ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Choose a pickup point to see rides heading your way.
          </CardContent>
        </Card>
      ) : rides.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : rides.data?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <RoadIcon className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">
              No rides pass near this pickup right now. Try a different pickup
              point, or search by route.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {rides.data?.length} ride(s) available
          </p>
          {rides.data?.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="flex min-w-0 items-center gap-4">
                  <Avatar className="size-11">
                    <AvatarFallback>
                      {initials(r.driver.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">
                        {r.driver.fullName}
                      </p>
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <StarFilledIcon className="size-3 text-[var(--gold)]" />{" "}
                        {Number(r.driver.rating).toFixed(1)}
                      </span>
                      {r.rules?.womenOnly && (
                        <Badge variant="secondary" className="text-[10px]">
                          Women only
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {r.origin.label} → {r.destination.label}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <ClockIcon className="size-3" />{" "}
                        {new Date(r.departAt).toLocaleString([], {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Badge>
                      <Badge
                        variant={r.detourM < 1000 ? "eco" : "info"}
                        className="gap-1"
                      >
                        <RoadIcon className="size-3" />{" "}
                        {r.detourM < 300
                          ? "On the way"
                          : `+${(r.detourM / 1000).toFixed(1)} km detour`}
                      </Badge>
                      {r.vehicle.type !== "BIKE" && r.vehicle.isAc != null && (
                        <Badge variant={r.vehicle.isAc ? "info" : "outline"}>
                          {r.vehicle.isAc ? "AC" : "Non-AC"}
                        </Badge>
                      )}
                      {r.rules?.noSmoking && (
                        <Badge variant="outline">🚭 No smoking</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {r.vehicle.brand} {r.vehicle.model}
                        {r.vehicle.type === "EV" ||
                        r.vehicle.fuelType === "ELECTRIC"
                          ? " 🍃"
                          : ""}
                        {r.distanceM ? ` · ${km(r.distanceM)}` : ""}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <p className="text-lg font-semibold tabular-nums">
                    {inr(r.farePerSeat)}
                    <span className="text-xs font-normal text-muted-foreground">
                      /seat
                    </span>
                  </p>
                  <SeatIndicator
                    total={r.totalSeats}
                    available={r.seatsAvailable}
                  />
                  <Button
                    size="sm"
                    className="mt-1"
                    onClick={() => book.mutate(r)}
                    disabled={book.isPending || r.seatsAvailable <= 0}
                  >
                    {r.seatsAvailable <= 0 ? "Full" : "Book seat"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
