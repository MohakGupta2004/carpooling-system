"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import { api } from "@/lib/api"
import { useAuth } from "@/stores/auth"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { KeyIcon, VerifiedIcon } from "@/components/ui/icons"

interface Permission {
  id: string
  key: string
  resource: string
  action: string
}
interface Role {
  id: string
  key: string
  name: string
  isSystem: boolean
  permissions: { permission: { key: string } }[]
  _count: { users: number }
}

export default function RbacPage() {
  const qc = useQueryClient()
  const loadPermissions = useAuth((s) => s.loadPermissions)

  const roles = useQuery({
    queryKey: ["rbac", "roles"],
    queryFn: () => api.get<Role[]>("/admin/rbac/roles"),
  })
  const perms = useQuery({
    queryKey: ["rbac", "perms"],
    queryFn: () => api.get<Permission[]>("/admin/rbac/permissions"),
  })

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const selectedRole =
    roles.data?.find((r) => r.id === selectedRoleId) ?? roles.data?.[0]

  // local draft of the selected role's permission set
  const [draft, setDraft] = useState<Set<string> | null>(null)
  const activeSet = useMemo(() => {
    if (draft) return draft
    return new Set(selectedRole?.permissions.map((p) => p.permission.key) ?? [])
  }, [draft, selectedRole])

  const grouped = useMemo(() => {
    const g = new Map<string, Permission[]>()
    for (const p of perms.data ?? []) {
      const arr = g.get(p.resource) ?? []
      arr.push(p)
      g.set(p.resource, arr)
    }
    return [...g.entries()].sort()
  }, [perms.data])

  const save = useMutation({
    mutationFn: (keys: string[]) =>
      api.put(`/admin/rbac/roles/${selectedRole!.id}/permissions`, {
        permissionKeys: keys,
      }),
    onSuccess: async () => {
      toast.success("Permissions updated — effective immediately, no redeploy")
      setDraft(null)
      await qc.invalidateQueries({ queryKey: ["rbac", "roles"] })
      await loadPermissions() // refresh my own capabilities → menu re-renders live
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  })

  const toggle = (key: string) => {
    const next = new Set(activeSet)
    next.has(key) ? next.delete(key) : next.add(key)
    setDraft(next)
  }

  const dirty = draft !== null

  return (
    <div>
      <PageHeader
        title="Roles & Access"
        description="Edit what each role can do. Changes take effect on the next request — no redeploy."
        action={
          dirty ? (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Discard
              </Button>
              <Button
                onClick={() => save.mutate([...activeSet])}
                disabled={save.isPending}
              >
                Save changes
              </Button>
            </div>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Roles list */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {roles.isLoading ? (
              <Skeleton className="h-20" />
            ) : (
              roles.data?.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setSelectedRoleId(r.id)
                    setDraft(null)
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    selectedRole?.id === r.id
                      ? "bg-secondary text-secondary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <KeyIcon className="size-4 text-muted-foreground" />
                    {r.name}
                  </span>
                  {r.isSystem && (
                    <Badge variant="outline" className="text-[10px]">
                      system
                    </Badge>
                  )}
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Permission matrix */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">
                {selectedRole?.name} permissions
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedRole?._count.users ?? 0} user(s) · {activeSet.size} of{" "}
                {perms.data?.length ?? 0} permissions
              </p>
            </div>
            {dirty && <Badge variant="warning">unsaved</Badge>}
          </CardHeader>
          <CardContent className="space-y-5">
            {perms.isLoading ? (
              <Skeleton className="h-64" />
            ) : (
              grouped.map(([resource, list]) => (
                <div key={resource}>
                  <p className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    {resource}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {list.map((p) => (
                      <label
                        key={p.key}
                        className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                      >
                        <span className="flex items-center gap-2">
                          {activeSet.has(p.key) && (
                            <VerifiedIcon className="size-3.5 text-primary" />
                          )}
                          <code className="text-xs">{p.action}</code>
                        </span>
                        <Switch
                          checked={activeSet.has(p.key)}
                          onCheckedChange={() => toggle(p.key)}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
