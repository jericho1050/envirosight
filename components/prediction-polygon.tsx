"use client"

import { useEffect } from "react"
import { Polygon, Tooltip, useMap } from "react-leaflet"
import L from "leaflet"
import type { PredictionResult } from "@/lib/types"

interface PredictionPolygonProps {
  prediction: PredictionResult
}

export default function PredictionPolygon({ prediction }: PredictionPolygonProps) {
  const map = useMap()

  useEffect(() => {
    if (prediction && prediction.center) {
      // Optionally center the map on the prediction
      // map.setView([prediction.center.lat, prediction.center.lng], 12)

      // Create a bounds object from the polygon points to fit the map
      if (prediction.polygon && prediction.polygon.length > 0) {
        const bounds = L.latLngBounds(prediction.polygon.map((point) => L.latLng(point[0], point[1])))
        map.fitBounds(bounds, { padding: [50, 50] })
      }
    }
  }, [prediction, map])

  if (!prediction || !prediction.polygon || prediction.polygon.length === 0) {
    return null
  }

  // Determine color based on hazard type
  let fillColor = "#3b82f6" // Default blue
  let tooltipContent = "Hazard Dispersion Area"

  if (prediction.properties && prediction.properties.hazardType) {
    switch (prediction.properties.hazardType) {
      case "ammonia":
        fillColor = "#10b981" // Green
        tooltipContent = "Ammonia Gas Dispersion"
        break
      case "chlorine":
        fillColor = "#f59e0b" // Yellow
        tooltipContent = "Chlorine Gas Dispersion"
        break
      case "oil":
        fillColor = "#6366f1" // Indigo
        tooltipContent = "Oil Spill Dispersion"
        break
      case "chemical":
        fillColor = "#ef4444" // Red
        tooltipContent = "Chemical Spill Dispersion"
        break
    }
  }

  return (
    <Polygon
      positions={prediction.polygon}
      pathOptions={{
        fillColor,
        fillOpacity: 0.4,
        weight: 2,
        opacity: 0.8,
        color: fillColor,
        dashArray: "5, 5",
      }}
    >
      <Tooltip sticky>
        <div>
          <strong>{tooltipContent}</strong>
          <div className="text-xs mt-1">
            Wind: {prediction.properties.windSpeed} mph at {prediction.properties.windDirection}°
          </div>
          <div className="text-xs">Generated: {new Date(prediction.properties.timestamp).toLocaleTimeString()}</div>
        </div>
      </Tooltip>
    </Polygon>
  )
}
