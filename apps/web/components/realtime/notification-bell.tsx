"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "react-hot-toast"
import { api } from "@/lib/api"
import { getSocket } from "@/lib/socket"
import { Button } from "@repo/ui/button"
import { BellIcon } from "@repo/ui/icons"
import { timeUntil } from "@/lib/utils"

interface Notif {
  id: string
  type: string
  title: string
  body: string
  readAt: string | null
  createdAt: string
}

export function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unread = items.filter((n) => !n.readAt).length

  useEffect(() => {
    api
      .get<Notif[]>("/notifications")
      .then(setItems)
      .catch(() => {})

    const socket = getSocket()
    // Payload now carries the persisted DB id (see notifyUser on the server),
    // so we dedupe against what we already have and can mark it read later.
    const onNotify = (n: Notif) => {
      setItems((prev) =>
        prev.some((x) => x.id === n.id)
          ? prev
          : [{ ...n, readAt: n.readAt ?? null }, ...prev].slice(0, 40)
      )
      toast(`${n.title} — ${n.body}`, { icon: "🔔" })
    }
    socket.on("notify:new", onNotify)
    return () => {
      socket.off("notify:new", onNotify)
    }
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  function markRead(id: string) {
    setItems((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n
      )
    )
    api.post("/notifications/read", { ids: [id] }).catch(() => {})
  }

  function markAll() {
    if (unread === 0) return
    setItems((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))
    )
    api.post("/notifications/read", {}).catch(() => {})
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        className="relative"
        title="Notifications"
      >
        <BellIcon className="size-5" />
        {unread > 0 && (
          <span className="text-destructive-foreground absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="text-sm font-medium">Notifications</span>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="text-xs font-medium text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 scrollbar-thin divide-y divide-border overflow-y-auto">
            {items.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                You&apos;re all caught up.
              </p>
            )}
            {items.map((n) => {
              const isUnread = !n.readAt
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => isUnread && markRead(n.id)}
                  className={`flex w-full items-start gap-2 px-4 py-3 text-left transition-colors ${isUnread ? "bg-accent/60 hover:bg-accent" : "hover:bg-accent/40"}`}
                >
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${isUnread ? "bg-primary" : "bg-transparent"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm ${isUnread ? "font-semibold" : "font-medium text-muted-foreground"}`}
                    >
                      {n.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {n.body}
                    </span>
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      {timeUntil(n.createdAt)}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
