"use client"

import { useJsApiLoader, type Libraries } from "@react-google-maps/api"

export const MAPS_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ??
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
  ""

// Module-level constants: useJsApiLoader compares `libraries` by reference and
// logs a "performance warning" (and reloads the script) if a fresh array is
// handed to it on every render.
const LIBRARIES: Libraries = ["places"]

// Every caller shares this id so the Maps JS API <script> is injected exactly
// once per page, however many maps and pickers are mounted at the same time.
const SCRIPT_ID = "carpool-google-maps"

/**
 * Single entry point for the Google Maps JS API across the web app. Both the
 * map panel and the location picker call this, so they load one script with one
 * set of libraries instead of racing each other.
 */
export function useMaps() {
  return useJsApiLoader({
    id: SCRIPT_ID,
    googleMapsApiKey: MAPS_KEY,
    libraries: LIBRARIES,
  })
}
