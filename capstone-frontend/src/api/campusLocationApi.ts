// src/api/campusLocationApi.ts
import { useCrudApi } from "../utils/fetch"

export interface CampusLocation {
  id: number
  name: string
  zone: string
  latitude: number
  longitude: number
  is_active: boolean
  created_at: string
  updated_at: string
}

interface ZonesResponse {
  code: number
  data: {
    items: string[]
  }
  status: string
}

interface LocationsResponse {
  code: number
  data: {
    items: CampusLocation[]
  }
  status: string
}

// Get all zones
export const getZones = async (): Promise<string[]> => {
  const { getItems } = useCrudApi()
  const response = await getItems("/campus-locations/zones") as ZonesResponse
  return response.data.items
}

// Get buildings/locations by zone
export const getLocationsByZone = async (zone: string): Promise<CampusLocation[]> => {
  const { getItems } = useCrudApi()
  const response = await getItems(`/campus-locations?zone=${encodeURIComponent(zone)}`) as LocationsResponse
  return response.data.items
}

// Get ALL buildings/locations (for reverse lookup)
export const getAllLocations = async (): Promise<CampusLocation[]> => {
  const { getItems } = useCrudApi()
  const response = await getItems(`/campus-locations`) as LocationsResponse
  return response.data.items
}
