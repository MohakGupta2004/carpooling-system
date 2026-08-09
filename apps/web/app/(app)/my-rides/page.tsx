"use client"

import type { ComponentProps } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import { api } from "@/lib/api"
import { inr } from "@/lib/utils"
import { PageHeader } from "@repo/ui/page-header"
import { Card, CardContent } from "@repo/ui/card"
import { Button } from "@repo/ui/button"
import { Badge } from "@repo/ui/badge"
import { Avatar, AvatarFallback } from "@repo/ui/avatar"
import { Skeleton } from "@repo/ui/skeleton"
import { SeatIndicator } from "@repo/ui/seats"
import { DriveIcon, PlusIcon, ClockIcon, RouteIcon } from "@repo/ui/icons"

interface Passenger {
  fullName: string
  photoUrl: string | null
}
interface Booking {
  id: string
  status: string
  seats: number
  passenger: Passenger
}
interface MyRide {
  id: string
  originLabel: string
  destLabel: string
  departAt: string
  totalSeats: number
  seatsAvailable: number
  farePerSeat: number
  status: string
  vehicle: { brand: string; model: string; type: string; fuelType: string }
  trip: { id: string; status: string } | null
  bookings: Booking[]
}

const RIDE_VARIANT: Record<string, ComponentProps<typeof Badge>["variant"]> = {
  PUBLISHED: "info",
  FULL: "warning",
  STARTED: "info",
  COMPLETED: "eco",
  CANCELLED: "destructive",
  DRAFT: "secondary",
}
const initials = (n: string) =>
  n
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

export default function MyRidesPage() {
  const qc = useQueryClient()
  const rides = useQuery({
    queryKey: ["rides", "mine"],
    queryFn: () => api.get<MyRide[]>("/rides/mine"),
  })

  const cancel = useMutation({
    mutationFn: (id: string) => api.post(`/rides/${id}/cancel`),
    onSuccess: () => {
      toast.success("Ride cancelled")
      qc.invalidateQueries({ queryKey: ["rides", "mine"] })
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not cancel"),
  })

  return (
    <div>
      <PageHeader
        title="My Rides"
        description="Rides you've published as a driver."
        action={
          <Button nativeButton={false} render={<Link href="/offer" />}>
            <PlusIcon /> Offer a ride
          </Button>
        }
      />

      {rides.isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : rides.data?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <DriveIcon className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">
              You haven&apos;t published any rides yet.
            </p>
            <Button nativeButton={false} render={<Link href="/offer" />}>
              <PlusIcon /> Offer your first ride
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rides.data?.map((r) => {
            const confirmed = r.bookings.filter((b) => b.status !== "REQUESTED")
            const requests = r.bookings.filter((b) => b.status === "REQUESTED")
            const canCancel = ["PUBLISHED", "FULL"].includes(r.status)
            return (
              <Card key={r.id}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    {/* route + meta */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <RouteIcon className="size-4 text-primary" />
                        <p className="truncate font-medium">
                          {r.originLabel} → {r.destLabel}
                        </p>
                      </div>
                      <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <ClockIcon className="size-3.5" />{" "}
                        {new Date(r.departAt).toLocaleString([], {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        <span>·</span> {r.vehicle.brand} {r.vehicle.model}
                        {(r.vehicle.type === "EV" ||
                          r.vehicle.fuelType === "ELECTRIC") && <span>🍃</span>}
                      </p>
                    </div>
                    {/* fare + seats + status */}
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
                      <Badge variant={RIDE_VARIANT[r.status] ?? "secondary"}>
                        {r.status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                  </div>

                  {/* passengers */}
                  {(confirmed.length > 0 || requests.length > 0) && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      <span className="text-xs text-muted-foreground">
                        Passengers:
                      </span>
                      {confirmed.map((b) => (
                        <span
                          key={b.id}
                          className="flex items-center gap-1.5 rounded-full bg-secondary py-0.5 pr-2 pl-0.5 text-xs"
                        >
                          <Avatar className="size-5">
                            <AvatarFallback className="text-[9px]">
                              {initials(b.passenger.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          {b.passenger.fullName}
                        </span>
                      ))}
                      {requests.map((b) => (
                        <span
                          key={b.id}
                          className="flex items-center gap-1.5 rounded-full border border-dashed border-warning/50 py-0.5 pr-2 pl-0.5 text-xs text-muted-foreground"
                        >
                          <Avatar className="size-5">
                            <AvatarFallback className="text-[9px]">
                              {initials(b.passenger.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          {b.passenger.fullName} · pending
                        </span>
                      ))}
                    </div>
                  )}

                  {/* actions */}
                  <div className="mt-4 flex gap-2">
                    {r.trip &&
                      !["PAYMENT_COMPLETED", "CANCELLED"].includes(
                        r.trip.status
                      ) && (
                        <Button
                          size="sm"
                          variant="outline"
                          nativeButton={false}
                          render={<Link href={`/track/${r.trip.id}`} />}
                        >
                          Track / manage
                        </Button>
                      )}
                    {canCancel && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (
                            confirm(
                              "Cancel this ride? Booked passengers will be notified."
                            )
                          )
                            cancel.mutate(r.id)
                        }}
                        disabled={cancel.isPending}
                      >
                        Cancel ride
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
