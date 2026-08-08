import { redirect } from "next/navigation"

// Self-registration is disabled — accounts are provisioned by a company admin.
export default function SignupPage() {
  redirect("/login")
}
