"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, type Variants } from "motion/react"
import { toast } from "react-hot-toast"
import { api } from "@/lib/api"
import { useAuth, type Me } from "@/stores/auth"
import { Button } from "@repo/ui/button"
import { Input } from "@repo/ui/input"
import { Label } from "@repo/ui/label"
import {
  MailIcon,
  LockIcon,
  SpinnerIcon,
  EyeIcon,
  EyeOffIcon,
} from "@/components/ui/icons"

// Staggered entrance — adapted from watermelon auth-12.
const container: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.05 },
  },
}
const item: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
}

export default function LoginPage() {
  const router = useRouter()
  const setSession = useAuth((s) => s.setSession)
  const [email, setEmail] = useState("ankit@odoo.com")
  const [password, setPassword] = useState("Password123!")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post<{ accessToken: string; user: Me }>(
        "/auth/login",
        { email, password }
      )
      await setSession(res.accessToken, res.user)
      toast.success(`Welcome back, ${res.user.fullName.split(" ")[0]}`)
      router.replace("/dashboard")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <motion.div variants={item}>
        <Link
          href="/"
          className="mb-8 inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to home
        </Link>
      </motion.div>

      <motion.div variants={item} className="mb-8">
        <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight text-foreground">
          Welcome
          <br />
          back
        </h1>
        <p className="mt-4 text-[15px] text-balance text-muted-foreground">
          Sign in to access your company carpool network.
        </p>
      </motion.div>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <motion.div variants={item} className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <div className="relative">
            <MailIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 pl-9"
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
          </div>
        </motion.div>

        <motion.div variants={item} className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <LockIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 pr-10 pl-9"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPassword ? (
                <EyeOffIcon className="size-4" />
              ) : (
                <EyeIcon className="size-4" />
              )}
            </button>
          </div>
        </motion.div>

        <motion.div variants={item} className="mt-1">
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading && <SpinnerIcon className="size-4 animate-spin" />}
            Sign in
          </Button>
        </motion.div>
      </form>

      <motion.p
        variants={item}
        className="mt-6 text-center text-xs text-muted-foreground"
      >
        Accounts are provisioned by your company admin.
      </motion.p>

      <motion.div
        variants={item}
        className="mt-8 rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground"
      >
        <p className="font-medium text-foreground">
          Demo accounts (password: Password123!)
        </p>
        <p className="mt-1">
          ankit@odoo.com (Company Admin) · priya@odoo.com (Super Admin) ·
          jaanvi@odoo.com · raj@odoo.com · meera@odoo.com · sahil@odoo.com
        </p>
      </motion.div>
    </motion.div>
  )
}
