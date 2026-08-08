"use client"

import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"

import type {
  AdminVehicle,
  MyReport,
  OrgReport,
  PlatformReport,
  SustainabilityReport,
} from "./types"

/**
 * One hook per API call the dashboard makes.
 * Components just call the hook and read `data`, `isLoading`, `isError`.
 */

/** Every organization on the platform, plus platform-wide totals. */
export function usePlatformReport() {
  return useQuery({
    queryKey: ["org-comparison"],
    queryFn: () => api.get<PlatformReport>("/reports/org-comparison"),
  })
}

/** KPIs and charts for the signed-in user's organization. */
export function useOrgReport() {
  return useQuery({
    queryKey: ["analytics", "dash"],
    queryFn: () => api.get<OrgReport>("/reports/analytics"),
  })
}

/** Vehicles of the organization — used to count what needs an admin's action. */
export function useOrgVehicles() {
  return useQuery({
    queryKey: ["admin", "vehicles"],
    queryFn: () => api.get<AdminVehicle[]>("/admin/vehicles"),
  })
}

/** The signed-in employee's own trip totals. */
export function useMyReport() {
  return useQuery({
    queryKey: ["report", "me"],
    queryFn: () => api.get<MyReport>("/reports/me"),
  })
}

/** The signed-in employee's green score and savings. */
export function useMySustainability() {
  return useQuery({
    queryKey: ["sustainability"],
    queryFn: () => api.get<SustainabilityReport>("/reports/sustainability"),
  })
}
