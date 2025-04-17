'use client' // Add this directive to make it a Client Component

import dynamic from "next/dynamic"

// Dynamically import MapComponent with SSR disabled
const MapComponentWithNoSSR = dynamic(() => import("@/components/map-component"), {
  ssr: false,
  loading: () => <p>Loading map...</p>, // Optional loading indicator
})

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex-1">
        {/* Use the dynamically imported component */}
        <MapComponentWithNoSSR />
      </div>
    </main>
  )
}
