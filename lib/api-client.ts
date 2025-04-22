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

// Fetch hazard sites from Supabase within the given map bounds.
export async function fetchHazardSites(bounds: {
  north: number
  south: number
  east: number
  west: number
} | undefined): Promise<HazardSite[]> { // Allow bounds to be potentially undefined
  // --- BEGIN ADDED CHECK ---
  // Check if bounds are valid before proceeding
  if (!bounds || bounds.north === undefined || bounds.south === undefined || bounds.east === undefined || bounds.west === undefined) {
    console.warn("fetchHazardSites called with invalid or undefined bounds. Returning mock data.", bounds);
    // Return mock data immediately (or an empty array if preferred)
    // Note: Filtering mock data here might not make sense if bounds are invalid.
    return mockHazardSites; // Consider returning [] if mock data shouldn't be shown without valid bounds
  }
  // --- END ADDED CHECK ---

  try {
    return await retryWithBackoff(async () => {
      console.log("Fetching hazard sites from:", `${EDGE_FUNCTION_URL}/get-hazard-sites`, "with bounds:", bounds) // Log bounds

      const response = await fetch(`${EDGE_FUNCTION_URL}/get-hazard-sites`, {
        method: "POST",
        headers,
        body: JSON.stringify(bounds), // Send the bounds in the body
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error")
        console.error(`Hazard sites API error (${response.status}):`, errorText)

        if (response.status === 404) {
          throw new Error(`Endpoint not found: /get-hazard-sites. Please check if the function is deployed.`)
        }
        // Specific check for 400 related to bounds
        if (response.status === 400 && errorText.includes("Missing map bounds")) {
             console.error("API Error: The server reported missing map bounds. Check if the bounds object is correctly passed:", bounds);
             throw new Error(`API error: 400 - Missing map bounds. Client sent: ${JSON.stringify(bounds)}`);
        }

        throw new Error(`API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      
      // Check if this is likely the initial US-wide view and the data is empty
      const isDefaultUsBounds = 
        bounds?.north === 50 && 
        bounds?.south === 25 && 
        bounds?.east === -65 && 
        bounds?.west === -125;
      
      // If no results but we're at default US bounds, return mock data
      // so users see something on initial load
      if (Array.isArray(data) && data.length === 0 && isDefaultUsBounds) {
        console.log("Empty hazard sites response for initial US view. Using mock data for better initial experience.");
        return mockHazardSites;
      }
      
      return data
    })
  } catch (error) {
    console.error("Error fetching hazard sites (using mock data):", error)
    // Fallback logic: Return the direct mock reference on error
    return mockHazardSites;
  }
}

// New function to fetch AQI data by city name
export async function fetchAQIDataByCity(cityName: string): Promise<AQIStation[]> {
  try {
    return await retryWithBackoff(async () => {
      console.log("Fetching AQI data for city:", cityName);

      const response = await fetch(`${EDGE_FUNCTION_URL}/get-aqi-by-city`, {
        method: "POST",
        headers,
        body: JSON.stringify({ city: cityName }),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error")
        console.error(`AQI city data API error (${response.status}):`, errorText)

        if (response.status === 404) {
          throw new Error(`Endpoint not found: /get-aqi-by-city. Please check if the function is deployed.`)
        }
        
        throw new Error(`API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json();
      console.log("✅ City AQI data received:", data);
      
      if (Array.isArray(data) && data.length === 0) {
        console.log("ℹ️ No AQI stations found for city:", cityName);
      }
      
      return data;
    })
  } catch (error) {
    console.error("❌ Error fetching AQI data by city. Falling back to mock data.", {
      cityQueried: cityName,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorDetails: error
    });
    
    return mockAQIStations
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
    return await retryWithBackoff(async () => {
      console.log("Fetching AQI data from:", `${EDGE_FUNCTION_URL}/get-aqi-data`, "with bounds:", bounds); // Log bounds here too

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
        // Add specific check for 400 related to bounds
        if (response.status === 400 && errorText.includes("Missing map bounds")) {
             console.error("API Error: The server reported missing map bounds for AQI. Check if the bounds object is correctly passed:", bounds);
             throw new Error(`API error: 400 - Missing map bounds for AQI. Client sent: ${JSON.stringify(bounds)}`);
        }

        throw new Error(`API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json();
      console.log("✅ Raw AQI data received from API:", data); // Log raw data
      
      // Add a check if the API returned an empty array successfully
      if (Array.isArray(data) && data.length === 0) {
        console.log("ℹ️ AQI API returned an empty array for these bounds. Attempting city-based fallback...");
        
        // Extract a city/country name from the bounds center for fallback
        // We'll estimate the center of the bounds to use for geocoding
        const centerLat = (bounds.north + bounds.south) / 2;
        const centerLng = (bounds.east + bounds.west) / 2;
        
        try {
          // Get a location name from coordinates using reverse geocoding
          const locationName = await getLocationNameFromCoordinates(centerLat, centerLng);
          console.log(`📍 Detected location for AQI fallback: ${locationName}`);
          
          if (locationName) {
            // Try fetching by city name instead
            const cityData = await fetchAQIDataByCity(locationName);
            if (cityData && cityData.length > 0) {
              console.log(`✅ Successfully retrieved ${cityData.length} AQI stations by city name fallback`);
              return cityData;
            }
          }
        } catch (reverseGeoError) {
          console.error("Failed in reverse geocoding for AQI city fallback:", reverseGeoError);
        }
      }
      
      return data;
    })
  } catch (error) {
    // --- IMPROVED LOGGING ---
    console.error("❌ Error fetching AQI data. Falling back to mock data.", {
        boundsUsed: bounds, // Log the bounds that caused the error
        errorMessage: error instanceof Error ? error.message : String(error),
        errorDetails: error // Log the full error object
    });
    // --- END IMPROVEMENT ---
    // Always fall back to mock data
    return mockAQIStations // This is still []
  }
}

/**
 * Helper function to get a location name from coordinates
 * Uses a simple reverse geocoding approach
 */
async function getLocationNameFromCoordinates(lat: number, lng: number): Promise<string | null> {
  try {
    // Use Nominatim OpenStreetMap service for reverse geocoding
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, 
      { headers: { 'User-Agent': 'EnviroSight/1.0' } } // Be polite with a user-agent
    );
    
    if (!response.ok) throw new Error(`Geocoding failed with status: ${response.status}`);
    
    const data = await response.json();
    
    // Extract the most relevant location name (city or country)
    // Nominatim returns different admin levels we can use
    const city = data.address?.city || 
                 data.address?.town || 
                 data.address?.village || 
                 data.address?.county;
                 
    const country = data.address?.country;
    
    // Return city if available, otherwise country, or null if neither exists
    return city || country || null;
  } catch (error) {
    console.error("Error in reverse geocoding:", error);
    return null;
  }
}

// Get weather data for a location
export async function getWeatherData(location: {
  lat: number
  lng: number
}): Promise<WeatherData> {
  try {
    return await retryWithBackoff(async () => {
      console.log("Fetching weather data from:", `${EDGE_FUNCTION_URL}/get-weather-data`)

      const response = await fetch(`${EDGE_FUNCTION_URL}/get-weather-data`, {
        method: "POST",
        headers,
       body: JSON.stringify({ lat: location.lat, lon: location.lng }), // Corrected keys
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
  console.log("🚀 runPrediction called with params (using default stack settings):", JSON.stringify(params, null, 2))

  try {
    return await retryWithBackoff(async () => {
      const apiUrl = `${EDGE_FUNCTION_URL}/run-dispersion-prediction`
      console.log("📡 Calling API endpoint:", apiUrl)

      // Simplified payload: only required parameters
      const payload = {
        latitude: params.location.lat,
        longitude: params.location.lng,
        chemical_id: params.chemical_id,
      }
      // Removed conditional addition of stack parameters

      console.log("📦 Request payload:", JSON.stringify(payload, null, 2))

      const response = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      })

      console.log("📥 API response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error")
        console.error(`❌ Prediction API error (${response.status}):`, errorText)

        if (response.status === 404) {
          throw new Error(`Endpoint not found: /run-dispersion-prediction. Check deployment.`)
        }
        // Removed specific error check for stack parameters

        throw new Error(`API error: ${response.status} - ${errorText}`)
      }

      const geoJson = await response.json()
      console.log("📊 GeoJSON response:", JSON.stringify(geoJson, null, 2))

      // Convert GeoJSON to our internal format
      const result = {
        center: params.location,
        polygon: geoJson.geometry.coordinates[0].map((coord: number[]) => [coord[1], coord[0]]),
        properties: {
          hazardType: geoJson.properties.chemical?.hazard_type || params.hazardType,
          windSpeed: params.weather.windSpeed,
          windDirection: params.weather.windDirection,
          timestamp: new Date().toISOString(),
          chemical: geoJson.properties.chemical,
          model_type: geoJson.properties.model_type || "Simplified Model"
        },
      }

      console.log("🔄 Converted prediction result:", JSON.stringify(result, null, 2))
      return result
    })
  } catch (error) {
    console.error("❌ Error running prediction (using client-side fallback):", error)
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

// Mock data for development with realistic sites
const mockHazardSites: HazardSite[] = [
  // Northeast/New England
  {
    id: "m1",
    name: "Love Canal",
    type: "Superfund Site",
    latitude: 43.0806,
    longitude: -79.0016, // Niagara Falls, NY
    description: "Former chemical waste dump and one of America's most notorious hazardous waste sites."
  },
  {
    id: "m2", 
    name: "Bayway Refinery",
    type: "Oil & Gas",
    latitude: 40.6366,
    longitude: -74.2173, // Linden, NJ
    description: "Major petroleum refining facility with capacity of over 250,000 barrels per day."
  },
  {
    id: "m3",
    name: "Sparrows Point Steel Mill",
    type: "Industrial",
    latitude: 39.2171,
    longitude: -76.4572, // Baltimore, MD
    description: "Historic steelmaking facility with soil and groundwater contamination."
  },
  // Southeast
  {
    id: "m4",
    name: "Savannah River Site",
    type: "Nuclear",
    latitude: 33.3461,
    longitude: -81.7348, // Aiken, SC
    description: "Nuclear reservation used for nuclear materials processing and environmental remediation."
  },
  {
    id: "m5",
    name: "Houston Ship Channel Industrial Complex",
    type: "Industrial",
    latitude: 29.7362,
    longitude: -95.2453, // Houston, TX
    description: "One of the world's largest petrochemical complexes with multiple facilities."
  },
  {
    id: "m6",
    name: "Anniston Army Depot",
    type: "Military/Industrial",
    latitude: 33.6135,
    longitude: -85.9561, // Anniston, AL
    description: "Military industrial site with historical PCB contamination."
  },
  // Midwest
  {
    id: "m7",
    name: "U.S. Steel Gary Works",
    type: "Industrial",
    latitude: 41.6068,
    longitude: -87.3290, // Gary, IN
    description: "One of the largest steel mills in North America with significant environmental impact."
  },
  {
    id: "m8",
    name: "Bunker Hill Mining Complex",
    type: "Mining",
    latitude: 47.5472,
    longitude: -116.1115, // Kellogg, ID
    description: "One of the nation's largest Superfund sites with lead and metal contamination."
  },
  {
    id: "m9",
    name: "Hanford Nuclear Reservation",
    type: "Nuclear",
    latitude: 46.5511,
    longitude: -119.4880, // Richland, WA
    description: "Former nuclear production site, now the most contaminated nuclear site in the United States."
  },
  // Southwest
  {
    id: "m10",
    name: "Anaconda Copper Mine",
    type: "Mining",
    latitude: 39.4894,
    longitude: -119.2137, // Yerington, NV
    description: "Former copper mine with widespread soil and groundwater contamination."
  },
  {
    id: "m11",
    name: "Tar Creek Superfund Site",
    type: "Mining",
    latitude: 36.9400,
    longitude: -94.8700, // Picher, OK
    description: "Former lead and zinc mining area with severe soil and water contamination."
  },
  // West Coast
  {
    id: "m12",
    name: "Port of Los Angeles",
    type: "Industrial",
    latitude: 33.7360,
    longitude: -118.2614, // Los Angeles, CA
    description: "Major port complex with multiple industrial facilities and historical contamination."
  },
  {
    id: "m13",
    name: "Portland Harbor Superfund Site",
    type: "Industrial",
    latitude: 45.6075,
    longitude: -122.7636, // Portland, OR
    description: "Contaminated 10-mile stretch of the Willamette River with industrial pollutants."
  },
  {
    id: "m14",
    name: "Rocky Flats Plant",
    type: "Nuclear",
    latitude: 39.8883,
    longitude: -105.2049, // Golden, CO
    description: "Former nuclear weapons production facility with plutonium contamination."
  },
  {
    id: "m15",
    name: "Libby Asbestos Site",
    type: "Mining/Industrial",
    latitude: 48.3880,
    longitude: -115.5566, // Libby, MT
    description: "Former vermiculite mine and surrounding area with widespread asbestos contamination."
  }
];

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
