// Hazard site data structure
export interface HazardSite {
  id: string
  name: string
  type: string
  latitude: number
  longitude: number
  description: string
}

// AQI station data structure
export interface AQIStation {
  id: string
  name: string
  latitude: number
  longitude: number
  value: number
  lastUpdated: string
}

// Weather data structure
export interface WeatherData {
  windSpeed: number
  windDirection: number
  temperature: number
  humidity: number
  timestamp: string
}

// Prediction result structure
export interface PredictionResult {
  center: {
    lat: number
    lng: number
  }
  polygon: [number, number][]
  properties: {
    hazardType: string
    windSpeed: number
    windDirection: number
    timestamp: string
    chemical?: {
      id: number
      name: string
      volatility_level: number
      solubility_level: number
      hazard_type: string
    }
  }
}
