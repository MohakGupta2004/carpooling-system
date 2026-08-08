import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** paise → ₹ string */
export function inr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100)
}

export function km(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`
}

export function timeUntil(date: string | Date): string {
  const diff = new Date(date).getTime() - Date.now()
  const abs = Math.abs(diff)
  const mins = Math.round(abs / 60000)
  if (mins < 60) return diff >= 0 ? `in ${mins}m` : `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return diff >= 0 ? `in ${hrs}h` : `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return diff >= 0 ? `in ${days}d` : `${days}d ago`
}
