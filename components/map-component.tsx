"use client"

import { useEffect, useState, useRef, useCallback } from "react"
// Import Polygon, Tooltip, and DraggableWrapper from react-leaflet
import { MapContainer, TileLayer, Marker, Popup, useMap, LayerGroup, Polygon, Tooltip } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { fetchHazardSites, fetchAQIData } from "@/lib/api-client"
import LayerControl from "./layer-control"
import PredictionPanel from "./prediction-panel"
import type { HazardSite, AQIStation, PredictionResult } from "@/lib/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, AlertCircle, Info, TriangleAlert, GripVertical, Menu } from "lucide-react"
import SearchLocation from "./search-location"
import { Button } from "@/components/ui/button"
import DraggableWrapper from "./draggable-wrapper"
import { useIsMobile } from "@/hooks/use-mobile"

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
  const isMobile = useIsMobile()

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
        
        // Reset success status after a short time
        setTimeout(() => {
          setLocationStatus("idle")
        }, 2000)
      },
      (error) => {
        console.error("Error getting location:", error)
        setLocationStatus("error")

        // Handle specific error codes (1=PERMISSION_DENIED,2=POSITION_UNAVAILABLE,3=TIMEOUT)
        switch (error.code) {
          case 1:
            setErrorMessage("Location permission denied. Please enable location access in your browser settings.")
            break
          case 2:
            setErrorMessage("Location information is unavailable.")
            break
          case 3:
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
    <div className={`leaflet-top ${isMobile ? 'leaflet-right mt-16 mr-2' : 'leaflet-left mt-16'}`}>
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
        
        {locationStatus === "success" && (
          <div className="bg-white p-2 rounded-md shadow-md flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-green-500"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}

        {locationStatus === "error" && errorMessage && (
          <div className={`absolute ${isMobile ? 'top-20 left-2 right-2' : 'top-20 left-4 right-4'} bg-white p-3 rounded-md shadow-md z-50`}>
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
  const [aqiDataStatus, setAqiDataStatus] = useState<"ok" | "empty" | "error">("ok")
  const isMobile = useIsMobile()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobilePanelView, setMobilePanelView] = useState<"controls" | "prediction">("controls")

  // --- Reusable Data Loading Function ---
  const loadMapData = useCallback(async (bounds: L.LatLngBounds | undefined) => {
    setLoading(true);
    setError(null);
    setDataSource("api"); // Assume API initially

    // Define default bounds if none provided (e.g., initial load)
    const defaultBounds = { north: 50, south: 25, east: -65, west: -125 }; // Centered on US

    // Determine bounds to use
    let apiBounds = defaultBounds;
    if (bounds) {
      apiBounds = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      };
    } else {
        console.warn("loadMapData called without bounds, using default US bounds.");
    }

    console.log("🌍 Loading data for bounds:", apiBounds);

    let currentDataSource: "api" | "mock" = "api";
    let encounteredError: string | null = null;

    try {
      // Fetch hazard sites
      try {
        console.log("Fetching hazard sites with bounds:", apiBounds);
        const sites = await fetchHazardSites(apiBounds);
        setHazardSites(sites);
        // Check if mock data was returned (implementation specific)
        // Assuming fetchHazardSites returns a specific mock array instance on fallback
        // This check might need adjustment based on api-client.ts logic
        if (sites === mockHazardSites) {
           console.log("Using mock hazard sites.");
           currentDataSource = "mock";
        }
      } catch (err) {
        console.error("Error loading hazard sites:", err);
        encounteredError = "Failed to load hazard site data.";
        setHazardSites(mockHazardSites); // Fallback to mock
        currentDataSource = "mock";
      }

      // Fetch AQI data
      try {
        console.log("Fetching AQI data with bounds:", apiBounds);
        const aqi = await fetchAQIData(apiBounds);
        console.log("✅ AQI data received after search/pan:", aqi); // <-- ADD THIS LOG
        setAqiStations(aqi);
         // Check if mock data was returned (implementation specific)
        if (aqi === mockAQIStations) {
            console.log("Using mock AQI stations.");
            currentDataSource = "mock";
        }
      } catch (err) {
        console.error("Error loading AQI data:", err);
        // Append error message if hazard sites also failed
        encounteredError = encounteredError ? `${encounteredError} Also failed to load AQI data.` : "Failed to load air quality data.";
        setAqiStations(mockAQIStations); // Fallback to mock
        currentDataSource = "mock";
      }

      // Update final state
      setDataSource(currentDataSource);
      if (encounteredError) {
          setError(`${encounteredError} Displaying mock data instead.`);
      }

    } catch (globalErr) { // Catch any unexpected errors during the process
        console.error("Unexpected error loading map data:", globalErr);
        setError("An unexpected error occurred while loading map data. Using mock data.");
        setHazardSites(mockHazardSites);
        setAqiStations(mockAQIStations);
        setDataSource("mock");
    } finally {
      setLoading(false);
    }
  // mapRef dependency is potentially problematic if it causes too many re-renders.
  // However, we need it to get bounds initially. Fine-tune if needed.
  }, [mapRef]); // Add dependencies if necessary, carefully

  // Load initial data
  useEffect(() => {
    // Get initial map bounds when the component mounts
    // Use a slight delay or check if mapRef is ready if needed
    const initialBounds = mapRef.current?.getBounds();
    loadMapData(initialBounds);
  }, [loadMapData]); // Depend on the memoized loadMapData function

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
    console.log("🔄 Retrying data load...");
    const currentBounds = mapRef.current?.getBounds();
    loadMapData(currentBounds); // Use the reusable function with current bounds
  }

  const toggleMobilePanel = (view: "controls" | "prediction") => {
    if (mobilePanelView === view && mobileMenuOpen) {
      setMobileMenuOpen(false);
    } else {
      setMobilePanelView(view);
      setMobileMenuOpen(true);
    }
  };

  return (
    <div className="relative h-screen w-full">
      {loading && (
        <div data-testid="map-loader" className="absolute inset-0 flex items-center justify-center bg-white/80 z-50">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading map data...</span>
        </div>
      )}

      {error && (
        <Alert 
          variant="destructive" 
          className={`absolute z-50 ${isMobile ? 'top-16 left-2 right-2' : 'top-4 right-4 max-w-md'}`}
        >
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
        <Alert 
          className={`absolute z-50 ${isMobile ? 'top-16 left-2 right-2' : 'top-4 right-4 max-w-md'}`}
        >
          <Info className="h-4 w-4" />
          <AlertTitle>Using Demo Data</AlertTitle>
          <AlertDescription>
            The application is currently using demonstration data. API endpoints may not be available.
          </AlertDescription>
        </Alert>
      )}

      {/* MODIFIED: Data Limitations Alert - Responsive position */}
      {!isMobile && (
        <Alert variant="default" className="absolute bottom-50 left-4 z-40 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs py-2 px-3 w-44">
          <div className="flex items-start">
            <TriangleAlert className="h-3 w-3 !text-yellow-800 mt-0.5 mr-1.5" />
            <div>
              <AlertTitle className="text-xs font-semibold mb-0.5">Data Limitations</AlertTitle>
              <AlertDescription className="text-xs leading-tight">
                AQI and hazard site data may be incomplete in some regions.
              </AlertDescription>
            </div>
          </div>
        </Alert>
      )}

      {/* Mobile Controls */}
      {isMobile && (
        <div className="absolute top-2 right-2 z-50 flex gap-2">
          <Button 
            data-testid="mobile-menu-button"
            variant={mobilePanelView === "controls" && mobileMenuOpen ? "default" : "outline"}
            size="sm"
            onClick={() => toggleMobilePanel("controls")}
            className="rounded-full p-2 h-10 w-10 flex items-center justify-center shadow-md bg-white"
          >
            <Menu size={18} />
          </Button>
          <Button 
            variant={mobilePanelView === "prediction" && mobileMenuOpen ? "default" : "outline"}
            size="sm"
            onClick={() => toggleMobilePanel("prediction")}
            className="rounded-full p-2 h-10 w-10 flex items-center justify-center shadow-md bg-white"
          >
            <TriangleAlert size={18} />
          </Button>
        </div>
      )}

      {/* Responsive panels */}
      {isMobile ? (
        <>
          {/* Mobile Panel */}
          <div 
            className={`absolute z-40 bg-white rounded-lg shadow-md p-3 transition-all duration-300 
                       ${mobileMenuOpen ? 'top-14 left-2 right-2' : 'top-14 -right-full'}`}
          >
            {mobilePanelView === "controls" && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium mb-2">Search & Controls</h4>
                <SearchLocation
                  onLocationFound={(lat, lng) => {
                    if (mapRef.current) {
                      mapRef.current.setView([lat, lng], 10);
                      setTimeout(() => {
                        const newBounds = mapRef.current?.getBounds();
                        loadMapData(newBounds);
                      }, 500);
                      // Close mobile panel after search
                      setMobileMenuOpen(false);
                    }
                  }}
                />
                <div className="mt-2">
                  <LayerControl 
                    layers={visibleLayers} 
                    onToggle={toggleLayer} 
                    onClearPrediction={clearPrediction} 
                  />
                </div>
              </div>
            )}
            {mobilePanelView === "prediction" && (
              <div>
                <PredictionPanel 
                  onPredictionResult={(result) => {
                    handlePredictionResult(result);
                    // Close panel after prediction on mobile
                    setMobileMenuOpen(false);
                  }} 
                  mapRef={mapRef}
                />
              </div>
            )}
          </div>
          
          {/* Mobile-optimized legend at bottom */}
          <div className="absolute bottom-2 left-2 z-40 bg-white/95 rounded-lg shadow-md p-2 max-w-xs">
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-red-500 border border-white mr-1"></div>
                <span className="text-xs">Hazard</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3" style={{ backgroundColor: '#3b82f6', opacity: 0.6 }}></div>
                <span className="text-xs ml-1">Prediction</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-green-500 border border-white mr-1"></div>
                <span className="text-xs">Good AQI</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Desktop Draggable Search and Layer Control Panel */}
          <DraggableWrapper
            handle=".drag-handle-panel"
            bounds="parent"
            defaultPosition={{ x: 16, y: 16 }}
          >
            <div className="absolute z-40 bg-white rounded-lg shadow-md p-4 w-xs pointer-events-auto">
              <div className="drag-handle-panel cursor-move absolute top-2 right-2 text-gray-400 hover:text-gray-600">
                <GripVertical size={16} />
              </div>

              <SearchLocation
                onLocationFound={(lat, lng) => {
                  if (mapRef.current) {
                    console.log(`🚀 Location found via search: ${lat}, ${lng}. Reloading data.`);
                    mapRef.current.setView([lat, lng], 10)
                    setTimeout(() => {
                      const newBounds = mapRef.current?.getBounds();
                      loadMapData(newBounds);
                    }, 500);
                  }
                }}
              />
              <div className="mt-4">
                <LayerControl layers={visibleLayers} onToggle={toggleLayer} onClearPrediction={clearPrediction} />
              </div>
            </div>
          </DraggableWrapper>

          {/* Desktop Legend */}
          <div className="absolute bottom-4 left-4 z-40 bg-white rounded-lg shadow-md p-3">
            <h4 className="text-sm font-medium mb-2">Legend</h4>
            <div className="space-y-2">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-red-500 border border-white mr-2"></div>
                <span className="text-xs">Hazard Site</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3" style={{ backgroundColor: '#3b82f6', opacity: 0.6 }}></div>
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
            </div>
          </div>

          {/* Desktop Prediction Panel */}
          <div className="absolute bottom-4 right-4 z-40 bg-white rounded-lg shadow-md p-4 max-w-sm">
            <PredictionPanel onPredictionResult={handlePredictionResult} mapRef={mapRef} />
          </div>
        </>
      )}

      <MapContainer
        center={[39.8283, -98.5795]}
        zoom={4}
        className="h-full w-full z-10"
        ref={mapRef}
        zoomControl={!isMobile} // Hide default zoom controls on mobile
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
    </div>
  )
}

// Prediction Polygon Component
function PredictionPolygon({
  points,
  properties = {},
}: {
  points: [number, number][]
  properties?: Record<string, any>
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
      {properties && (
      <Tooltip sticky>
        <div>
          <strong>{tooltipContent}</strong>
          <div className="text-xs mt-1">
            Wind: {properties.windSpeed ?? ''} mph at {properties.windDirection ?? ''}°
          </div>
          <div className="text-xs">Generated: {properties.timestamp ? new Date(properties.timestamp).toLocaleTimeString() : ''}</div>
        </div>
      </Tooltip>
      )}
    </Polygon>
  )
}

// Mock data for reference
const mockHazardSites: HazardSite[] = []
const mockAQIStations: AQIStation[] = []
