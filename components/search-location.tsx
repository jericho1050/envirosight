"use client"

import type React from "react"

import { useState } from "react"
import { Search, Loader2, AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface SearchLocationProps {
  onLocationFound: (lat: number, lng: number) => void
}

export default function SearchLocation({ onLocationFound }: SearchLocationProps) {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!query.trim()) return

    try {
      setLoading(true)

      // Use Nominatim API for geocoding (OpenStreetMap)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`,
      )

      if (!response.ok) {
        throw new Error(`Geocoding service error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (data && data.length > 0) {
        const { lat, lon } = data[0]
        const latitude = Number.parseFloat(lat)
        const longitude = Number.parseFloat(lon)
        if (isNaN(latitude) || isNaN(longitude)) {
          console.error("Invalid coordinates received:", lat, lon)
          throw new Error("Received invalid coordinates from geocoding service.")
        }
        onLocationFound(latitude, longitude)
        setQuery("")
      } else {
        console.warn("No results found for query:", query)
        setError(`No locations found for "${query}". Try a different search term.`)
      }
    } catch (err) {
      console.error("Error searching location:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred during search.")
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    if (error) {
      setError(null)
    }
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSearch} className="flex w-full max-w-sm items-center space-x-2">
        <Input
          type="text"
          placeholder="Search city, address..."
          value={query}
          onChange={handleInputChange}
          className="bg-background"
        />
        <Button type="submit" size="icon" disabled={loading || !query.trim()}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </form>
      {error && (
        <Alert variant="destructive" className="text-xs p-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
