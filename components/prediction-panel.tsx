"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, AlertCircle, Wind } from "lucide-react"
import { runPrediction, getWeatherData } from "@/lib/api-client"
import type { PredictionResult, WeatherData } from "@/lib/types"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type L from "leaflet"

interface PredictionPanelProps {
  onPredictionResult: (result: PredictionResult) => void
  mapRef: React.MutableRefObject<L.Map | null>
}

interface ChemicalOption {
  id: number
  name: string
  hazard_type: string
}

export default function PredictionPanel({ onPredictionResult, mapRef }: PredictionPanelProps) {
  const [chemicals, setChemicals] = useState<ChemicalOption[]>([])
  const [selectedChemicalId, setSelectedChemicalId] = useState<number>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [weather, setWeather] = useState<WeatherData | null>(null)

  useEffect(() => {
    // In a real implementation, this would fetch from Supabase
    // For now, we'll use hardcoded values that match our database
    setChemicals([
      { id: 1, name: "Ammonia Gas", hazard_type: "gas" },
      { id: 2, name: "Chlorine Gas", hazard_type: "gas" },
      { id: 3, name: "Crude Oil", hazard_type: "liquid" },
      { id: 4, name: "Benzene", hazard_type: "liquid" },
      { id: 5, name: "Sulfur Dioxide", hazard_type: "gas" },
    ])
  }, [])

  const handleSimulate = async () => {
    if (!mapRef.current) {
      console.error("Map reference is not available")
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Get center of current map view
      const center = mapRef.current.getCenter()
      console.log("🔍 Map center coordinates:", { lat: center.lat, lng: center.lng })

      // Get weather data for the location
      console.log("📡 Fetching weather data for location...")
      const weatherData = await getWeatherData({
        lat: center.lat,
        lng: center.lng,
      })

      console.log("🌤️ Weather data received:", weatherData)
      setWeather(weatherData)

      // Find the selected chemical
      const selectedChemical = chemicals.find((c) => c.id === selectedChemicalId)
      console.log("🧪 Selected chemical:", selectedChemical)

      if (!selectedChemical) {
        throw new Error("Selected chemical not found")
      }

      // Run the prediction
      console.log("🔮 Running prediction with params:", {
        location: { lat: center.lat, lng: center.lng },
        hazardType: selectedChemical.hazard_type,
        chemical_id: selectedChemicalId,
        weather: weatherData,
      })

      const result = await runPrediction({
        location: {
          lat: center.lat,
          lng: center.lng,
        },
        hazardType: selectedChemical.hazard_type,
        chemical_id: selectedChemicalId,
        weather: weatherData,
      })

      console.log("✅ Prediction result received:", result)
      console.log("🔍 Polygon points:", result.polygon ? result.polygon.length : "none")

      onPredictionResult(result)
    } catch (err) {
      console.error("❌ Prediction error:", err)
      setError("Failed to run prediction. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Hazard Prediction</CardTitle>
        <CardDescription>Simulate potential hazard dispersion based on current weather conditions</CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Hazard Type</label>
            <Select
              value={selectedChemicalId.toString()}
              onValueChange={(value) => setSelectedChemicalId(Number(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select hazard type" />
              </SelectTrigger>
              <SelectContent>
                {chemicals.map((chemical) => (
                  <SelectItem key={chemical.id} value={chemical.id.toString()}>
                    {chemical.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {weather && (
            <div className="bg-muted p-3 rounded-md space-y-2">
              <div className="flex items-center">
                <Wind className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">Current Weather</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Wind Speed: {weather.windSpeed} mph</div>
                <div>Direction: {weather.windDirection}°</div>
                <div>Temperature: {weather.temperature}°F</div>
                <div>Humidity: {weather.humidity}%</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter>
        <Button onClick={handleSimulate} disabled={loading} className="w-full">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {loading ? "Simulating..." : "Simulate Dispersion"}
        </Button>
      </CardFooter>
    </Card>
  )
}
