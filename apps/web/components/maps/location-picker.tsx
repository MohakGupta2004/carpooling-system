"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { MAPS_KEY, useMaps } from "./use-maps"
import { cn } from "@/lib/utils"
import { Input } from "@repo/ui/input"
import {
  PinIcon,
  SearchIcon,
  SpinnerIcon,
  IconHome,
  IconBuildingSkyscraper,
  IconCurrentLocation,
  IconMapPin,
} from "./picker-icons"

export interface Place {
  label: string
  address?: string
  lat: number
  lng: number
}
interface SavedPlace {
  id: string
  label: string
  address: string
  lat: number
  lng: number
}
interface GeoResult {
  label: string
  address: string
  lat: number
  lng: number
}

const savedIcon = (label: string) => {
  const l = label.toLowerCase()
  if (l.includes("home")) return IconHome
  if (l.includes("office") || l.includes("work")) return IconBuildingSkyscraper
  return IconMapPin
}

export function LocationPicker({
  value,
  onChange,
  placeholder = "Search a location",
  accent = "#059669",
}: {
  value: Place | null
  onChange: (p: Place) => void
  placeholder?: string
  accent?: string
}) {
  const [q, setQ] = useState("")
  const [debounced, setDebounced] = useState("")
  const [open, setOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  // The suggestion panel renders in a portal on <body>: `Card` sets
  // `overflow-hidden` (see packages/ui/src/card.tsx), which clips any absolutely
  // positioned child, and every page puts this picker inside a Card. Portalling
  // it out and pinning it to the input in viewport coords is the only way it
  // escapes that clip.
  const anchorRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{
    top: number
    left: number
    width: number
    maxH: number
    flip: boolean
  } | null>(null)

  const saved = useQuery({
    queryKey: ["saved-places"],
    queryFn: () => api.get<SavedPlace[]>("/users/me/saved-places"),
    staleTime: 300_000,
  })

  // Google Places Autocomplete (client-side, via the loaded Maps JS API). The
  // "places" library ships with the shared loader, so it's ready as soon as
  // isLoaded flips.
  const { isLoaded, loadError } = useMaps()
  const acRef = useRef<google.maps.places.AutocompleteService | null>(null)
  const psRef = useRef<google.maps.places.PlacesService | null>(null)
  // Keyed by the query they answer, so a slow response for an older query is
  // ignored rather than flashing stale suggestions under the current input.
  const [preds, setPreds] = useState<{
    q: string
    items: google.maps.places.AutocompletePrediction[]
  }>({
    q: "",
    items: [],
  })
  const usingGoogle = !!MAPS_KEY && isLoaded && !loadError
  const predictions = preds.q === debounced ? preds.items : []

  useEffect(() => {
    if (usingGoogle && !acRef.current) {
      acRef.current = new google.maps.places.AutocompleteService()
      psRef.current = new google.maps.places.PlacesService(
        document.createElement("div")
      )
    }
  }, [usingGoogle])

  useEffect(() => {
    if (!usingGoogle || debounced.length < 3) return
    acRef.current?.getPlacePredictions(
      { input: debounced, componentRestrictions: { country: "in" } },
      (res) => setPreds({ q: debounced, items: res ?? [] })
    )
  }, [usingGoogle, debounced])

  // Fallback to the backend geocoder only when Google Maps isn't available.
  const results = useQuery({
    queryKey: ["geocode", debounced],
    queryFn: () =>
      api.get<GeoResult[]>(`/maps/geocode?q=${encodeURIComponent(debounced)}`),
    enabled: !usingGoogle && debounced.length >= 3,
  })

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 350)
    return () => clearTimeout(t)
  }, [q])

  // Pin the portalled panel to the input, and keep it pinned while the page
  // scrolls or resizes. Flips above the input when there isn't room below.
  useLayoutEffect(() => {
    if (!open) return
    const measure = () => {
      const el = anchorRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const below = window.innerHeight - r.bottom - 12
      const above = r.top - 12
      const flip = below < 220 && above > below
      setPos({
        top: flip ? r.top - 4 : r.bottom + 4,
        left: r.left,
        width: r.width,
        maxH: Math.max(160, flip ? above : below),
        flip,
      })
    }
    measure()
    window.addEventListener("resize", measure)
    // capture phase: catches scrolls on any ancestor, not just the window
    window.addEventListener("scroll", measure, true)
    return () => {
      window.removeEventListener("resize", measure)
      window.removeEventListener("scroll", measure, true)
    }
  }, [open])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node
      // The panel lives outside `ref` now, so it needs its own hit test —
      // otherwise mousedown closes it before a row's click ever lands.
      if (ref.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const pick = (p: Place) => {
    onChange(p)
    setQ("")
    setDebounced("")
    setPreds({ q: "", items: [] })
    setOpen(false)
  }

  const pickGoogle = (p: google.maps.places.AutocompletePrediction) => {
    psRef.current?.getDetails(
      {
        placeId: p.place_id,
        fields: ["geometry", "name", "formatted_address"],
      },
      (place) => {
        const loc = place?.geometry?.location
        if (loc) {
          pick({
            label: place?.name ?? p.structured_formatting.main_text,
            address: place?.formatted_address ?? p.description,
            lat: loc.lat(),
            lng: loc.lng(),
          })
        }
      }
    )
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        try {
          const r = await api.get<GeoResult>(
            `/maps/reverse?lat=${lat}&lng=${lng}`
          )
          pick({ label: r.label, address: r.address, lat, lng })
        } catch {
          pick({ label: "Current location", lat, lng })
        } finally {
          setLocating(false)
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  return (
    <div className="relative" ref={ref}>
      <div className="relative" ref={anchorRef}>
        <span
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
          style={{ color: accent }}
        >
          <PinIcon className="size-4" />
        </span>
        <Input
          className="pl-9"
          placeholder={placeholder}
          value={open ? q : (value?.label ?? "")}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
        />
        {results.isFetching && (
          <SpinnerIcon className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {open &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxH,
              transform: pos.flip ? "translateY(-100%)" : undefined,
            }}
            className="z-50 overflow-y-auto rounded-xl border border-border bg-popover shadow-lg"
          >
            {/* Saved places */}
            {(saved.data?.length ?? 0) > 0 && q.length < 3 && (
              <div className="border-b border-border py-1">
                <p className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                  Saved places
                </p>
                {saved.data!.map((s) => {
                  const Icon = savedIcon(s.label)
                  return (
                    <Row
                      key={s.id}
                      onClick={() => pick(s)}
                      icon={<Icon className="size-4 text-primary" />}
                      title={s.label}
                      subtitle={s.address}
                    />
                  )
                })}
              </div>
            )}

            {/* Current location */}
            <Row
              onClick={useCurrentLocation}
              icon={
                locating ? (
                  <SpinnerIcon className="size-4 animate-spin text-primary" />
                ) : (
                  <IconCurrentLocation className="size-4 text-primary" />
                )
              }
              title="Use current location"
            />

            {/* Search results — Google Places when available, else backend geocoder */}
            {q.length >= 3 && (
              <div className="max-h-64 scrollbar-thin overflow-y-auto border-t border-border">
                {usingGoogle ? (
                  predictions.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-muted-foreground">
                      Searching Google Maps…
                    </p>
                  ) : (
                    predictions.map((p) => (
                      <Row
                        key={p.place_id}
                        onClick={() => pickGoogle(p)}
                        icon={
                          <SearchIcon className="size-4 text-muted-foreground" />
                        }
                        title={p.structured_formatting.main_text}
                        subtitle={p.structured_formatting.secondary_text}
                      />
                    ))
                  )
                ) : (
                  <>
                    {results.isFetching && (
                      <p className="px-3 py-3 text-xs text-muted-foreground">
                        Searching…
                      </p>
                    )}
                    {!results.isFetching &&
                      (results.data?.length ?? 0) === 0 && (
                        <p className="px-3 py-3 text-xs text-muted-foreground">
                          No results for “{q}”.
                        </p>
                      )}
                    {results.data?.map((r, i) => (
                      <Row
                        key={i}
                        onClick={() => pick(r)}
                        icon={
                          <SearchIcon className="size-4 text-muted-foreground" />
                        }
                        title={r.label}
                        subtitle={r.address}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  )
}

function Row({
  onClick,
  icon,
  title,
  subtitle,
}: {
  onClick: () => void
  icon: React.ReactNode
  title: string
  subtitle?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent"
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{title}</span>
        {subtitle && (
          <span className="block truncate text-xs text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>
    </button>
  )
}
