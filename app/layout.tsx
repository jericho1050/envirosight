import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "HazMap Predict",
  description: "Environmental hazard visualization and prediction tool",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body className={inter.className}>
        <ThemeProvider 
          defaultTheme="light" 
          enableSystem
          disableTransitionOnChange
          enableColorScheme={false}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}