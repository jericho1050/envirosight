"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle, Wind, Info } from "lucide-react"
import { runPrediction, getWeatherData, fetchChemicalOptions } from "@/lib/api-client"
import type { PredictionResult, WeatherData, ChemicalOption } from "@/lib/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type L from "leaflet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface PredictionPanelProps {
  onPredictionResult: (result: PredictionResult) => void
  mapRef: React.RefObject<L.Map | null>
}

const DEFAULT_STACK_HEIGHT = 10 // meters
const DEFAULT_STACK_DIAMETER = 1 // meters
const DEFAULT_EXIT_VELOCITY = 10 // m/s
const DEFAULT_EXIT_TEMP_OFFSET = 20 // degrees C

export default function PredictionPanel({ onPredictionResult, mapRef }: PredictionPanelProps) {
  const [chemicals, setChemicals] = useState<ChemicalOption[]>([])
  const [selectedChemicalId, setSelectedChemicalId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingChemicals, setLoadingChemicals] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [weather, setWeather] = useState<WeatherData | null>(null)

  const [stackHeight, setStackHeight] = useState<string>(DEFAULT_STACK_HEIGHT.toString())
  const [stackDiameter, setStackDiameter] = useState<string>(DEFAULT_STACK_DIAMETER.toString())
  const [exitVelocity, setExitVelocity] = useState<string>(DEFAULT_EXIT_VELOCITY.toString())
  const [exitTemperatureOffset, setExitTemperatureOffset] = useState<string>(DEFAULT_EXIT_TEMP_OFFSET.toString())

  const [showAdvanced, setShowAdvanced] = useState(false)

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
      setError("Map not ready. Please wait a moment and try again.")
      return
    }
    if (selectedChemicalId === null) {
      setError("Please select a chemical first.")
      return
    }

    const stackParams = {
      stackHeight: parseFloat(stackHeight) || undefined,
      stackDiameter: parseFloat(stackDiameter) || undefined,
      exitVelocity: parseFloat(exitVelocity) || undefined,
      exitTemperatureOffset: parseFloat(exitTemperatureOffset) || undefined,
    }

    if ( (stackHeight !== '' && isNaN(stackParams.stackHeight ?? 0)) ||
         (stackDiameter !== '' && isNaN(stackParams.stackDiameter ?? 0)) ||
         (exitVelocity !== '' && isNaN(stackParams.exitVelocity ?? 0)) ||
         (exitTemperatureOffset !== '' && isNaN(stackParams.exitTemperatureOffset ?? 0)) ) {
      setError("Invalid input. Stack parameters must be numbers.");
      return;
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

      const predictionParams = {
        location: { lat: center.lat, lng: center.lng },
        hazardType: selectedChemical.hazard_type,
        chemical_id: selectedChemicalId,
        weather: weatherData,
        ...stackParams
      }

      console.log("🔮 Running prediction with params:", predictionParams)

      const result = await runPrediction(predictionParams)

      console.log("✅ Prediction result received:", result)
      console.log("🔍 Polygon points:", result.polygon ? result.polygon.length : "none")

      onPredictionResult(result)
    } catch (err) {
      console.error("❌ Prediction error:", err)
      if (err instanceof Error && err.message.includes("Invalid stack parameters")) {
        setError(`Failed to run prediction: ${err.message}. Please check stack parameter inputs.`);
      } else if (err instanceof Error) {
        setError(`Failed to run prediction: ${err.message}. Please try again.`);
      } else {
        setError("Failed to run prediction due to an unknown error. Please try again.");
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <TooltipProvider>
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Hazard Prediction</CardTitle>
          <CardDescription>Simulate potential hazard dispersion based on location, chemical, and weather.</CardDescription>
          <Alert className="mt-2">
            <Info className="h-4 w-4" />
            <AlertTitle className="text-sm font-semibold">Illustrative Model</AlertTitle>
            <AlertDescription className="text-xs">
              This uses a simplified Gaussian model for educational purposes. Results are approximate and should <span className="font-semibold">not</span> be used for emergency response decisions.
            </AlertDescription>
          </Alert>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="chemical-select">Chemical / Hazard Type</Label>
              <Select
                value={selectedChemicalId !== null ? selectedChemicalId.toString() : ""}
                onValueChange={(value) => setSelectedChemicalId(Number(value))}
                disabled={loadingChemicals || chemicals.length === 0}
              >
                <SelectTrigger id="chemical-select">
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
                        {chemical.name} ({chemical.hazard_type})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" size="sm" onClick={() => setShowAdvanced(!showAdvanced)}>
              {showAdvanced ? "Hide" : "Show"} Stack Parameters (Optional)
            </Button>

            {showAdvanced && (
              <div className="space-y-3 border p-3 rounded-md bg-muted/50">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stackHeight">Stack Height (m)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Input
                          id="stackHeight"
                          type="number"
                          placeholder={DEFAULT_STACK_HEIGHT.toString()}
                          value={stackHeight}
                          onChange={(e) => setStackHeight(e.target.value)}
                          step="0.1"
                          min="0"
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Height of the emission source above ground (meters).</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stackDiameter">Stack Diameter (m)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Input
                          id="stackDiameter"
                          type="number"
                          placeholder={DEFAULT_STACK_DIAMETER.toString()}
                          value={stackDiameter}
                          onChange={(e) => setStackDiameter(e.target.value)}
                          step="0.1"
                          min="0"
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Inner diameter of the stack opening (meters).</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="exitVelocity">Exit Velocity (m/s)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Input
                          id="exitVelocity"
                          type="number"
                          placeholder={DEFAULT_EXIT_VELOCITY.toString()}
                          value={exitVelocity}
                          onChange={(e) => setExitVelocity(e.target.value)}
                          step="0.1"
                          min="0"
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Speed of the gas leaving the stack (meters per second).</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exitTempOffset">Exit Temp Offset (°C)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Input
                          id="exitTempOffset"
                          type="number"
                          placeholder={DEFAULT_EXIT_TEMP_OFFSET.toString()}
                          value={exitTemperatureOffset}
                          onChange={(e) => setExitTemperatureOffset(e.target.value)}
                          step="1"
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Temperature difference between exiting gas and ambient air (Celsius).</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  Leave fields blank or zero to use default values ({DEFAULT_STACK_HEIGHT}m height, {DEFAULT_STACK_DIAMETER}m diameter, {DEFAULT_EXIT_VELOCITY}m/s velocity, {DEFAULT_EXIT_TEMP_OFFSET}°C offset). These significantly impact plume rise.
                </p>
              </div>
            )}

            {weather && (
              <div className="bg-muted p-3 rounded-md space-y-2">
                <div className="flex items-center">
                  <Wind className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Weather at Center Point</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Wind: {weather.windSpeed.toFixed(1)} mph from {weather.windDirection}°</div>
                  <div>Temp: {weather.temperature.toFixed(1)}°F</div>
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
    </TooltipProvider>
  )
}
