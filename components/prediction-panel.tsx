"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, AlertCircle, Wind } from "lucide-react"
import { runPrediction, getWeatherData, fetchChemicalOptions } from "@/lib/api-client"
import type { PredictionResult, WeatherData, ChemicalOption } from "@/lib/types"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type L from "leaflet"

interface PredictionPanelProps {
  onPredictionResult: (result: PredictionResult) => void
  mapRef: React.RefObject<L.Map> // Changed from MutableRefObject<L.Map | null>
}

export default function PredictionPanel({ onPredictionResult, mapRef }: PredictionPanelProps) {
  const [chemicals, setChemicals] = useState<ChemicalOption[]>([])
  const [selectedChemicalId, setSelectedChemicalId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingChemicals, setLoadingChemicals] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [weather, setWeather] = useState<WeatherData | null>(null)

  useEffect(() => {
    console.log("🚀 PredictionPanel useEffect running");
    // Fetch chemicals from Supabase
    const loadChemicals = async () => {
      console.log("⏳ Starting loadChemicals...");
      setLoadingChemicals(true)
      try {
        console.log("📡 Calling fetchChemicalOptions...");
        const options = await fetchChemicalOptions()
        console.log("✅ Chemical Options fetched in component:", options) // Renamed log for clarity
        setChemicals(options)
        // Set default selection to the first chemical if available
        if (options.length > 0 && selectedChemicalId === null) {
          setSelectedChemicalId(options[0].id)
        }
      } catch (fetchError) {
        console.error("❌ Failed to load chemical options:", fetchError)
        setError("Could not load chemical options. Please try refreshing.")
      } finally {
        setLoadingChemicals(false)
      }
    }

    loadChemicals()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // <-- Run only once on mount

  const handleSimulate = async () => {
    if (!mapRef.current) {  
      console.error("Map reference is not available")
      return
    }
    if (selectedChemicalId === null) {
      setError("Please select a chemical first.")
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
        throw new Error("Selected chemical not found or list not loaded")
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
              value={selectedChemicalId !== null ? selectedChemicalId.toString() : ""}
              onValueChange={(value) => setSelectedChemicalId(Number(value))}
              disabled={loadingChemicals || chemicals.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingChemicals ? "Loading chemicals..." : "Select hazard type"} />
              </SelectTrigger>
              <SelectContent>
                {loadingChemicals ? (
                  <SelectItem value="loading" disabled>Loading...</SelectItem>
                ) : chemicals.length === 0 ? (
                  <SelectItem value="no-chemicals" disabled>No chemicals available</SelectItem>
                ) : (
                  chemicals.map((chemical) => (
                    <SelectItem key={chemical.id} value={chemical.id.toString()}>
                      {chemical.name}
                    </SelectItem>
                  ))
                )}
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
        <Button 
          onClick={handleSimulate} 
          disabled={loading || loadingChemicals || selectedChemicalId === null}
          className="w-full"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {loading ? "Simulating..." : "Simulate Dispersion"}
        </Button>
      </CardFooter>
    </Card>
  )
}
