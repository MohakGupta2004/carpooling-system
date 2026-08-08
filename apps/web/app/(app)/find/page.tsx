"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import { api } from "@/lib/api"
import { useAuth } from "@/stores/auth"
import { inr, km } from "@/lib/utils"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { LocationPicker, type Place } from "@/components/maps/LocationPicker"
import {
  SearchIcon,
  StarFilledIcon,
  ClockIcon,
  SpinnerIcon,
} from "@/components/ui/icons"
import { SeatIndicator } from "@/components/ui/seats"

interface Match {
  id: string
  driver: { fullName: string; rating: number }
  vehicle: { brand: string; model: string; type: string; isAc: boolean | null }
  origin: { label: string; lat: number; lng: number }
  destination: { label: string; lat: number; lng: number }
  departAt: string
  seatsAvailable: number
  totalSeats: number
  farePerSeat: number
  rules: { womenOnly?: boolean; noSmoking?: boolean } | null
  match: { score: number; pickupDistanceM: number; reason: string }
}
interface SavedPlace {
  id: string
  label: string
  address: string
  lat: number
  lng: number
}

export default function FindPage() {
  const isWoman = useAuth((s) => s.user?.gender === "FEMALE")
  const [pickup, setPickup] = useState<Place | null>(null)
  const [destination, setDestination] = useState<Place | null>(null)
  const [womenOnly, setWomenOnly] = useState(false)
  const [date] = useState(new Date().toISOString().slice(0, 10))

  // Prefill pickup = saved "Home", destination = saved "Office"
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
    if (home && !pickup)
      setPickup({
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

  const search = useMutation({
    mutationFn: () =>
      api.post<Match[]>("/rides/search", {
        pickup,
        destination,
        date,
        seats: 1,
        recurring: false,
        sort: "DISTANCE",
        filters: {
          radiusM: 8000,
          womenOnly: isWoman && womenOnly ? true : undefined,
        },
      }),
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Search failed"),
  })

  const book = useMutation({
    mutationFn: (rideId: string) =>
      api.post("/bookings", { rideId, seats: 1, pickup, drop: destination }),
    onSuccess: () => toast.success("Booked! Check My Trips."),
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Booking failed"),
  })

  const canSearch = !!pickup && !!destination

  return (
    <div>
      <PageHeader
        title="Find a Ride"
        description="Match with colleagues heading your way."
      />

      <Card className="mb-6">
        <CardContent className="grid items-end gap-4 p-5 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-2">
            <Label>Pickup</Label>
            <LocationPicker
              value={pickup}
              onChange={setPickup}
              placeholder="Where from?"
              accent="#059669"
            />
          </div>
          <div className="space-y-2">
            <Label>Destination</Label>
            <LocationPicker
              value={destination}
              onChange={setDestination}
              placeholder="Where to?"
              accent="#e11d48"
            />
          </div>
          <Button
            onClick={() => search.mutate()}
            disabled={!canSearch || search.isPending}
          >
            {search.isPending ? (
              <SpinnerIcon className="size-4 animate-spin" />
            ) : (
              <SearchIcon />
            )}
            Search
          </Button>
          {/* Women-only filter — offered only to female passengers. */}
          {isWoman && (
            <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-3">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={womenOnly}
                onChange={(e) => setWomenOnly(e.target.checked)}
              />
              <span className="font-medium">Women-only rides 👩</span>
              <span className="text-muted-foreground">
                — show only rides offered by women for women.
              </span>
            </label>
          )}
        </CardContent>
      </Card>

      {search.isPending && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}

      {search.data && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {search.data.length} matching ride(s)
          </p>
          {search.data.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-4">
                  <Avatar className="size-11">
                    <AvatarFallback>
                      {m.driver.fullName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{m.driver.fullName}</p>
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <StarFilledIcon className="size-3 text-[var(--gold)]" />{" "}
                        {Number(m.driver.rating).toFixed(1)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {m.origin.label} → {m.destination.label} ·{" "}
                      {m.vehicle.brand} {m.vehicle.model}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <ClockIcon className="size-3" />{" "}
                        {new Date(m.departAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Badge>
                      <Badge variant="info">{m.match.score}% match</Badge>
                      {m.vehicle.type !== "BIKE" && m.vehicle.isAc != null && (
                        <Badge variant={m.vehicle.isAc ? "info" : "outline"}>
                          {m.vehicle.isAc ? "AC" : "Non-AC"}
                        </Badge>
                      )}
                      {m.rules?.noSmoking && (
                        <Badge variant="outline">🚭 No smoking</Badge>
                      )}
                      {m.rules?.womenOnly && (
                        <Badge variant="secondary">Women only</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {m.match.reason}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <p className="tabular text-lg font-semibold">
                    {inr(m.farePerSeat)}
                  </p>
                  <SeatIndicator
                    total={m.totalSeats}
                    available={m.seatsAvailable}
                  />
                  <p className="text-xs text-muted-foreground">
                    {km(m.match.pickupDistanceM)} away
                  </p>
                  <Button
                    size="sm"
                    className="mt-1"
                    onClick={() => book.mutate(m.id)}
                    disabled={book.isPending || m.seatsAvailable <= 0}
                  >
                    {m.seatsAvailable <= 0 ? "Full" : "Book seat"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {search.data.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No rides match yet. Try widening your search or offer a ride
                yourself.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
