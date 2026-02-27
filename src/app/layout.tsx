import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Actuality — Bid Leveling Platform",
  description: "AI-powered RFP issuance and bid leveling for owners and developers",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
