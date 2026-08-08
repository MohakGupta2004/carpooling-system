"use client"

import { useEffect, useRef, useState } from "react"
import { GoogleMap, MarkerF, InfoWindowF } from "@react-google-maps/api"
import { MAPS_KEY, useMaps } from "./use-maps"

export interface MapMarker {
  lat: number
  lng: number
  label?: string
  color?: string
}

export interface VehicleInfo {
  type: string // CAR | BIKE | EV
  fuelType: string // ELECTRIC | PETROL | ...
}

interface Props {
  markers: MapMarker[]
  live?: { lat: number; lng: number } | null
  vehicle?: VehicleInfo
  path?: [number, number][]
  center?: [number, number]
  className?: string
}

const LIGHT_BLUE = "#93c5fd" // full route base → becomes the "travelled" trail once moving
const BLUE = "#2563eb" // remaining route + live dot

// Location-pin marker drawn from an inline SVG, tinted per marker so different
// passengers/riders are visually distinct. Tip is anchored on the coordinate.
const PIN_D =
  "M256,0C153.755,0,70.573,83.182,70.573,185.426c0,126.888,165.939,313.167,173.004,321.035c6.636,7.391,18.222,7.378,24.846,0c7.065-7.868,173.004-194.147,173.004-321.035C441.425,83.182,358.244,0,256,0z M256,278.719c-51.442,0-93.292-41.851-93.292-93.293S204.559,92.134,256,92.134s93.291,41.851,93.291,93.293S307.441,278.719,256,278.719z"
const pinSvg = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="42" height="42"><path fill="${color}" stroke="#ffffff" stroke-width="20" stroke-linejoin="round" d="${PIN_D}"/></svg>`
function pinIcon(color: string): google.maps.Icon {
  const svg = pinSvg(color)
  // base64 data URI renders more reliably as a Google Maps marker icon than a
  // URL-encoded one (no issues with the `#` in colors).
  const url =
    typeof window !== "undefined"
      ? `data:image/svg+xml;base64,${window.btoa(svg)}`
      : `data:image/svg+xml,${encodeURIComponent(svg)}`
  return {
    url,
    scaledSize: new google.maps.Size(42, 42),
    anchor: new google.maps.Point(21, 42), // bottom-center tip sits on the point
  }
}

// Google Maps throws on any non-finite coordinate — guard everything we pass it.
const okPt = (p: { lat: number; lng: number }) =>
  Number.isFinite(p.lat) && Number.isFinite(p.lng)

/**
 * Imperative overlay layer. Objects are created once and UPDATED in place — never
 * recreated on re-render — so the map never flickers as live locations stream in.
 *  - Whole route is blue initially; once moving, the travelled part shows light
 *    blue and the portion still REMAINING (current position →
 *    destination) is drawn blue on top, so it recedes as the driver progresses.
 *  - Origin/destination are pin markers.
 *  - The live position is a blue dot that emits a glowing pulse on every update.
 */
function Overlays({
  map,
  markers,
  live,
  path,
}: Omit<Props, "center" | "className"> & { map: google.maps.Map | null }) {
  const fullRef = useRef<google.maps.Polyline | null>(null) // whole route (light blue base)
  const remainRef = useRef<google.maps.Polyline | null>(null) // remaining (blue)
  const dotRef = useRef<google.maps.Marker | null>(null)
  const haloRef = useRef<google.maps.Marker | null>(null)
  const animRef = useRef<number | null>(null)
  const fittedRef = useRef(false)

  const validMarkers = markers.filter(okPt)
  const pathPts = (path ?? []).map(([lat, lng]) => ({ lat, lng })).filter(okPt)
  const wpKey = validMarkers
    .map((m) => `${m.lat},${m.lng},${m.color}`)
    .join("|")
  const pathKey = pathPts.length
    ? `${pathPts.length}:${pathPts[0]!.lat},${pathPts.at(-1)!.lat}`
    : ""

  // Full route — light-blue base line. Created once, setPath in place.
  useEffect(() => {
    if (!map) return
    if (pathPts.length < 2) {
      fullRef.current?.setMap(null)
      fullRef.current = null
      return
    }
    if (!fullRef.current) {
      fullRef.current = new google.maps.Polyline({
        map,
        strokeColor: LIGHT_BLUE,
        strokeWeight: 7,
        strokeOpacity: 0.9,
        zIndex: 1,
      })
    }
    fullRef.current.setPath(pathPts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, pathKey])

  // Remaining portion — blue, from the driver's current position to the
  // destination (or the whole route before the driver starts moving).
  useEffect(() => {
    if (!map) return
    if (pathPts.length < 2) {
      remainRef.current?.setPath([])
      return
    }
    let remaining: google.maps.LatLngLiteral[]
    if (live && okPt(live)) {
      let best = 0
      let bestD = Infinity
      for (let i = 0; i < pathPts.length; i++) {
        const dx = pathPts[i]!.lat - live.lat
        const dy = pathPts[i]!.lng - live.lng
        const d = dx * dx + dy * dy
        if (d < bestD) {
          bestD = d
          best = i
        }
      }
      remaining = [live, ...pathPts.slice(best + 1)]
    } else {
      remaining = pathPts
    }
    if (!remainRef.current) {
      remainRef.current = new google.maps.Polyline({
        map,
        strokeColor: BLUE,
        strokeWeight: 7,
        strokeOpacity: 1,
        zIndex: 2,
      })
    }
    remainRef.current.setPath(remaining)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, live, pathKey])

  // Re-fit when the route geometry changes (e.g. the pickup→destination leg switch).
  useEffect(() => {
    fittedRef.current = false
  }, [pathKey])

  // Fit bounds when geometry (re)appears — not on live updates.
  useEffect(() => {
    if (!map || fittedRef.current) return
    const pts = [
      ...validMarkers.map((m) => ({ lat: m.lat, lng: m.lng })),
      ...pathPts,
    ]
    if (pts.length > 1) {
      const b = new google.maps.LatLngBounds()
      pts.forEach((p) => b.extend(p))
      map.fitBounds(b, 60)
      fittedRef.current = true
    } else if (pts.length === 1) {
      map.setCenter(pts[0]!)
      map.setZoom(14)
      fittedRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, wpKey, pathKey])

  // Live position — a blue dot (created once, moved in place) with a glowing
  // halo that pulses out on every location update.
  useEffect(() => {
    if (!map) return
    if (!haloRef.current) {
      haloRef.current = new google.maps.Marker({
        map,
        clickable: false,
        zIndex: 998,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: BLUE,
          fillOpacity: 0,
          strokeWeight: 0,
        },
      })
    }
    if (!dotRef.current) {
      dotRef.current = new google.maps.Marker({
        map,
        title: "Driver — live",
        zIndex: 1000,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: BLUE,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
      })
    }
    if (live && okPt(live)) {
      dotRef.current.setPosition(live)
      haloRef.current.setPosition(live)
      map.panTo(live)

      // Pulse the halo: grow + fade out once per update ("glowing on updates").
      if (animRef.current) cancelAnimationFrame(animRef.current)
      const start = performance.now()
      const DUR = 900
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / DUR)
        haloRef.current?.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12 + t * 28,
          fillColor: BLUE,
          fillOpacity: 0.32 * (1 - t),
          strokeWeight: 0,
        })
        if (t < 1) animRef.current = requestAnimationFrame(tick)
      }
      animRef.current = requestAnimationFrame(tick)
    }
  }, [map, live])

  // Tear everything down on unmount.
  useEffect(
    () => () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      fullRef.current?.setMap(null)
      fullRef.current = null
      remainRef.current?.setMap(null)
      remainRef.current = null
      dotRef.current?.setMap(null)
      dotRef.current = null
      haloRef.current?.setMap(null)
      haloRef.current = null
    },
    []
  )

  return null
}

/**
 * Origin/destination pins, rendered with the library's <MarkerF> so they attach
 * to the map declaratively. Icons build a google.maps.Size/Point, so this only
 * renders once the Maps JS API script has loaded.
 */
function WaypointMarkers({ markers }: { markers: MapMarker[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const keyOf = (m: MapMarker) => `${m.lat},${m.lng},${m.color}`
  const visible = markers.filter(okPt)
  return (
    <>
      {visible.map((m) => {
        const key = keyOf(m)
        return (
          <MarkerF
            key={key}
            position={{ lat: m.lat, lng: m.lng }}
            title={m.label}
            zIndex={500}
            icon={pinIcon(m.color ?? "#059669")}
            onClick={() => setOpenKey((k) => (k === key ? null : key))}
          />
        )
      })}
      {visible.map((m) => {
        const key = keyOf(m)
        if (openKey !== key || !m.label) return null
        return (
          <InfoWindowF
            key={`iw-${key}`}
            position={{ lat: m.lat, lng: m.lng }}
            options={{ pixelOffset: new google.maps.Size(0, -42) }}
            onCloseClick={() => setOpenKey(null)}
          >
            <span style={{ fontWeight: 600, fontSize: 13, color: "#0f172a" }}>
              {m.label}
            </span>
          </InfoWindowF>
        )
      })}
    </>
  )
}

export default function MapPanel({
  markers,
  live,
  vehicle,
  path,
  center,
  className,
}: Props) {
  const [map, setMap] = useState<google.maps.Map | null>(null)
  // Shared loader — injects the Maps JS API <script> once per page and is safe
  // to call from several mounted maps/pickers at the same time.
  const { isLoaded, loadError } = useMaps()

  const firstValid = markers.find(okPt)
  const fallbackCenter: [number, number] =
    center && Number.isFinite(center[0]) && Number.isFinite(center[1])
      ? center
      : firstValid
        ? [firstValid.lat, firstValid.lng]
        : [23.1585, 72.6841] // Ahmedabad default

  const box =
    className ??
    "h-[420px] w-full overflow-hidden rounded-xl border border-border"

  if (!MAPS_KEY) {
    return (
      <div
        className={`${box} flex items-center justify-center bg-muted text-center text-sm text-muted-foreground`}
      >
        Set NEXT_PUBLIC_GOOGLE_MAPS_KEY to enable the map.
      </div>
    )
  }

  if (loadError) {
    return (
      <div
        className={`${box} flex items-center justify-center bg-muted text-center text-sm text-destructive`}
      >
        Failed to load Google Maps: {loadError.message}
      </div>
    )
  }

  if (!isLoaded) return <div className={`${box} animate-pulse bg-muted`} />

  return (
    <div className={box}>
      <GoogleMap
        mapContainerStyle={{ height: "100%", width: "100%" }}
        center={{ lat: fallbackCenter[0], lng: fallbackCenter[1] }}
        zoom={12}
        onLoad={setMap}
        onUnmount={() => setMap(null)}
        options={{
          gestureHandling: "greedy",
          disableDefaultUI: false,
          clickableIcons: false,
        }}
      >
        <Overlays
          map={map}
          markers={markers}
          live={live}
          vehicle={vehicle}
          path={path}
        />
        <WaypointMarkers markers={markers} />
      </GoogleMap>
    </div>
  )
}
