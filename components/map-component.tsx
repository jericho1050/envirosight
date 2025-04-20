"use client"

import { useEffect, useState, useRef, useCallback } from "react"
// Import Polygon and Tooltip from react-leaflet
import { MapContainer, TileLayer, Marker, Popup, useMap, LayerGroup, Polygon, Tooltip } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { fetchHazardSites, fetchAQIData } from "@/lib/api-client"
import LayerControl from "./layer-control"
import PredictionPanel from "./prediction-panel"
import type { HazardSite, AQIStation, PredictionResult } from "@/lib/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, AlertCircle, Info } from "lucide-react"
import SearchLocation from "./search-location"
import { Button } from "@/components/ui/button"

// Fix Leaflet icon issues in Next.js
const createDefaultIcon = () => {
  return L.icon({
    iconUrl: "/marker-icon.png",
    iconRetinaUrl: "/marker-icon-2x.png",
    shadowUrl: "/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  })
}

// Custom marker icons
const createHazardIcon = () => {
  return L.divIcon({
    className: "hazard-marker",
    html: '<div class="w-4 h-4 rounded-full bg-red-500 border-2 border-white"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

const createAQIIcon = (aqi: number) => {
  let color = "bg-green-500"
  if (aqi > 100) color = "bg-yellow-500"
  if (aqi > 150) color = "bg-orange-500"
  if (aqi > 200) color = "bg-red-500"
  if (aqi > 300) color = "bg-purple-500"

  return L.divIcon({
    className: "aqi-marker",
    html: `<div class="w-4 h-4 rounded-full ${color} border-2 border-white"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

// Location finder component
function LocationFinder() {
  const map = useMap()
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus("error")
      setErrorMessage("Geolocation is not supported by your browser")
      return
    }

    setLocationStatus("requesting")

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        map.setView([latitude, longitude], 10)
        setLocationStatus("success")
      },
      (error) => {
        console.error("Error getting location:", error)
        setLocationStatus("error")

        // Handle specific error codes
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setErrorMessage("Location permission denied. Please enable location access in your browser settings.")
            break
          case error.POSITION_UNAVAILABLE:
            setErrorMessage("Location information is unavailable.")
            break
          case error.TIMEOUT:
            setErrorMessage("The request to get user location timed out.")
            break
          default:
            setErrorMessage("An unknown error occurred while requesting location.")
        }

        // Default to a central US location if geolocation fails
        map.setView([39.8283, -98.5795], 4)
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      },
    )
  }, [map])

  return (
    <div className="leaflet-top leaflet-left mt-16">
      <div className="leaflet-control leaflet-bar">
        {locationStatus === "idle" && (
          <button
            onClick={requestLocation}
            className="bg-white p-2 rounded-md shadow-md flex items-center justify-center"
            title="Find my location"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-primary"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}

        {locationStatus === "requesting" && (
          <div className="bg-white p-2 rounded-md shadow-md flex items-center justify-center">
            <svg
              className="animate-spin h-5 w-5 text-primary"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        )}

        {locationStatus === "error" && errorMessage && (
          <div className="absolute top-20 left-4 right-4 bg-white p-3 rounded-md shadow-md z-50">
            <div className="flex items-start">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-red-500 mr-2 mt-0.5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="text-sm font-medium">{errorMessage}</p>
                <button onClick={() => setLocationStatus("idle")} className="text-xs text-primary mt-1">
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MapComponent() {
  const [hazardSites, setHazardSites] = useState<HazardSite[]>([])
  const [aqiStations, setAqiStations] = useState<AQIStation[]>([])
  const [predictionResult, setPredictionResult] = useState<PredictionResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dataSource, setDataSource] = useState<"api" | "mock">("api")
  const [visibleLayers, setVisibleLayers] = useState({
    hazardSites: true,
    aqiStations: true,
    prediction: true,
  })
  const mapRef = useRef<L.Map | null>(null)

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      // Get initial map bounds (or default if map isn't ready)
      const bounds = mapRef.current ? mapRef.current.getBounds().toBBoxString() : undefined;
      const defaultBounds = { north: 50, south: 25, east: -65, west: -125 }; // Fallback

      // Helper to parse bounds string or use default
      const parseBounds = (bboxString?: string) => {
          if (!bboxString) return defaultBounds;
          const [west, south, east, north] = bboxString.split(",").map(Number);
          // Basic validation, return default if invalid
          if (isNaN(west) || isNaN(south) || isNaN(east) || isNaN(north)) {
              console.warn("Invalid bounds string, using default bounds:", bboxString);
              return defaultBounds;
          }
          return { north, south, east, west };
      };

      const currentBounds = parseBounds(bounds);

      try {
        setLoading(true)
        setError(null)

        // Fetch hazard sites using current map bounds
        try {
          console.log("Fetching hazard sites with bounds:", currentBounds);
          const sites = await fetchHazardSites(currentBounds);
          setHazardSites(sites)

          // Check if we're using mock data
          if (sites === mockHazardSites) {
            setDataSource("mock")
          }
        } catch (err) {
          console.error("Error loading hazard sites:", err)
          setError("Failed to load hazard site data. Using mock data instead.")
          setHazardSites(mockHazardSites)
          setDataSource("mock")
        }

        // Fetch AQI data
        try {
          const aqi = await fetchAQIData({
            north: 50,
            south: 25,
            east: -65,
            west: -125,
          })
          setAqiStations(aqi)

          // If hazard sites didn't set mock mode but AQI did
          if (dataSource !== "mock" && aqi === mockAQIStations) {
            setDataSource("mock")
          }
        } catch (err) {
          console.error("Error loading AQI data:", err)
          if (!error) {
            setError("Failed to load air quality data. Using mock data instead.")
          }
          setAqiStations(mockAQIStations)
          setDataSource("mock")
        }
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Handle layer visibility toggle - Fix indexing logic
  const toggleLayer = (layerName: string) => {
    if (layerName in visibleLayers) {
      const key = layerName as keyof typeof visibleLayers
      setVisibleLayers((prev) => ({
        ...prev,
        [key]: !prev[key],
      }))
    } else {
      console.warn(`Attempted to toggle unknown layer: ${layerName}`)
    }
  }

  // Handle prediction result
  const handlePredictionResult = (result: PredictionResult) => {
    console.log("🗺️ MapComponent received prediction result:", result)
    console.log("🔍 Polygon data:", result.polygon ? `${result.polygon.length} points` : "no polygon data")

    setPredictionResult(result)

    // Center map on prediction area
    if (mapRef.current && result.center) {
      console.log("🎯 Centering map on:", result.center)
      mapRef.current.setView([result.center.lat, result.center.lng], 12)
    }
  }

  // Clear prediction
  const clearPrediction = () => {
    setPredictionResult(null)
  }

  // Retry loading data
  const retryLoadData = () => {
    setLoading(true)
    setError(null)
    setDataSource("api")

    // Get current map bounds for retry
    const bounds = mapRef.current ? mapRef.current.getBounds().toBBoxString() : undefined;
    const defaultBounds = { north: 50, south: 25, east: -65, west: -125 }; // Fallback

    // Helper to parse bounds string or use default (same as above)
    const parseBounds = (bboxString?: string) => {
        if (!bboxString) return defaultBounds;
        const [west, south, east, north] = bboxString.split(",").map(Number);
        if (isNaN(west) || isNaN(south) || isNaN(east) || isNaN(north)) {
            console.warn("Invalid bounds string on retry, using default bounds:", bboxString);
            return defaultBounds;
        }
        return { north, south, east, west };
    };

    const currentBounds = parseBounds(bounds);

    // Re-run the effect
    const loadData = async () => {
      try {
        // Fetch hazard sites with current bounds
        console.log("Retrying fetch hazard sites with bounds:", currentBounds);
        const sites = await fetchHazardSites(currentBounds);
        setHazardSites(sites)

        // Check if we're using mock data
        if (sites === mockHazardSites) {
          setDataSource("mock")
        }

        // Fetch AQI data
        const aqi = await fetchAQIData({
          north: 50,
          south: 25,
          east: -65,
          west: -125,
        })
        setAqiStations(aqi)

        // If hazard sites didn't set mock mode but AQI did
        if (dataSource !== "mock" && aqi === mockAQIStations) {
          setDataSource("mock")
        }

        setError(null)
      } catch (err) {
        console.error("Error reloading data:", err)
        setError("Failed to load data. Using mock data instead.")
        setDataSource("mock")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }

  return (
    <div className="relative h-screen w-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-50">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading map data...</span>
        </div>
      )}

      {error && (
        // Change variant to "destructive"
        <Alert variant="destructive" className="absolute top-4 right-4 z-50 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Data Loading Issue</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={retryLoadData} className="self-end">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {dataSource === "mock" && !error && (
        <Alert className="absolute top-4 right-4 z-50 max-w-md">
          <Info className="h-4 w-4" />
          <AlertTitle>Using Demo Data</AlertTitle>
          <AlertDescription>
            The application is currently using demonstration data. API endpoints may not be available.
          </AlertDescription>
        </Alert>
      )}

      <div className="absolute top-4 left-4 z-40 bg-white rounded-lg shadow-md p-4 max-w-xs">
        <SearchLocation
          onLocationFound={(lat, lng) => {
            if (mapRef.current) {
              mapRef.current.setView([lat, lng], 10)
            }
          }}
        />
        <div className="mt-4">
          <LayerControl layers={visibleLayers} onToggle={toggleLayer} onClearPrediction={clearPrediction} />
        </div>
      </div>

      <MapContainer
        center={[39.8283, -98.5795]}
        zoom={4}
        className="h-full w-full z-10"
        // Assign the ref directly. Remove whenReady as it doesn't take arguments
        // and we are already capturing the map instance via the ref.
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <LocationFinder />

        {/* Hazard Sites Layer */}
        {visibleLayers.hazardSites && (
          <LayerGroup>
            {hazardSites.map((site) => (
              <Marker key={site.id} position={[site.latitude, site.longitude]} icon={createHazardIcon()}>
                <Popup>
                  <div>
                    <h3 className="font-bold">{site.name}</h3>
                    <p className="text-sm">{site.type}</p>
                    <p className="text-xs mt-1">{site.description}</p>
                    {dataSource === "mock" && <p className="text-xs mt-1 text-gray-500 italic">Demo data</p>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </LayerGroup>
        )}

        {/* AQI Stations Layer */}
        {visibleLayers.aqiStations && (
          <LayerGroup>
            {aqiStations.map((station) => (
              <Marker
                key={station.id}
                position={[station.latitude, station.longitude]}
                icon={createAQIIcon(station.value)}
              >
                <Popup>
                  <div>
                    <h3 className="font-bold">{station.name}</h3>
                    <p className="text-sm">AQI: {station.value}</p>
                    <p className="text-xs mt-1">Updated: {new Date(station.lastUpdated).toLocaleString()}</p>
                    {dataSource === "mock" && <p className="text-xs mt-1 text-gray-500 italic">Demo data</p>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </LayerGroup>
        )}

        {/* Prediction Layer */}
        {predictionResult && visibleLayers.prediction && (
          <LayerGroup>
            <PredictionPolygon points={predictionResult.polygon} properties={predictionResult.properties} />
          </LayerGroup>
        )}
      </MapContainer>

      {/* Legend - Moved to bottom-left */}
      <div className="absolute bottom-4 left-4 z-40 bg-white rounded-lg shadow-md p-3">
        <h4 className="text-sm font-medium mb-2">Legend</h4>
        <div className="space-y-2">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-red-500 border border-white mr-2"></div>
            <span className="text-xs">Hazard Site</span>
          </div>
          {/* Add prediction polygon color to legend */}
          <div className="flex items-center">
            <div className="w-3 h-3" style={{ backgroundColor: '#3b82f6', opacity: 0.6 }}></div> {/* Example blue */}            
            <span className="text-xs ml-2">Prediction Area</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-green-500 border border-white mr-2"></div>
            <span className="text-xs">Good AQI (0-50)</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-yellow-500 border border-white mr-2"></div>
            <span className="text-xs">Moderate AQI (51-100)</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-orange-500 border border-white mr-2"></div>
            <span className="text-xs">Unhealthy AQI (101-150)</span>
          </div>
          {/* Add other AQI levels if needed */}
        </div>
      </div>

      {/* PredictionPanel in bottom-right */}
      <div className="absolute bottom-4 right-4 z-40 bg-white rounded-lg shadow-md p-4 max-w-sm">
        <PredictionPanel onPredictionResult={handlePredictionResult} mapRef={mapRef} />
      </div>
    </div>
  )
}

// Prediction Polygon Component
function PredictionPolygon({
  points,
  properties,
}: {
  points: [number, number][]
  properties: Record<string, any>
}) {
  const map = useMap()

  console.log("🔷 PredictionPolygon rendering with points:", points?.length)
  console.log("🔷 Properties:", properties)

  useEffect(() => {
    console.log("🔷 PredictionPolygon useEffect triggered")
    if (points && points.length > 0) {
      console.log("🔷 Creating bounds from points:", points)
      // Create a bounds object from the polygon points to fit the map
      const bounds = L.latLngBounds(points.map((point) => L.latLng(point[0], point[1])))
      console.log("🔷 Fitting map to bounds:", bounds.toString())
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [points, map])

  // Determine color based on hazard type
  let fillColor = "#3b82f6" // Default blue
  let tooltipContent = "Hazard Dispersion Area"

  if (properties && properties.hazardType) {
    switch (properties.hazardType) {
      case "gas":
        fillColor = "#10b981" // Green
        tooltipContent = "Gas Dispersion"
        break
      case "liquid":
        fillColor = "#6366f1" // Indigo
        tooltipContent = "Liquid Spill"
        break
      default:
        fillColor = "#ef4444" // Red
        tooltipContent = "Chemical Dispersion"
    }
  }

  console.log("🔷 Using fill color:", fillColor)
  console.log("🔷 Tooltip content:", tooltipContent)

  // Use Polygon component from react-leaflet
  return (
    <Polygon
      positions={points}
      pathOptions={{
        fillColor,
        fillOpacity: 0.4,
        weight: 2,
        opacity: 0.8,
        color: fillColor,
        dashArray: "5, 5",
      }}
    >
      {/* Use Tooltip component from react-leaflet */}
      <Tooltip sticky>
        <div>
          <strong>{tooltipContent}</strong>
          <div className="text-xs mt-1">
            Wind: {properties.windSpeed} mph at {properties.windDirection}°
          </div>
          <div className="text-xs">Generated: {new Date(properties.timestamp).toLocaleTimeString()}</div>
        </div>
      </Tooltip>
    </Polygon>
  )
}

// Mock data for reference
const mockHazardSites: HazardSite[] = []
const mockAQIStations: AQIStation[] = []
