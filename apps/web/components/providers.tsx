"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import { Toaster } from "react-hot-toast"

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      })
  )

  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "var(--popover)",
            color: "var(--popover-foreground)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            fontSize: "0.875rem",
          },
          success: {
            iconTheme: { primary: "var(--primary)", secondary: "#ffffff" },
          },
        }}
      />
    </QueryClientProvider>
  )
}
