"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/stores/auth"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@repo/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu"
import {
  ProfileIcon,
  SettingsIcon,
  LogoutIcon,
  SelectorIcon,
} from "@repo/ui/icons"

const initials = (n?: string) =>
  n
    ? n
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U"

export function SidebarUser({ collapsed }: { collapsed: boolean }) {
  const router = useRouter()
  const { user, logout } = useAuth()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center gap-2 rounded-lg text-left text-sm transition-colors outline-none hover:bg-sidebar-accent",
          collapsed ? "justify-center p-1.5" : "px-2 py-1.5"
        )}
        aria-label="Account menu"
      >
        <Avatar className="size-8 shrink-0 border border-sidebar-border">
          <AvatarFallback className="bg-secondary text-xs">
            {initials(user?.fullName)}
          </AvatarFallback>
        </Avatar>
        {!collapsed && (
          <>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate font-medium">
                {user?.fullName ?? "Account"}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {user?.roles?.[0]?.name ?? user?.email}
              </span>
            </span>
            <SelectorIcon className="size-4 shrink-0 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate">{user?.fullName ?? "Account"}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {user?.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex items-center gap-2"
          render={<Link href="/settings" />}
        >
          <ProfileIcon /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex items-center gap-2"
          render={<Link href="/settings" />}
        >
          <SettingsIcon /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={async () => {
            await logout()
            router.replace("/login")
          }}
        >
          <LogoutIcon /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
