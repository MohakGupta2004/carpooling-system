import { AuthGuard } from "@/components/auth/auth-guard"
import { AppShell } from "@/components/layout/shell"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  )
}
