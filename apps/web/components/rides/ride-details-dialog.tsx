"use client"

import dynamic from "next/dynamic"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { useAuth } from "@/stores/auth"
import { inr, km } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog"
import { Button } from "@repo/ui/button"
import { Badge } from "@repo/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/avatar"
import { Skeleton } from "@repo/ui/skeleton"
import { Separator } from "@repo/ui/separator"
import { SeatIndicator } from "@repo/ui/seats"
import { ClockIcon, RouteIcon, StarFilledIcon, CarIcon } from "@repo/ui/icons"

const MapPanel = dynamic(() => import("@/components/maps/map-panel"), {
  ssr: false,
  loading: () => (
    <div className="h-[220px] w-full animate-pulse rounded-xl bg-muted" />
  ),
})

/** Coordinates arrive as Prisma Decimal → JSON string; coerce everywhere. */
const n = (v: number | string | null | undefined) => Number(v ?? 0)

interface Stop {
  lat: number | string
  lng: number | string
  label?: string
  order?: number
}

interface RideDetail {
  id: string
  originLabel: string
  originLat: string | number
  originLng: string | number
  destLabel: string
  destLat: string | number
  destLng: string | number
  stops: Stop[] | null
  routePolyline: string | null
  distanceM: number | null
  durationS: number | null
  departAt: string
  totalSeats: number
  seatsAvailable: number
  farePerSeat: number
  bookingMode: "INSTANT" | "APPROVAL"
  maxDetourM: number
  rules: {
    noSmoking?: boolean
    noPets?: boolean
    noLoudMusic?: boolean
    luggageAllowed?: boolean
    womenOnly?: boolean
  } | null
  driver: {
    id: string
    fullName: string
    photoUrl: string | null
    rating: string | number
  }
  vehicle: {
    type: string
    brand: string
    model: string
    color: string | null
    fuelType: string
    seats: number
    isAc: boolean | null
  }
}

/**
 * Decode a Google encoded polyline into [lat, lng] pairs. The Maps JS API's own
 * `geometry.encoding` helper isn't available here — the shared loader only pulls
 * the "places" library (see components/maps/use-maps.ts).
 */
function decodePolyline(encoded: string): [number, number][] {
  const pts: [number, number][] = []
  let i = 0
  let lat = 0
  let lng = 0
  while (i < encoded.length) {
    let shift = 0
    let result = 0
    let b: number
    do {
      b = encoded.charCodeAt(i++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1
    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(i++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1
    pts.push([lat / 1e5, lng / 1e5])
  }
  return pts
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}

export function RideDetailsDialog({
  rideId,
  open,
  onOpenChange,
  matchReason,
  matchScore,
  onBook,
  booking = false,
}: {
  rideId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Explanation from the search result, if the dialog was opened from a match. */
  matchReason?: string
  matchScore?: number
  onBook?: (rideId: string) => void
  booking?: boolean
}) {
  const myId = useAuth((s) => s.user?.id)

  const ride = useQuery({
    queryKey: ["ride", rideId],
    queryFn: () => api.get<RideDetail>(`/rides/${rideId}`),
    enabled: open && !!rideId,
  })

  const r = ride.data
  const isMine = !!r && !!myId && r.driver.id === myId
  const full = !!r && r.seatsAvailable <= 0

  const stops = (r?.stops ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const markers = r
    ? [
        {
          lat: n(r.originLat),
          lng: n(r.originLng),
          label: r.originLabel,
          color: "#059669",
        },
        ...stops.map((s, i) => ({
          lat: n(s.lat),
          lng: n(s.lng),
          label: s.label ?? `Stop ${i + 1}`,
          color: "#f59e0b",
        })),
        {
          lat: n(r.destLat),
          lng: n(r.destLng),
          label: r.destLabel,
          color: "#e11d48",
        },
      ]
    : []

  // Real road geometry when the ride stored a polyline; otherwise a straight
  // origin → stops → destination line, same fallback the offer page uses.
  const path: [number, number][] | undefined = r
    ? r.routePolyline
      ? decodePolyline(r.routePolyline)
      : markers.map((m) => [m.lat, m.lng] as [number, number])
    : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-4 overflow-y-auto sm:max-w-2xl">
        {ride.isPending && (
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-[220px] w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {ride.isError && (
          <div className="py-8 text-center text-sm text-destructive">
            Couldn&apos;t load this ride. It may have been cancelled.
          </div>
        )}

        {r && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base">Ride details</DialogTitle>
              <DialogDescription>
                {r.originLabel} → {r.destLabel}
              </DialogDescription>
            </DialogHeader>

            <MapPanel
              markers={markers}
              path={path}
              center={[n(r.originLat), n(r.originLng)]}
              className="h-[220px] w-full overflow-hidden rounded-xl border border-border"
            />

            {/* driver */}
            <div className="flex items-center gap-3">
              <Avatar className="size-11">
                {r.driver.photoUrl && <AvatarImage src={r.driver.photoUrl} />}
                <AvatarFallback>
                  {r.driver.fullName
                    .split(" ")
                    .map((p) => p[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{r.driver.fullName}</p>
                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <StarFilledIcon className="size-3 text-[var(--gold)]" />
                    {n(r.driver.rating).toFixed(1)}
                  </span>
                  {isMine && <Badge variant="secondary">You</Badge>}
                </div>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CarIcon className="size-3.5" />
                  {r.vehicle.brand} {r.vehicle.model}
                  {r.vehicle.color ? ` · ${r.vehicle.color}` : ""}
                  {r.vehicle.type !== "BIKE" && r.vehicle.isAc != null
                    ? r.vehicle.isAc
                      ? " · AC"
                      : " · Non-AC"
                    : ""}
                </p>
              </div>
            </div>

            <Separator />

            {/* trip facts */}
            <div className="space-y-2">
              <Row
                label="Departs"
                value={
                  <span className="flex items-center gap-1.5">
                    <ClockIcon className="size-3.5" />
                    {new Date(r.departAt).toLocaleString([], {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                }
              />
              {r.distanceM != null && (
                <Row
                  label="Distance"
                  value={
                    <span className="flex items-center gap-1.5">
                      <RouteIcon className="size-3.5" />
                      {km(r.distanceM)}
                      {r.durationS != null &&
                        ` · ~${Math.round(r.durationS / 60)} min`}
                    </span>
                  }
                />
              )}
              <Row label="Fare per seat" value={inr(r.farePerSeat)} />
              <Row
                label="Seats"
                value={
                  <SeatIndicator
                    total={r.totalSeats}
                    available={r.seatsAvailable}
                  />
                }
              />
              <Row
                label="Booking"
                value={
                  r.bookingMode === "INSTANT"
                    ? "Instant confirm"
                    : "Driver approval"
                }
              />
              <Row
                label="Detour tolerance"
                value={`up to ${km(r.maxDetourM)}`}
              />
            </div>

            {stops.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="mb-2 text-sm font-medium">Stops on the way</p>
                  <ol className="space-y-1">
                    {stops.map((s, i) => (
                      <li
                        key={i}
                        className="text-sm text-muted-foreground before:mr-2 before:text-[var(--primary)] before:content-['•']"
                      >
                        {s.label ?? `Stop ${i + 1}`}
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            )}

            {r.rules && (
              <>
                <Separator />
                <div className="flex flex-wrap gap-2">
                  {r.rules.womenOnly && (
                    <Badge variant="secondary">Women only</Badge>
                  )}
                  {r.rules.noSmoking && (
                    <Badge variant="outline">🚭 No smoking</Badge>
                  )}
                  {r.rules.noPets && <Badge variant="outline">No pets</Badge>}
                  {r.rules.noLoudMusic && (
                    <Badge variant="outline">No loud music</Badge>
                  )}
                  {r.rules.luggageAllowed && (
                    <Badge variant="outline">Luggage OK</Badge>
                  )}
                </div>
              </>
            )}

            {matchReason && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                {matchScore != null && (
                  <Badge variant="info" className="mr-2">
                    {matchScore}% match
                  </Badge>
                )}
                <span className="text-muted-foreground">{matchReason}</span>
              </div>
            )}

            {onBook && (
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button
                  onClick={() => onBook(r.id)}
                  disabled={booking || full || isMine}
                >
                  {isMine
                    ? "Your own ride"
                    : full
                      ? "Full"
                      : r.bookingMode === "APPROVAL"
                        ? "Request seat"
                        : "Book seat"}
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
