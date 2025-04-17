"use client"

import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Layers, AlertTriangle, Wind } from "lucide-react"

interface LayerControlProps {
  layers: {
    hazardSites: boolean
    aqiStations: boolean
    prediction: boolean
  }
  onToggle: (layerName: string) => void
  onClearPrediction: () => void
}

export default function LayerControl({ layers, onToggle, onClearPrediction }: LayerControlProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between space-x-2">
        <Layers className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-medium">Map Layers</h3>
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Switch id="hazard-sites" checked={layers.hazardSites} onCheckedChange={() => onToggle("hazardSites")} />
          <Label htmlFor="hazard-sites" className="flex items-center">
            <AlertTriangle className="h-4 w-4 mr-2 text-red-500" />
            Hazard Sites
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch id="aqi-stations" checked={layers.aqiStations} onCheckedChange={() => onToggle("aqiStations")} />
          <Label htmlFor="aqi-stations" className="flex items-center">
            <Wind className="h-4 w-4 mr-2 text-blue-500" />
            Air Quality Stations
          </Label>
        </div>

        {layers.prediction && (
          <div className="pt-2">
            <Button variant="outline" size="sm" onClick={onClearPrediction} className="w-full">
              Clear Prediction
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
