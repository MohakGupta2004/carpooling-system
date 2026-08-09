"use client"

import type { ComponentProps } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import { api } from "@/lib/api"
import { openCheckout, type RazorpayOrderInfo } from "@/lib/razorpay"
import { inr } from "@/lib/utils"
import { PageHeader } from "@repo/ui/page-header"
import { Card, CardContent } from "@repo/ui/card"
import { Button } from "@repo/ui/button"
import { Badge } from "@repo/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/tabs"
import { Skeleton } from "@repo/ui/skeleton"

interface Trip {
  id: string
  status: string
}
interface DriverRide {
  id: string
  originLabel: string
  destLabel: string
  departAt: string
  farePerSeat: number
  trip: Trip | null
  bookings: { id: string; passenger: { fullName: string } }[]
}
interface PassengerBooking {
  id: string
  status: string
  fareAmount: number
  ride: {
    originLabel: string
    destLabel: string
    departAt: string
    driver: { fullName: string }
    trip: Trip | null
  }
}

const STATUS_VARIANT: Record<string, ComponentProps<typeof Badge>["variant"]> =
  {
    PUBLISHED: "info",
    BOOKED: "secondary",
    DRIVER_STARTED: "info",
    IN_PROGRESS: "info",
    COMPLETED: "eco",
    PAYMENT_PENDING: "warning",
    PAYMENT_COMPLETED: "eco",
  }

export default function TripsPage() {
  const qc = useQueryClient()
  const trips = useQuery({
    queryKey: ["trips", "mine"],
    queryFn: () =>
      api.get<{ asDriver: DriverRide[]; asPassenger: PassengerBooking[] }>(
        "/trips/mine"
      ),
  })

  const action = useMutation({
    mutationFn: ({ tripId, verb }: { tripId: string; verb: string }) =>
      api.post(`/trips/${tripId}/${verb}`),
    onSuccess: () => {
      toast.success("Trip updated")
      qc.invalidateQueries({ queryKey: ["trips", "mine"] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  })

  const pay = useMutation({
    mutationFn: (bookingId: string) =>
      api.post("/payments", { bookingId, method: "WALLET" }),
    onSuccess: () => {
      toast.success("Paid via wallet")
      qc.invalidateQueries({ queryKey: ["trips", "mine"] })
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Payment failed"),
  })

  const payGateway = useMutation({
    mutationFn: async (bookingId: string) => {
      const order = await api.post<RazorpayOrderInfo>("/payments/order", {
        bookingId,
        method: "UPI",
      })
      const result = await openCheckout(order, "WorkWay")
      await api.post("/payments/verify", {
        orderId: result.razorpay_order_id,
        paymentId: result.razorpay_payment_id,
        signature: result.razorpay_signature,
      })
    },
    onSuccess: () => {
      toast.success("Payment successful")
      qc.invalidateQueries({ queryKey: ["trips", "mine"] })
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Payment failed"),
  })

  return (
    <div>
      <PageHeader
        title="My Trips"
        description="Rides you're driving and rides you've booked."
      />
      {trips.isLoading ? (
        <Skeleton className="h-40" />
      ) : (
        <Tabs defaultValue="passenger">
          <TabsList>
            <TabsTrigger value="passenger">
              As passenger ({trips.data?.asPassenger.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="driver">
              As driver ({trips.data?.asDriver.length ?? 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="passenger" className="space-y-3">
            {trips.data?.asPassenger.map((b) => (
              <Card key={b.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <p className="font-medium">
                      {b.ride.originLabel} → {b.ride.destLabel}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Driver: {b.ride.driver.fullName} ·{" "}
                      {new Date(b.ride.departAt).toLocaleString()}
                    </p>
                    <Badge
                      variant={
                        STATUS_VARIANT[b.ride.trip?.status ?? ""] ?? "secondary"
                      }
                      className="mt-1"
                    >
                      {(b.ride.trip?.status ?? b.status).replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">
                      {inr(b.fareAmount)}
                    </p>
                    <div className="mt-2 flex justify-end gap-2">
                      {b.ride.trip && (
                        <Button
                          size="sm"
                          variant="ghost"
                          nativeButton={false}
                          render={<Link href={`/trips/${b.ride.trip.id}`} />}
                        >
                          View details
                        </Button>
                      )}
                      {b.ride.trip &&
                        !["PAYMENT_COMPLETED", "CANCELLED"].includes(
                          b.ride.trip.status
                        ) && (
                          <Button
                            size="sm"
                            variant="outline"
                            nativeButton={false}
                            render={<Link href={`/track/${b.ride.trip.id}`} />}
                          >
                            Track
                          </Button>
                        )}
                    </div>
                    {b.status === "COMPLETED" &&
                      b.ride.trip?.status === "PAYMENT_PENDING" && (
                        <div className="mt-2 flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => pay.mutate(b.id)}
                            disabled={pay.isPending}
                          >
                            Wallet
                          </Button>
                          <Button
                            size="sm"
                            title="Test mode: pay with UPI ID success@razorpay"
                            onClick={() => payGateway.mutate(b.id)}
                            disabled={payGateway.isPending}
                          >
                            Pay UPI/Card
                          </Button>
                        </div>
                      )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {trips.data?.asPassenger.length === 0 && (
              <Empty text="No booked rides yet." />
            )}
          </TabsContent>

          <TabsContent value="driver" className="space-y-3">
            {trips.data?.asDriver.map((r) => {
              const noPax = r.bookings.length === 0
              // A published, not-yet-booked ride sits at trip status BOOKED — show it as PUBLISHED.
              const statusLabel =
                r.trip?.status === "BOOKED" && noPax
                  ? "PUBLISHED"
                  : (r.trip?.status ?? "PUBLISHED")
              return (
                <Card key={r.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div>
                      <p className="font-medium">
                        {r.originLabel} → {r.destLabel}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {r.bookings.length} passenger(s) ·{" "}
                        {new Date(r.departAt).toLocaleString()}
                      </p>
                      <Badge
                        variant={STATUS_VARIANT[statusLabel] ?? "secondary"}
                        className="mt-1"
                      >
                        {statusLabel.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      {r.trip && (
                        <Button
                          size="sm"
                          variant="ghost"
                          nativeButton={false}
                          render={<Link href={`/trips/${r.trip.id}`} />}
                        >
                          View details
                        </Button>
                      )}
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
                            Track
                          </Button>
                        )}
                      {r.trip?.status === "BOOKED" && !noPax && (
                        <Button
                          size="sm"
                          onClick={() =>
                            action.mutate({ tripId: r.trip!.id, verb: "start" })
                          }
                        >
                          Start trip
                        </Button>
                      )}
                      {r.trip?.status === "DRIVER_STARTED" && (
                        <Button
                          size="sm"
                          onClick={() =>
                            action.mutate({
                              tripId: r.trip!.id,
                              verb: "progress",
                            })
                          }
                        >
                          In progress
                        </Button>
                      )}
                      {r.trip?.status === "IN_PROGRESS" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            action.mutate({
                              tripId: r.trip!.id,
                              verb: "complete",
                            })
                          }
                        >
                          Complete
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
            {trips.data?.asDriver.length === 0 && (
              <Empty text="You haven't offered any rides yet." />
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="p-8 text-center text-sm text-muted-foreground">
        {text}
      </CardContent>
    </Card>
  )
}
