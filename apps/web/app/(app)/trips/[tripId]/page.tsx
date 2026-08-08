"use client"

import type { ComponentProps } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { useAuth } from "@/stores/auth"
import { inr } from "@/lib/utils"
import { PageHeader } from "@repo/ui/page-header"
import { Card, CardContent } from "@repo/ui/card"
import { Button } from "@repo/ui/button"
import { Badge } from "@repo/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/avatar"

interface Party {
  id: string
  fullName: string
  phone?: string | null
  photoUrl?: string | null
  rating?: string
}
interface Rev {
  role: "DRIVER" | "PASSENGER"
  rating: number
  comment: string | null
}
interface Bk {
  id: string
  createdAt: string
  fareAmount: number
  seats: number
  pickupLabel: string
  dropLabel: string
  status: string
  pickupVerifiedAt: string | null
  passenger: Party
  payment: { status: string; method: string } | null
  reviews: Rev[]
}
interface Metric {
  co2SavedG: number
  fuelSavedMl: number
  seatsFilled: number
  soloBaselineDistanceM: number
}
interface Detail {
  id: string
  status: string
  startedAt: string | null
  completedAt: string | null
  actualDistanceM: number | null
  createdAt: string
  metric: Metric | null
  ride: {
    originLabel: string
    destLabel: string
    departAt: string
    distanceM: number | null
    durationS: number | null
    farePerSeat: number
    createdAt: string
    totalSeats: number
    seatsAvailable: number
    driverId: string
    driver: Party & { rating: string }
    vehicle: {
      brand: string
      model: string
      registrationNo: string
      type: string
      fuelType: string
      color: string
      seats: number
    }
    bookings: Bk[]
  }
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
const dt = (s?: string | null) => (s ? new Date(s).toLocaleString() : "—")
const STATUS_VARIANT: Record<string, ComponentProps<typeof Badge>["variant"]> =
  {
    BOOKED: "secondary",
    DRIVER_STARTED: "info",
    IN_PROGRESS: "info",
    COMPLETED: "eco",
    PAYMENT_PENDING: "warning",
    PAYMENT_COMPLETED: "eco",
    CANCELLED: "destructive",
  }

export default function TripDetailsPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const me = useAuth((s) => s.user)
  const trip = useQuery({
    queryKey: ["trip-details", tripId],
    queryFn: () => api.get<Detail>(`/trips/${tripId}`),
    enabled: !!tripId,
  })

  const t = trip.data
  if (trip.isLoading || !t) {
    return (
      <Card>
        <CardContent className="p-8 text-sm text-muted-foreground">
          Loading ride details…
        </CardContent>
      </Card>
    )
  }

  const isDriver = t.ride.driverId === me?.id
  const myBooking = t.ride.bookings.find((b) => b.passenger.id === me?.id)
  const distanceKm = (
    (t.actualDistanceM ?? t.ride.distanceM ?? 0) / 1000
  ).toFixed(1)
  const durationMin = t.ride.durationS
    ? Math.round(t.ride.durationS / 60)
    : null
  // Passenger sees the seats they booked; driver sees filled/total for the ride.
  const seatsFilled = t.ride.bookings.reduce((n, b) => n + b.seats, 0)
  const seatsLabel = myBooking
    ? String(myBooking.seats)
    : `${seatsFilled}/${t.ride.totalSeats}`

  // Sustainability — CO2 saved by sharing this ride (computed at completion).
  const m = t.metric
  const co2Kg = m ? (m.co2SavedG / 1000).toFixed(2) : null
  const fuelL = m ? (m.fuelSavedMl / 1000).toFixed(2) : null
  const treesYr = m ? (m.co2SavedG / 21000).toFixed(2) : null // 1 tree ≈ 21 kg CO2/yr
  const ecoEarned = m
    ? isDriver
      ? Math.round(m.co2SavedG / 100)
      : Math.round(
          (m.co2SavedG * ((myBooking?.seats ?? 0) / (m.seatsFilled || 1))) / 100
        )
    : 0

  return (
    <div>
      <PageHeader
        title="Ride Details"
        description={`${t.ride.originLabel} → ${t.ride.destLabel}`}
        action={
          <div className="flex gap-2">
            <Badge variant={STATUS_VARIANT[t.status] ?? "secondary"}>
              {t.status.replaceAll("_", " ")}
            </Badge>
            <Button size="sm" variant="outline" render={<Link href="/trips" />}>
              Back
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left: journey + timeline */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex flex-col items-center">
                  <span className="size-2.5 rounded-full bg-primary" />
                  <span className="my-1 h-10 w-px bg-border" />
                  <span className="size-2.5 rounded-full bg-[var(--destructive)]" />
                </div>
                <div className="flex-1 space-y-6">
                  <div>
                    <p className="text-xs text-muted-foreground">Pickup</p>
                    <p className="font-medium">
                      {myBooking?.pickupLabel ?? t.ride.originLabel}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Drop</p>
                    <p className="font-medium">
                      {myBooking?.dropLabel ?? t.ride.destLabel}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm sm:grid-cols-4">
                <Stat label="Distance" value={`${distanceKm} km`} />
                <Stat
                  label="Duration"
                  value={durationMin ? `${durationMin} min` : "—"}
                />
                <Stat label="Seats" value={seatsLabel} />
                <Stat
                  label="Fare"
                  value={inr(myBooking?.fareAmount ?? t.ride.farePerSeat)}
                />
              </div>
            </CardContent>
          </Card>

          {m ? (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <p className="font-medium">🍃 Your green impact</p>
                  <Badge variant="eco">+{ecoEarned} eco pts</Badge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-semibold text-primary tabular-nums">
                      {co2Kg}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      kg CO₂ saved
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-primary tabular-nums">
                      {fuelL}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      L fuel saved
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-primary tabular-nums">
                      {treesYr}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      trees/yr equiv.
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Added to your eco points on the dashboard.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                CO₂ savings appear here once the ride is completed.
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="space-y-3 p-6">
              <p className="font-medium">Timeline</p>
              {myBooking && (
                <Line label="Booked at" value={dt(myBooking.createdAt)} />
              )}
              <Line label="Scheduled departure" value={dt(t.ride.departAt)} />
              <Line label="Trip started" value={dt(t.startedAt)} />
              {myBooking?.pickupVerifiedAt && (
                <Line
                  label="Pickup verified"
                  value={dt(myBooking.pickupVerifiedAt)}
                />
              )}
              <Line label="Completed" value={dt(t.completedAt)} />
            </CardContent>
          </Card>

          {/* Ratings & comments exchanged after the ride */}
          {(() => {
            const rows = (
              isDriver ? t.ride.bookings : myBooking ? [myBooking] : []
            ).flatMap((b) =>
              b.reviews.map((r) => ({
                key: `${b.id}-${r.role}`,
                who:
                  r.role === "DRIVER"
                    ? `${b.passenger.fullName} → ${t.ride.driver.fullName}`
                    : `${t.ride.driver.fullName} → ${b.passenger.fullName}`,
                rating: r.rating,
                comment: r.comment,
              }))
            )
            if (rows.length === 0) return null
            return (
              <Card>
                <CardContent className="space-y-3 p-6">
                  <p className="font-medium">Ratings</p>
                  {rows.map((r) => (
                    <div
                      key={r.key}
                      className="rounded-lg border border-border px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{r.who}</p>
                        <span className="text-sm text-[var(--gold)]">
                          {"★".repeat(r.rating)}
                          <span className="text-muted-foreground/30">
                            {"★".repeat(5 - r.rating)}
                          </span>
                        </span>
                      </div>
                      {r.comment && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          “{r.comment}”
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })()}

          {/* Driver view: passenger manifest */}
          {isDriver && (
            <Card>
              <CardContent className="space-y-3 p-6">
                <p className="font-medium">
                  Passengers ({t.ride.bookings.length})
                </p>
                {t.ride.bookings.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-xs">
                          {initials(b.passenger.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">
                          {b.passenger.fullName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Booked {dt(b.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {inr(b.fareAmount)}
                      </p>
                      <Badge
                        variant={
                          b.payment?.status === "PAID" ? "eco" : "secondary"
                        }
                        className="mt-0.5 text-[10px]"
                      >
                        {b.payment
                          ? `${b.payment.method}${b.payment.status === "PAID" ? " · paid" : " · pending"}`
                          : "unpaid"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: driver + vehicle + payment */}
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4 p-6">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Driver
              </p>
              <div className="flex items-center gap-3">
                <Avatar className="size-12">
                  <AvatarImage
                    src={t.ride.driver.photoUrl || undefined}
                    alt={t.ride.driver.fullName}
                  />
                  <AvatarFallback>
                    {initials(t.ride.driver.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {t.ride.driver.fullName}
                    {isDriver && " (you)"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {(+t.ride.driver.rating).toFixed(1)} ★
                  </p>
                </div>
              </div>
              <div className="space-y-2 border-t border-border pt-3 text-sm">
                <Line
                  label="Vehicle"
                  value={`${t.ride.vehicle.brand} ${t.ride.vehicle.model}`}
                />
                <Line label="Reg. no" value={t.ride.vehicle.registrationNo} />
                <Line
                  label="Type"
                  value={`${t.ride.vehicle.type}${t.ride.vehicle.fuelType === "ELECTRIC" ? " · EV 🍃" : ` · ${t.ride.vehicle.fuelType}`}`}
                />
                <Line label="Colour" value={t.ride.vehicle.color} />
              </div>
            </CardContent>
          </Card>

          {myBooking && (
            <Card>
              <CardContent className="space-y-2 p-6">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Payment
                </p>
                <Line label="Amount" value={inr(myBooking.fareAmount)} />
                <Line label="Method" value={myBooking.payment?.method ?? "—"} />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge
                    variant={
                      myBooking.payment?.status === "PAID" ? "eco" : "warning"
                    }
                  >
                    {myBooking.payment?.status ?? "UNPAID"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function Line({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-medium">{value ?? "—"}</span>
    </div>
  )
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  )
}
