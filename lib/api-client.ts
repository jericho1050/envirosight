import type { HazardSite, AQIStation, PredictionResult, WeatherData } from "./types"
import { createClient } from '@supabase/supabase-js'
import type { ChemicalOption } from "./types"

// Base URL for Supabase Edge Functions
const EDGE_FUNCTION_URL = process.env.NEXT_PUBLIC_SUPABASE_FUNCTION_URL || ""
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// Headers for Supabase function calls
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
}

/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 500): Promise<T> {
  let retries = 0
  let delay = initialDelay

  while (true) {
    try {
      return await fn()
    } catch (error) {
      if (retries >= maxRetries) {
        throw error
      }

      console.log(`Retry attempt ${retries + 1} after ${delay}ms delay`)
      await new Promise((resolve) => setTimeout(resolve, delay))

      retries++
      delay *= 2 // Exponential backoff
    }
  }
}

/**
 * Check if the Supabase Edge Functions are available
 * This helps determine if we should attempt API calls or use mock data
 */
let edgeFunctionsAvailable: boolean | null = null

async function checkEdgeFunctionsAvailability(): Promise<boolean> {
  if (edgeFunctionsAvailable !== null) {
    return edgeFunctionsAvailable
  }

  if (!EDGE_FUNCTION_URL || !SUPABASE_ANON_KEY) {
    console.warn("Supabase configuration missing. Using mock data.")
    edgeFunctionsAvailable = false
    return false
  }

  try {
    // Check availability by trying to call the actual prediction function
    // with minimal dummy data. A 404 means it's not deployed/available.
    // Other errors (like 400 Bad Request) still mean the function *exists*.
    console.log(`Checking edge function availability via: ${EDGE_FUNCTION_URL}/run-dispersion-prediction`)
    const response = await fetch(`${EDGE_FUNCTION_URL}/run-dispersion-prediction`, {
      method: "POST", // Use POST as required by the function
      headers: headers, // Include auth headers
      body: JSON.stringify({
        // Send minimal valid payload for the check
        latitude: 0,
        longitude: 0,
        chemical_id: 1, // Assuming chemical ID 1 exists
      }),
    }).catch(() => null) // Catch network errors

    console.log("the response in edge function", response);

    // If we get a response, and it's NOT a 404, the function path exists.
    edgeFunctionsAvailable = response !== null && response.status !== 404
    console.log(`Edge function availability check result: ${edgeFunctionsAvailable} (status: ${response?.status})`)
    return edgeFunctionsAvailable
  } catch (error) {
    // This catch might not be strictly necessary with .catch(null) above,
    // but kept for safety.
    console.warn("Edge functions availability check failed unexpectedly:", error)
    edgeFunctionsAvailable = false
    return false
  }
}

// Fetch hazard sites from Supabase
export async function fetchHazardSites(): Promise<HazardSite[]> {
  try {
    // Check if edge functions are available before attempting API call
    const available = await checkEdgeFunctionsAvailability()

    if (!available) {
      console.info("Using mock hazard sites data")
      return mockHazardSites
    }

    return await retryWithBackoff(async () => {
      console.log("Fetching hazard sites from:", `${EDGE_FUNCTION_URL}/get-hazard-sites`)

      const response = await fetch(`${EDGE_FUNCTION_URL}/get-hazard-sites`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error")
        console.error(`Hazard sites API error (${response.status}):`, errorText)

        if (response.status === 404) {
          throw new Error(`Endpoint not found: /get-hazard-sites. Please check if the function is deployed.`)
        }

        throw new Error(`API error: ${response.status} - ${errorText}`)
      }

      return await response.json()
    })
  } catch (error) {
    console.error("Error fetching hazard sites (using mock data):", error)
    // Always fall back to mock data
    return mockHazardSites
  }
}

// Fetch AQI data from Supabase function (which proxies to AQI API)
export async function fetchAQIData(bounds: {
  north: number
  south: number
  east: number
  west: number
}): Promise<AQIStation[]> {
  try {
    // Check if edge functions are available before attempting API call
    const available = await checkEdgeFunctionsAvailability()

    if (!available) {
      console.info("Using mock AQI data")
      return mockAQIStations
    }

    return await retryWithBackoff(async () => {
      console.log("Fetching AQI data from:", `${EDGE_FUNCTION_URL}/get-aqi-data`)

      const response = await fetch(`${EDGE_FUNCTION_URL}/get-aqi-data`, {
        method: "POST",
        headers,
        body: JSON.stringify(bounds),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error")
        console.error(`AQI data API error (${response.status}):`, errorText)

        if (response.status === 404) {
          throw new Error(`Endpoint not found: /get-aqi-data. Please check if the function is deployed.`)
        }

        throw new Error(`API error: ${response.status} - ${errorText}`)
      }

      return await response.json()
    })
  } catch (error) {
    console.error("Error fetching AQI data (using mock data):", error)
    // Always fall back to mock data
    return mockAQIStations
  }
}

// Get weather data for a location
export async function getWeatherData(location: {
  lat: number
  lng: number
}): Promise<WeatherData> {
  try {
    // Check if edge functions are available before attempting API call
    const available = await checkEdgeFunctionsAvailability()

    if (!available) {
      console.info("Using mock weather data")
      return {
        windSpeed: 12,
        windDirection: 225, // SW wind
        temperature: 72,
        humidity: 45,
        timestamp: new Date().toISOString(),
      }
    }

    return await retryWithBackoff(async () => {
      console.log("Fetching weather data from:", `${EDGE_FUNCTION_URL}/get-weather-data`)

      const response = await fetch(`${EDGE_FUNCTION_URL}/get-weather-data`, {
        method: "POST",
        headers,
       body: JSON.stringify({ latitude: location.lat, longitude: location.lng }),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error")
        console.error(`Weather data API error (${response.status}):`, errorText)

        if (response.status === 404) {
          throw new Error(`Endpoint not found: /get-weather-data. Please check if the function is deployed.`)
        }

        throw new Error(`API error: ${response.status} - ${errorText}`)
      }

      return await response.json()
    })
  } catch (error) {
    console.error("Error fetching weather data (using mock data):", error)
    // Fall back to mock data
    return {
      windSpeed: 12,
      windDirection: 225, // SW wind
      temperature: 72,
      humidity: 45,
      timestamp: new Date().toISOString(),
    }
  }
}

// Run prediction simulation
export async function runPrediction(params: {
  location: { lat: number; lng: number }
  hazardType: string
  chemical_id: number
  weather: WeatherData
}): Promise<PredictionResult> {
  console.log("🚀 runPrediction called with params:", JSON.stringify(params, null, 2))

  try {
    // Check if edge functions are available before attempting API call
    const available = await checkEdgeFunctionsAvailability()
    console.log("🔌 Edge functions available:", available)

    if (!available) {
      console.info("📊 Using client-side prediction (edge functions unavailable)")
      const clientResult = clientSidePrediction(params.location, params.weather, params.hazardType, params.chemical_id)
      console.log("📊 Client-side prediction result:", clientResult)
      return clientResult
    }

    return await retryWithBackoff(async () => {
      const apiUrl = `${EDGE_FUNCTION_URL}/run-dispersion-prediction`
      console.log("📡 Calling API endpoint:", apiUrl)
      console.log(
        "📦 Request payload:",
        JSON.stringify(
          {
            latitude: params.location.lat,
            longitude: params.location.lng,
            chemical_id: params.chemical_id,
          },
          null,
          2,
        ),
      )

      const response = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          latitude: params.location.lat,
          longitude: params.location.lng,
          chemical_id: params.chemical_id,
        }),
      })

      console.log("📥 API response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error")
        console.error(`❌ Prediction API error (${response.status}):`, errorText)

        if (response.status === 404) {
          throw new Error(`Endpoint not found: /run-dispersion-prediction. Please check if the function is deployed.`)
        }

        throw new Error(`API error: ${response.status} - ${errorText}`)
      }

      const geoJson = await response.json()
      console.log("📊 GeoJSON response:", JSON.stringify(geoJson, null, 2))

      // Convert GeoJSON to our internal format
      const result = {
        center: params.location,
        polygon: geoJson.geometry.coordinates[0].map((coord: number[]) => [coord[1], coord[0]]),
        properties: {
          hazardType: params.hazardType,
          windSpeed: params.weather.windSpeed,
          windDirection: params.weather.windDirection,
          timestamp: new Date().toISOString(),
          chemical: geoJson.properties.chemical,
        },
      }

      console.log("🔄 Converted prediction result:", JSON.stringify(result, null, 2))
      return result
    })
  } catch (error) {
    console.error("❌ Error running prediction (using client-side fallback):", error)
    // Fallback to client-side calculation
    const fallbackResult = clientSidePrediction(params.location, params.weather, params.hazardType, params.chemical_id)
    console.log("🔄 Client-side fallback result:", fallbackResult)
    return fallbackResult
  }
}

// Client-side fallback prediction calculation
function clientSidePrediction(
  location: { lat: number; lng: number },
  weather: WeatherData,
  hazardType: string,
  chemical_id: number,
): PredictionResult {
  console.log("🧮 Running client-side prediction with:", { location, weather, hazardType, chemical_id })

  // Convert wind direction to radians (meteorological to mathematical)
  const windDirRadians = ((270 - weather.windDirection) * Math.PI) / 180
  console.log("🧭 Wind direction in radians:", windDirRadians)

  // Create a simple ellipse in the wind direction
  // Size based on wind speed and hazard type
  let majorAxis = weather.windSpeed * 0.0005 // Roughly 50m per wind speed unit
  const minorAxis = majorAxis * 0.5 // half as wide as it is long
  console.log("📏 Ellipse axes:", { majorAxis, minorAxis })

  // Adjust based on hazard type
  if (hazardType === "gas") {
    majorAxis *= 2 // gases disperse further
    console.log("💨 Adjusted major axis for gas:", majorAxis)
  }

  // Generate points for an ellipse in the wind direction
  const points: [number, number][] = []
  const numPoints = 24

  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI
    const x = majorAxis * Math.cos(angle)
    const y = minorAxis * Math.sin(angle)

    // Rotate by wind direction
    const rotatedX = x * Math.cos(windDirRadians) - y * Math.sin(windDirRadians)
    const rotatedY = x * Math.sin(windDirRadians) + y * Math.cos(windDirRadians)

    // Convert to lat/lng (approximate)
    const latOffset = rotatedY
    const lngOffset = rotatedX / Math.cos((location.lat * Math.PI) / 180)

    points.push([location.lat + latOffset, location.lng + lngOffset])
  }

  // Close the polygon by repeating the first point
  if (points.length > 0) {
    points.push([...points[0]])
  }

  console.log("📍 Generated polygon points:", points.length)

  const result = {
    center: location,
    polygon: points,
    properties: {
      hazardType,
      windSpeed: weather.windSpeed,
      windDirection: weather.windDirection,
      timestamp: new Date().toISOString(),
    },
  }

  console.log("🔄 Client-side prediction result:", result)
  return result
}

// --- Add this new function --- 
/**
 * Fetches the list of available chemicals for the prediction panel dropdown.
 */
export async function fetchChemicalOptions(): Promise<ChemicalOption[]> {
  // Determine base Supabase URL (project URL), falling back to function URL by stripping the /functions path
  const functionUrl = process.env.NEXT_PUBLIC_SUPABASE_FUNCTION_URL || ""
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || functionUrl.replace(/\/functions.*$/, "")
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase URL or Anon Key missing for fetching chemicals.")
    return [] // Return empty array or throw error
  }

  // Create a Supabase client instance
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  try {
    const { data, error } = await supabase
      .from("chemical_properties") // Ensure this table name is correct
      .select("id, name, hazard_type") // Ensure these column names are correct

    if (error) {
      console.error("Supabase error fetching chemicals:", error)
      throw error
    }

    console.log("🧪 Chemicals fetched from Supabase:", data) // <-- ADD THIS LOG

    // Map the data to the ChemicalOption type
    const options: ChemicalOption[] = data
      ? data.map((item) => ({
          id: item.id,
          name: item.name,
          hazard_type: item.hazard_type,
        }))
      : []

    return options
  } catch (err) {
    console.error("Error in fetchChemicalOptions:", err)
    return [] // Return empty on error
  }
}
// --- End of new function ---

// Mock data for development
const mockHazardSites: HazardSite[] = [
  {
    id: "1",
    name: "Chemical Plant Alpha",
    type: "Industrial",
    latitude: 40.7128,
    longitude: -74.006,
    description: "Large chemical manufacturing facility with various hazardous materials.",
  },
  {
    id: "2",
    name: "Refinery Beta",
    type: "Oil & Gas",
    latitude: 34.0522,
    longitude: -118.2437,
    description: "Oil refinery with potential for volatile organic compound releases.",
  },
  {
    id: "3",
    name: "Waste Treatment Facility",
    type: "Waste Management",
    latitude: 41.8781,
    longitude: -87.6298,
    description: "Hazardous waste treatment and storage facility.",
  },
  {
    id: "4",
    name: "Agricultural Supply Center",
    type: "Agricultural",
    latitude: 39.7392,
    longitude: -104.9903,
    description: "Storage of pesticides, fertilizers, and other agricultural chemicals.",
  },
  {
    id: "5",
    name: "Research Laboratory",
    type: "Research",
    latitude: 37.7749,
    longitude: -122.4194,
    description: "Research facility working with various chemical compounds.",
  },
]

const mockAQIStations: AQIStation[] = [
  {
    id: "a1",
    name: "Downtown Monitor",
    latitude: 40.7128,
    longitude: -74.01,
    value: 42,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "a2",
    name: "Westside Station",
    latitude: 34.05,
    longitude: -118.25,
    value: 87,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "a3",
    name: "Lakefront Monitor",
    latitude: 41.88,
    longitude: -87.63,
    value: 125,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "a4",
    name: "Mountain View Station",
    latitude: 39.74,
    longitude: -104.99,
    value: 65,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "a5",
    name: "Bay Area Monitor",
    latitude: 37.77,
    longitude: -122.42,
    value: 110,
    lastUpdated: new Date().toISOString(),
  },
]
