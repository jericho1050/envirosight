"use client"

import type React from "react"

import { useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface SearchLocationProps {
  onLocationFound: (lat: number, lng: number) => void
}

export default function SearchLocation({ onLocationFound }: SearchLocationProps) {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!query.trim()) return

    try {
      setLoading(true)

      // Use Nominatim API for geocoding (OpenStreetMap)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`,
      )

      if (!response.ok) {
        throw new Error("Geocoding failed")
      }

      const data = await response.json()

      if (data && data.length > 0) {
        const { lat, lon } = data[0]
        onLocationFound(Number.parseFloat(lat), Number.parseFloat(lon))
        setQuery("")
      } else {
        console.error("No results found")
      }
    } catch (error) {
      console.error("Error searching location:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSearch} className="flex w-full max-w-sm items-center space-x-2">
      <Input
        type="text"
        placeholder="Search location..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="bg-background"
      />
      <Button type="submit" size="icon" disabled={loading}>
        <Search className="h-4 w-4" />
      </Button>
    </form>
  )
}
