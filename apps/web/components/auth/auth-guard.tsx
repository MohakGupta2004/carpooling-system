"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/stores/auth"
import { SpinnerIcon } from "@repo/ui/icons"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, ready, bootstrap } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!ready) void bootstrap()
  }, [ready, bootstrap])

  useEffect(() => {
    if (ready && !user) router.replace("/login")
  }, [ready, user, router])

  if (!ready || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <SpinnerIcon className="size-6 animate-spin text-primary" />
      </div>
    )
  }
  return <>{children}</>
}

/** Capability gate — renders children only if the user holds the permission. */
export function Can({
  permission,
  children,
}: {
  permission: string
  children: React.ReactNode
}) {
  const can = useAuth((s) => s.permissions.has(permission))
  return can ? <>{children}</> : null
}
