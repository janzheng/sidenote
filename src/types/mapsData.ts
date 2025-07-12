export interface Coordinates {
  lat: number;
  lng: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface SearchResult {
  name: string;
  address: string;
  coordinates: Coordinates;
  rating?: number;
  priceLevel?: number;
  types: string[];
  placeId?: string;
  phoneNumber?: string;
  website?: string;
  openingHours?: string[];
  photos?: string[];
}

export interface RouteStep {
  instruction: string;
  distance: string;
  duration: string;
  coordinates: Coordinates[];
}

export interface RouteData {
  origin: {
    address: string;
    coordinates: Coordinates;
  };
  destination: {
    address: string;
    coordinates: Coordinates;
  };
  waypoints?: {
    address: string;
    coordinates: Coordinates;
  }[];
  distance: string;
  duration: string;
  steps: RouteStep[];
  routeType: 'driving' | 'walking' | 'transit' | 'cycling';
  extractedAt: number;
  routeOptions?: {
    duration: string;
    distance: string;
    routeType: string;
    index: number;
  }[];
}

export interface TrafficInfo {
  level: 'light' | 'moderate' | 'heavy' | 'severe';
  description?: string;
}

export interface MapsData {
  // Current map state
  currentLocation: Coordinates | null;
  visibleBounds: MapBounds | null;
  mapType: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
  zoomLevel: number;
  
  // Search and places data
  searchQuery: string | null;
  searchResults: SearchResult[];
  selectedPlace: SearchResult | null;
  
  // Route information
  currentRoute: RouteData | null;
  
  // Traffic and conditions
  trafficInfo: TrafficInfo | null;
  
  // Metadata
  url: string;
  extractedAt: number;
  extractionMethod: 'dom-scraping' | 'url-parsing';
}

export interface MapsExtractionResult {
  success: boolean;
  data?: MapsData;
  error?: string;
}

export interface MapsControlResult {
  success: boolean;
  action: string;
  result?: any;
  error?: string;
}

export interface MapsControlCommand {
  action: 'zoom_in' | 'zoom_out' | 'search' | 'get_directions' | 'change_map_type' | 'pan_to' | 'clear_directions';
  params?: {
    query?: string;
    destination?: string;
    origin?: string;
    coordinates?: Coordinates;
    mapType?: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
    zoomLevel?: number;
  };
} 