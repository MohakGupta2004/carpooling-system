"use client"

import { create } from "zustand"
import { api, setAccessToken } from "@/lib/api"
import { refreshSocketAuth } from "@/lib/socket"

export interface Me {
  id: string
  fullName: string
  email: string
  status: string
  photoUrl: string | null
  organizationId: string
  gender?: string | null
  organization?: { id: string; name: string; slug: string }
  roles?: { key: string; name: string }[]
  ecoPoints?: number
}

interface AuthState {
  user: Me | null
  permissions: Set<string>
  ready: boolean
  setSession: (accessToken: string, user: Me) => Promise<void>
  loadPermissions: () => Promise<void>
  bootstrap: () => Promise<void>
  logout: () => Promise<void>
  can: (perm: string) => boolean
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  permissions: new Set(),
  ready: false,

  setSession: async (accessToken, user) => {
    setAccessToken(accessToken)
    refreshSocketAuth()
    set({ user })
    await get().loadPermissions()
  },

  loadPermissions: async () => {
    try {
      const { permissions } = await api.get<{ permissions: string[] }>(
        "/auth/me/permissions"
      )
      set({ permissions: new Set(permissions) })
    } catch {
      set({ permissions: new Set() })
    }
  },

  bootstrap: async () => {
    try {
      const ok = await api.refresh()
      if (!ok) {
        set({ ready: true, user: null })
        return
      }
      const user = await api.get<Me>("/auth/me")
      refreshSocketAuth()
      set({ user })
      await get().loadPermissions()
    } catch {
      set({ user: null })
    } finally {
      set({ ready: true })
    }
  },

  logout: async () => {
    try {
      await api.post("/auth/logout")
    } catch {
      /* ignore */
    }
    setAccessToken(null)
    set({ user: null, permissions: new Set() })
  },

  can: (perm) => get().permissions.has(perm),
}))
