"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import dynamic from "next/dynamic"
import { useQuery } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import { api } from "@/lib/api"
import { openCheckout, type RazorpayOrderInfo } from "@/lib/razorpay"
import { getSocket } from "@/lib/socket"
import { useAuth } from "@/stores/auth"
import { inr } from "@/lib/utils"
import { PageHeader } from "@repo/ui/page-header"
import { Card, CardContent } from "@repo/ui/card"
import { Button } from "@repo/ui/button"
import { Input } from "@repo/ui/input"
import { Badge } from "@repo/ui/badge"
import { Avatar, AvatarFallback } from "@repo/ui/avatar"
import {
  ClockIcon,
  PinIcon,
  RouteIcon,
  DriveIcon,
  VerifiedIcon,
  WalletIcon,
  RupeeIcon,
  PhoneIcon as IconPhone,
  SendIcon as IconSend,
  LockIcon as IconLock,
  CircleCheckIcon as IconCircleCheck,
  CashIcon as IconCash,
} from "@repo/ui/icons"
import type { MapMarker, VehicleInfo } from "@/components/maps/map-panel"

const MapPanel = dynamic(() => import("@/components/maps/map-panel"), {
  ssr: false,
  loading: () => (
    <div className="h-[440px] w-full animate-pulse rounded-xl bg-muted" />
  ),
})

interface Party {
  id: string
  fullName: string
  phone: string | null
}
interface PaymentInfo {
  status: string
  method: string
}
interface Booking {
  id: string
  status: string
  fareAmount: number
  pickupOtp: string | null
  pickupVerifiedAt: string | null
  pickupLat: string
  pickupLng: string
  passenger: Party
  payment: PaymentInfo | null
}
interface TripDetail {
  id: string
  status: string
  ride: {
    driverId: string
    originLabel: string
    originLat: string
    originLng: string
    destLabel: string
    destLat: string
    destLng: string
    driver: Party & { rating: string }
    vehicle: { type: string; fuelType: string; brand: string; model: string }
    bookings: Booking[]
  }
}
interface Msg {
  id: string
  senderId: string
  body: string | null
  createdAt: string
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

interface LL {
  lat: number
  lng: number
}
const toRad = (d: number) => (d * Math.PI) / 180
/** Meters between two coords — used to walk the simulation evenly along the route. */
function haversine(a: LL, b: LL): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

export default function TrackPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const me = useAuth((s) => s.user)

  const trip = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => api.get<TripDetail>(`/trips/${tripId}`),
    refetchInterval: 4000,
  })

  const [live, setLive] = useState<{ lat: number; lng: number } | null>(null)
  const [eta, setEta] = useState<number | null>(null)
  const [remainingM, setRemainingM] = useState<number | null>(null)
  const pickupReachedRef = useRef(false)
  const destReachedRef = useRef(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [otp, setOtp] = useState("")
  const [typingIds, setTypingIds] = useState<string[]>([])
  const [callOpen, setCallOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  // Optional post-ride rating popup.
  const [rateOpen, setRateOpen] = useState(false)
  const [stars, setStars] = useState(0)
  const [rComment, setRComment] = useState("")
  const ratePromptedRef = useRef(false)
  const simRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const t = trip.data
  const status = t?.status ?? ""
  const isDriver = t?.ride.driverId === me?.id
  const vehicle = t?.ride.vehicle
  const myBooking = t?.ride.bookings.find((b) => b.passenger.id === me?.id)
  const firstBooking = t?.ride.bookings[0]

  // Post-ride rating (optional): passenger rates the driver, driver rates the passenger.
  const ratee: Party | undefined = isDriver
    ? firstBooking?.passenger
    : t?.ride.driver
  const rateBookingId = isDriver ? firstBooking?.id : myBooking?.id
  useEffect(() => {
    if (status === "PAYMENT_COMPLETED" && !ratePromptedRef.current) {
      ratePromptedRef.current = true
      setRateOpen(true)
    }
  }, [status])
  async function submitRating() {
    if (!ratee || !rateBookingId || stars < 1) return
    try {
      await api.post("/reviews", {
        bookingId: rateBookingId,
        rateeId: ratee.id,
        role: isDriver ? "PASSENGER" : "DRIVER",
        rating: stars,
        comment: rComment || undefined,
      })
      toast.success("Thanks for your rating!")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit rating")
    }
    setRateOpen(false)
  }

  // Group chat: the driver + every confirmed passenger. Used for sender
  // attribution, the header roster, and the per-person call list.
  const confirmedBookings = (t?.ride.bookings ?? []).filter((b) =>
    ["CONFIRMED", "COMPLETED"].includes(b.status)
  )
  const roster: Party[] = t
    ? [t.ride.driver, ...confirmedBookings.map((b) => b.passenger)]
    : []
  const nameById = new Map(roster.map((p) => [p.id, p.fullName]))
  // Who this user can call: driver → each passenger; passenger → the driver.
  const callList: Party[] = isDriver
    ? confirmedBookings.map((b) => b.passenger)
    : t
      ? [t.ride.driver]
      : []

  const origin = useMemo(
    () => (t ? { lat: +t.ride.originLat, lng: +t.ride.originLng } : null),
    [t]
  )
  const dest = useMemo(
    () => (t ? { lat: +t.ride.destLat, lng: +t.ride.destLng } : null),
    [t]
  )
  const pickupPt = useMemo(
    () =>
      firstBooking
        ? { lat: +firstBooking.pickupLat, lng: +firstBooking.pickupLng }
        : null,
    [firstBooking]
  )

  // The journey has TWO legs: (1) driver → passenger pickup (during DRIVER_STARTED),
  // then after OTP verification (2) pickup → destination (during IN_PROGRESS).
  // Only reaching the DESTINATION on leg 2 auto-completes the ride.
  const inDestPhase = [
    "IN_PROGRESS",
    "REACHED",
    "PAYMENT_PENDING",
    "PAYMENT_COMPLETED",
  ].includes(status)
  const legStart = inDestPhase ? (pickupPt ?? origin) : origin
  const legEnd = inDestPhase ? dest : (pickupPt ?? dest)
  const legName = inDestPhase ? "destination" : "pickup"

  // Road-following route for the CURRENT leg from Google Directions.
  const route = useQuery({
    queryKey: [
      "directions",
      legName,
      legStart?.lat,
      legStart?.lng,
      legEnd?.lat,
      legEnd?.lng,
    ],
    queryFn: () =>
      api.get<{ points: LL[]; distanceM: number; durationS: number }>(
        `/maps/directions?oLat=${legStart!.lat}&oLng=${legStart!.lng}&dLat=${legEnd!.lat}&dLng=${legEnd!.lng}`
      ),
    enabled: !!legStart && !!legEnd,
    staleTime: Infinity,
  })
  const routePoints = route.data?.points

  // ── Pre-trip planning (driver, BOOKED): show ALL pickups + the optimized order ──
  const planning = isDriver && status === "BOOKED"
  const pickups = (t?.ride.bookings ?? [])
    .filter((b) => ["CONFIRMED", "COMPLETED"].includes(b.status))
    .map((b) => ({
      lat: +b.pickupLat,
      lng: +b.pickupLng,
      name: b.passenger.fullName,
      bookingId: b.id,
    }))

  const routePlan = useQuery({
    queryKey: ["route-plan", tripId, pickups.map((p) => p.bookingId).join(",")],
    queryFn: () =>
      api.post<{
        points: LL[]
        order: number[]
        distanceM: number
        durationS: number
      }>("/maps/route-plan", {
        origin,
        destination: dest,
        waypoints: pickups.map((p) => ({ lat: p.lat, lng: p.lng })),
      }),
    enabled: planning && !!origin && !!dest && pickups.length > 0,
    staleTime: Infinity,
  })
  const orderedPickups = (routePlan.data?.order ?? pickups.map((_, i) => i))
    .map((i) => pickups[i])
    .filter((p): p is (typeof pickups)[number] => !!p)

  useEffect(() => {
    if (!tripId) return
    const socket = getSocket()
    socket.emit("trip:join", { tripId })
    const onLoc = (d: {
      lat: number
      lng: number
      eta?: number
      remainingM?: number
    }) => {
      setLive({ lat: d.lat, lng: d.lng })
      if (typeof d.eta === "number") setEta(d.eta)
      if (typeof d.remainingM === "number") setRemainingM(d.remainingM)
    }
    const onMsg = (m: Msg) =>
      setMessages((p) => (p.some((x) => x.id === m.id) ? p : [...p, m]))
    const onArrival = () => toast.success("Driver is arriving!")
    const onTypeStart = (d: { userId?: string }) =>
      setTypingIds((ids) =>
        d.userId && !ids.includes(d.userId) ? [...ids, d.userId] : ids
      )
    const onTypeStop = (d: { userId?: string }) =>
      setTypingIds((ids) => ids.filter((id) => id !== d.userId))
    const onNotify = () => trip.refetch()
    socket.on("location:update", onLoc)
    socket.on("message:new", onMsg)
    socket.on("arrival:alert", onArrival)
    socket.on("typing:start", onTypeStart)
    socket.on("typing:stop", onTypeStop)
    socket.on("notify:new", onNotify)
    return () => {
      socket.off("location:update", onLoc)
      socket.off("message:new", onMsg)
      socket.off("arrival:alert", onArrival)
      socket.off("typing:start", onTypeStart)
      socket.off("typing:stop", onTypeStop)
      socket.off("notify:new", onNotify)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId])

  useEffect(() => {
    if (tripId)
      api
        .get<Msg[]>(`/trips/${tripId}/messages`)
        .then(setMessages)
        .catch(() => {})
  }, [tripId])
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, typingIds])
  useEffect(
    () => () => {
      if (simRef.current) clearInterval(simRef.current)
    },
    []
  )

  const act = async (fn: () => Promise<unknown>, okMsg?: string) => {
    setBusy(true)
    try {
      await fn()
      if (okMsg) toast.success(okMsg)
      await trip.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally {
      setBusy(false)
    }
  }

  const startTrip = () =>
    act(
      () => api.post(`/trips/${tripId}/start`),
      "Trip started — head to pickup"
    )
  const verifyPickup = () =>
    act(async () => {
      await api.post(`/trips/${tripId}/verify-pickup`, {
        bookingId: firstBooking!.id,
        otp,
      })
      setOtp("")
    }, "Pickup verified — ride started")
  const complete = () =>
    act(() => api.post(`/trips/${tripId}/complete`), "Reached destination")
  const payWallet = () =>
    act(
      () =>
        api.post("/payments", { bookingId: myBooking!.id, method: "WALLET" }),
      "Paid via wallet"
    )
  const payCash = () =>
    act(
      () => api.post("/payments", { bookingId: myBooking!.id, method: "CASH" }),
      "Cash selected — waiting for driver to confirm"
    )
  const payUpi = () =>
    act(async () => {
      const order = await api.post<RazorpayOrderInfo>("/payments/order", {
        bookingId: myBooking!.id,
        method: "UPI",
      })
      const r = await openCheckout(order, "RideBuddy")
      await api.post("/payments/verify", {
        orderId: r.razorpay_order_id,
        paymentId: r.razorpay_payment_id,
        signature: r.razorpay_signature,
      })
    }, "Payment successful")
  const confirmCash = (bookingId: string) =>
    act(() => api.post(`/payments/${bookingId}/confirm-cash`), "Cash confirmed")

  // Two-phase auto-arrival:
  //  • Reaching the PASSENGER (leg 1) prompts OTP — it does NOT complete the ride.
  //  • Reaching the DESTINATION (leg 2) auto-completes and opens payment.
  useEffect(() => {
    if (!isDriver || remainingM == null || remainingM >= 60) return
    if (status === "DRIVER_STARTED" && !pickupReachedRef.current) {
      pickupReachedRef.current = true
      toast("Reached the passenger — enter their OTP to start the ride.", {
        icon: "📍",
      })
    } else if (status === "IN_PROGRESS" && !destReachedRef.current) {
      destReachedRef.current = true
      toast.success("Arrived at destination")
      complete()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDriver, status, remainingM])

  /**
   * Drive the car along the real route polyline (road geometry, turns and all).
   * Paced by target wall-clock duration — normal is a ~25s demo cruise, `fast`
   * finishes in ~1.5s. A steady ~40 km/h is published so the ETA counts down
   * realistically regardless of playback speed. Realtime service does the rest.
   */
  function simulateDrive(fast = false) {
    const pts: LL[] | null =
      routePoints && routePoints.length > 1
        ? routePoints
        : legStart && legEnd
          ? [legStart, legEnd]
          : null
    if (!pts) return
    if (simRef.current) clearInterval(simRef.current)
    const socket = getSocket()
    let total = 0
    for (let i = 0; i < pts.length - 1; i++)
      total += haversine(pts[i]!, pts[i + 1]!)
    const durationMs = fast ? 1500 : 25000
    const tickMs = fast ? 40 : 350
    const stepM = Math.max(1, total / (durationMs / tickMs))
    let seg = 0
    let into = 0 // meters travelled into the current segment
    simRef.current = setInterval(() => {
      let remain = stepM
      while (remain > 0 && seg < pts.length - 1) {
        const segLen = haversine(pts[seg]!, pts[seg + 1]!) || 0.0001
        if (into + remain < segLen) {
          into += remain
          remain = 0
        } else {
          remain -= segLen - into
          seg += 1
          into = 0
        }
      }
      if (seg >= pts.length - 1) {
        const last = pts[pts.length - 1]!
        socket.emit("location:publish", {
          tripId,
          lat: last.lat,
          lng: last.lng,
          speed: 0,
        })
        if (simRef.current) {
          clearInterval(simRef.current)
          simRef.current = null
        }
        return
      }
      const a = pts[seg]!
      const b = pts[seg + 1]!
      const f = into / (haversine(a, b) || 0.0001)
      socket.emit("location:publish", {
        tripId,
        lat: a.lat + (b.lat - a.lat) * f,
        lng: a.lng + (b.lng - a.lng) * f,
        speed: 11, // ~40 km/h — keeps ETA realistic
      })
    }, tickMs)
  }

  function send() {
    if (!input.trim()) return
    getSocket().emit("message:send", {
      tripId,
      body: input.trim(),
      type: "TEXT",
    })
    setInput("")
    getSocket().emit("typing:stop", { tripId })
  }

  // Pins are labelled with the person there (click a pin → their name).
  const driverName = t?.ride.driver.fullName
  const paxName = firstBooking?.passenger.fullName
  const markers: MapMarker[] = []
  let path: [number, number][] | undefined

  if (planning) {
    // Whole trip overview: driver start + every pickup (numbered by optimal order) + destination.
    if (origin)
      markers.push({
        ...origin,
        label: driverName ? `${driverName} · start` : "Start",
        color: "#2563eb",
      })
    orderedPickups.forEach((p, i) =>
      markers.push({
        lat: p.lat,
        lng: p.lng,
        label: `${i + 1}. ${p.name}`,
        color: "#059669",
      })
    )
    if (dest)
      markers.push({
        ...dest,
        label: t?.ride.destLabel ?? "Destination",
        color: "#e11d48",
      })
    const planPts = routePlan.data?.points
    path =
      planPts && planPts.length > 1
        ? planPts.map((p) => [p.lat, p.lng] as [number, number])
        : undefined
  } else {
    // Active trip: current leg only (driver→pickup, then pickup→destination).
    if (legStart)
      markers.push({
        ...legStart,
        label: inDestPhase ? paxName : driverName,
        color: "#059669",
      })
    if (legEnd)
      markers.push({
        ...legEnd,
        label: inDestPhase ? t?.ride.destLabel : paxName,
        color: "#e11d48",
      })
    path =
      routePoints && routePoints.length > 1
        ? routePoints.map((p) => [p.lat, p.lng] as [number, number])
        : legStart && legEnd
          ? [
              [legStart.lat, legStart.lng],
              [legEnd.lat, legEnd.lng],
            ]
          : undefined
  }
  const active = ["DRIVER_STARTED", "PASSENGER_PICKED", "IN_PROGRESS"].includes(
    status
  )
  const vInfo: VehicleInfo | undefined = vehicle
    ? { type: vehicle.type, fuelType: vehicle.fuelType }
    : undefined

  return (
    <div>
      <PageHeader
        title="Live Trip Tracking"
        description={
          t ? `${t.ride.originLabel} → ${t.ride.destLabel}` : "Loading…"
        }
        action={
          <Badge
            variant={
              active
                ? "info"
                : status === "PAYMENT_COMPLETED"
                  ? "eco"
                  : "secondary"
            }
          >
            {(status || "…").replaceAll("_", " ")}
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <MapPanel
            markers={markers}
            live={live}
            vehicle={vInfo}
            path={path}
            center={origin ? [origin.lat, origin.lng] : undefined}
            className="h-[420px] w-full overflow-hidden rounded-xl border border-border"
          />

          {/* ETA row */}
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-5 text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <ClockIcon className="size-4" /> ETA{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {eta != null
                      ? `${Math.max(0, Math.round(eta / 60))} min`
                      : "—"}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <RouteIcon className="size-4" />{" "}
                  {live ? "Tracking live" : "Awaiting driver"}
                </span>
                {vehicle && (
                  <span className="text-xs text-muted-foreground">
                    {vehicle.brand} {vehicle.model}
                    {vehicle.type === "EV" || vehicle.fuelType === "ELECTRIC"
                      ? " · EV 🍃"
                      : ""}
                  </span>
                )}
              </div>
              {isDriver && active && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => simulateDrive(false)}
                  >
                    <PinIcon /> Simulate drive
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => simulateDrive(true)}
                    title="Fast-forward the whole trip"
                  >
                    ⚡ Instant
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Flow card — changes by status + role */}
          <FlowCard>
            {status === "BOOKED" && isDriver && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Suggested pickup plan</p>
                    <p className="text-sm text-muted-foreground">
                      {orderedPickups.length} passenger
                      {orderedPickups.length === 1 ? "" : "s"}
                      {routePlan.data
                        ? ` · ${(routePlan.data.distanceM / 1000).toFixed(1)} km · ${Math.round(routePlan.data.durationS / 60)} min`
                        : ""}
                    </p>
                  </div>
                  <Button onClick={startTrip} disabled={busy}>
                    <DriveIcon /> Start trip
                  </Button>
                </div>
                <ol className="space-y-1.5">
                  {orderedPickups.map((p, i) => (
                    <li
                      key={p.bookingId}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                        {i + 1}
                      </span>
                      Pick up <span className="font-medium">{p.name}</span>
                    </li>
                  ))}
                  <li className="flex items-center gap-2 text-sm">
                    <span className="text-destructive-foreground flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive text-[11px] font-semibold">
                      ★
                    </span>
                    Drop everyone at{" "}
                    <span className="font-medium">{t?.ride.destLabel}</span>
                  </li>
                </ol>
              </div>
            )}
            {status === "BOOKED" && !isDriver && (
              <Info
                icon={<ClockIcon className="size-5" />}
                title="Waiting for driver"
                desc="Your driver will start the trip shortly."
              />
            )}

            {status === "DRIVER_STARTED" && !isDriver && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Share this pickup code with your driver
                </p>
                <p className="mt-2 text-4xl font-semibold tracking-[0.4em] text-primary tabular-nums">
                  {myBooking?.pickupOtp ?? "----"}
                </p>
                <p className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <IconLock className="size-3" /> Verified at pickup to start
                  the ride
                </p>
              </div>
            )}
            {status === "DRIVER_STARTED" && isDriver && (
              <Action
                title="Verify pickup"
                desc={`Ask ${firstBooking?.passenger.fullName ?? "your passenger"} for their 4-digit code.`}
              >
                <div className="flex items-center gap-2">
                  <Input
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    placeholder="1234"
                    maxLength={4}
                    className="w-24 text-center text-lg tracking-[0.3em]"
                  />
                  <Button
                    onClick={verifyPickup}
                    disabled={busy || otp.length !== 4}
                  >
                    <VerifiedIcon /> Verify & start
                  </Button>
                </div>
              </Action>
            )}

            {status === "IN_PROGRESS" && isDriver && (
              <Info
                icon={<RouteIcon className="size-5" />}
                title="Ride in progress"
                desc="Arrival is detected automatically — payment opens on reaching the destination."
              />
            )}
            {status === "IN_PROGRESS" && !isDriver && (
              <Info
                icon={<RouteIcon className="size-5" />}
                title="On the way"
                desc="Enjoy your ride — you'll pay once you arrive."
              />
            )}

            {status === "PAYMENT_PENDING" &&
              !isDriver &&
              (myBooking?.payment?.method === "CASH" &&
              myBooking?.payment?.status !== "PAID" ? (
                <Info
                  icon={<IconCash className="size-5" />}
                  title="Cash selected"
                  desc="Waiting for your driver to confirm they received the cash."
                />
              ) : (
                <Action
                  title="Payment"
                  desc={`Trip complete. Pay ${inr(myBooking?.fareAmount ?? 0)} to finish.`}
                >
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={payWallet}
                      disabled={busy}
                    >
                      <WalletIcon /> Wallet
                    </Button>
                    <Button variant="outline" onClick={payCash} disabled={busy}>
                      <IconCash className="size-4" /> Cash
                    </Button>
                    <Button
                      onClick={payUpi}
                      disabled={busy}
                      title="Test UPI: success@razorpay"
                    >
                      <RupeeIcon /> UPI / Card
                    </Button>
                  </div>
                </Action>
              ))}
            {status === "PAYMENT_PENDING" && isDriver && (
              <div className="space-y-2">
                <p className="font-medium">Collect payment</p>
                {(t?.ride.bookings ?? [])
                  .filter((b) => b.status === "COMPLETED")
                  .map((b) => {
                    const paid = b.payment?.status === "PAID"
                    const cashPending = b.payment?.method === "CASH" && !paid
                    return (
                      <div
                        key={b.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {b.passenger.fullName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {inr(b.fareAmount)}
                            {b.payment?.method ? ` · ${b.payment.method}` : ""}
                          </p>
                        </div>
                        {paid ? (
                          <Badge variant="eco" className="gap-1">
                            <IconCircleCheck className="size-3" /> Paid
                          </Badge>
                        ) : cashPending ? (
                          <Button
                            size="sm"
                            onClick={() => confirmCash(b.id)}
                            disabled={busy}
                          >
                            <IconCash className="size-4" /> Confirm cash
                          </Button>
                        ) : (
                          <Badge variant="secondary">Awaiting</Badge>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}

            {status === "PAYMENT_COMPLETED" && (
              <div className="flex flex-col items-center py-2 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-[var(--success)] text-white">
                  <IconCircleCheck className="size-7" />
                </span>
                <p className="mt-3 text-lg font-semibold">Ride completed 🎉</p>
                <p className="text-sm text-muted-foreground">
                  Payment received. Thanks for sharing the ride!
                </p>
              </div>
            )}
            {status === "CANCELLED" && (
              <Info
                icon={<PinIcon className="size-5" />}
                title="Trip cancelled"
                desc="This trip was cancelled."
              />
            )}
          </FlowCard>
        </div>

        {/* Chat */}
        <Card className="flex h-[560px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex -space-x-2">
                {roster.slice(0, 3).map((p) => (
                  <Avatar key={p.id} className="size-8 ring-2 ring-card">
                    <AvatarFallback className="text-[11px]">
                      {initials(p.fullName)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-medium">Trip chat</p>
                <p className="truncate text-xs text-muted-foreground">
                  {roster.length} participant{roster.length === 1 ? "" : "s"} ·
                  driver + {confirmedBookings.length} passenger
                  {confirmedBookings.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            {callList.length === 1 && callList[0]?.phone ? (
              <Button
                size="icon"
                variant="outline"
                title={`Call ${callList[0].fullName}`}
                nativeButton={false}
                render={<a href={`tel:${callList[0].phone}`} />}
              >
                <IconPhone className="size-4" />
              </Button>
            ) : callList.length > 1 ? (
              <div className="relative">
                <Button
                  size="icon"
                  variant="outline"
                  title="Call a passenger"
                  onClick={() => setCallOpen((o) => !o)}
                >
                  <IconPhone className="size-4" />
                </Button>
                {callOpen && (
                  <div className="absolute right-0 z-50 mt-1 w-48 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
                    {callList.map((p) => (
                      <a
                        key={p.id}
                        href={p.phone ? `tel:${p.phone}` : undefined}
                        onClick={() => setCallOpen(false)}
                        className={`flex items-center justify-between px-3 py-2 text-sm hover:bg-accent ${p.phone ? "" : "pointer-events-none opacity-50"}`}
                      >
                        <span className="truncate">{p.fullName}</span>
                        <IconPhone className="size-3.5 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <div className="flex-1 scrollbar-thin space-y-2 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="mt-6 text-center text-xs text-muted-foreground">
                No messages yet. Coordinate your pickup here.
              </p>
            )}
            {messages.map((m) => {
              const mine = m.senderId === me?.id
              const senderName = nameById.get(m.senderId) ?? "Someone"
              return (
                <div
                  key={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[78%] rounded-2xl px-3 py-2 ${mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted"}`}
                  >
                    {/* Group chat: attribute each incoming message to its sender. */}
                    {!mine && (
                      <p className="mb-0.5 text-[11px] font-semibold text-primary">
                        {senderName}
                      </p>
                    )}
                    <p className="text-sm">{m.body}</p>
                    <p
                      className={`mt-0.5 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                    >
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              )
            })}
            {typingIds.filter((id) => id !== me?.id).length > 0 && (
              <p className="text-xs text-muted-foreground italic">
                {typingIds
                  .filter((id) => id !== me?.id)
                  .map((id) => nameById.get(id) ?? "Someone")
                  .join(", ")}{" "}
                typing…
              </p>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="flex items-center gap-2 border-t border-border p-3">
            <Input
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                getSocket().emit("typing:start", { tripId })
              }}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Message…"
            />
            <Button size="icon" onClick={send}>
              <IconSend className="size-4" />
            </Button>
          </div>
        </Card>
      </div>

      {/* Optional post-ride rating popup */}
      {rateOpen && ratee && rateBookingId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setRateOpen(false)}
        >
          <Card
            className="w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="space-y-4 p-6 text-center">
              <div>
                <p className="text-lg font-semibold">
                  Rate your {isDriver ? "passenger" : "driver"}
                </p>
                <p className="text-sm text-muted-foreground">
                  How was your ride with {ratee.fullName}?
                </p>
              </div>
              <div className="flex justify-center gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setStars(n)}
                    className="text-4xl leading-none transition-transform hover:scale-110"
                    aria-label={`${n} star`}
                  >
                    <span
                      className={
                        n <= stars
                          ? "text-[var(--gold)]"
                          : "text-muted-foreground/30"
                      }
                    >
                      ★
                    </span>
                  </button>
                ))}
              </div>
              <textarea
                value={rComment}
                onChange={(e) => setRComment(e.target.value)}
                rows={3}
                placeholder="Add a comment (optional)"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              />
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={submitRating}
                  disabled={stars < 1}
                >
                  Submit rating
                </Button>
                <Button variant="ghost" onClick={() => setRateOpen(false)}>
                  Skip
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function FlowCard({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  )
}
function Action({
  title,
  desc,
  children,
}: {
  title: string
  desc: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      {children}
    </div>
  )
}
function Info({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
        {icon}
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  )
}
