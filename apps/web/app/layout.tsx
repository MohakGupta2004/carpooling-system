import type { Metadata } from "next"
import { Host_Grotesk, Geist_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import { Providers } from "@/components/providers"

// One family for headings, body, labels and data. A display/body pair is the
// wrong tool here: the two grotesques it replaces were near-identical, which
// reads as an accident rather than a pairing. Hierarchy comes from weight.
const hostGrotesk = Host_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: {
    default: "Workway",
    template: "%s · Workway",
  },
  description: "Share the commute with your colleagues.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        hostGrotesk.variable,
        fontMono.variable,
        "font-sans"
      )}
    >
      <body>
        <Providers>
          <ThemeProvider>{children}</ThemeProvider>
        </Providers>
      </body>
    </html>
  )
}
