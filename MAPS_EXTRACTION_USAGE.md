# Enhanced Google Maps Data Extraction

Your Chrome extension now has a comprehensive Google Maps data extraction system that can extract much more than just basic directions. Here's how to use it and what data you can extract.

## What Data Can Be Extracted

### 🗺️ **Location & Map State**
- Current coordinates (lat/lng)
- Zoom level
- Map type (roadmap, satellite, hybrid, terrain)
- Visible map bounds

### 🔍 **Search Data**
- Search query
- Search results with ratings, addresses, types
- Place details (phone, website, hours, price level)
- "People also search for" nearby places

### 🚗 **Enhanced Route/Directions Data**
- **Starting point** and **destination** addresses
- **Waypoints** (intermediate stops for multi-leg trips)
- **Selected travel mode** (driving, walking, transit, cycling)
- **All available travel modes** with their estimated times
- **Multiple route options** with descriptions ("Fastest route", "Via I-280", etc.)
- **Step-by-step directions** with distances
- **Route metadata** (total distance, duration, route type)

## How to Use the Extraction System

### 1. **Automatic Extraction**
Your extension already automatically extracts Maps data when you open the Maps AI Assistant on a Google Maps page.

### 2. **Manual Extraction**
```javascript
// From a content script or when the user clicks "Extract Maps Data"
const result = await extractMapsData();

if (result.success && result.data) {
  console.log('📍 Location:', result.data.currentLocation);
  console.log('🔍 Search:', result.data.searchQuery);
  console.log('🚗 Route:', result.data.currentRoute);
  console.log('📋 Places:', result.data.searchResults);
}
```

### 3. **Using the Data in Your Interface**
```svelte
<!-- In your Svelte component -->
<script>
  import MapsDataDisplay from './lib/components/ui/MapsDataDisplay.svelte';
  
  let mapsData = null; // Your extracted Maps data
</script>

<MapsDataDisplay {mapsData} showRawData={true} />
```

## Key Data Structure

```typescript
interface MapsData {
  // Location & Map State
  currentLocation: { lat: number, lng: number } | null;
  zoomLevel: number;
  mapType: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
  
  // Search Data
  searchQuery: string | null;
  searchResults: SearchResult[];
  selectedPlace: SearchResult | null;
  
  // Enhanced Route Data
  currentRoute: {
    origin: { address: string, coordinates: Coordinates };
    destination: { address: string, coordinates: Coordinates };
    waypoints: { address: string, coordinates: Coordinates }[]; // Multi-leg trip stops
    distance: string;
    duration: string;
    selectedTravelMode: string;
    travelModes: TravelMode[];      // All available modes with times
    routeOptions: RouteOption[];    // Alternative routes
    steps: RouteStep[];             // Turn-by-turn directions
  } | null;
  
  // Metadata
  url: string;
  extractedAt: number;
  extractionMethod: string;
}
```

## Enhanced Route Data Features

### **Travel Modes**
```typescript
interface TravelMode {
  mode: string;           // "driving", "walking", "transit", "cycling"
  duration: string;       // "25 min", "1 hr 15 min"
  isSelected: boolean;    // Which mode is currently selected
  additionalInfo: string; // "Fastest route", "Via highway", etc.
}
```

### **Route Options**
```typescript
interface RouteOption {
  duration: string;       // "25 min"
  distance: string;       // "15.2 km"
  description: string;    // "Fastest route", "Via I-280"
  routeType: string;      // Travel mode for this route
}
```

### **Route Steps**
```typescript
interface RouteStep {
  instruction: string;    // "Turn left onto Main St"
  distance: string;       // "0.5 km"
  duration: string;       // "2 min"
  coordinates: Coordinates[];
}
```

## Example Extracted Data

When you have directions from "Palo Alto" to "San Francisco Airport" with multiple travel modes:

```json
{
  "currentLocation": { "lat": 37.4419, "lng": -122.1430 },
  "searchQuery": "San Francisco Airport",
  "currentRoute": {
    "origin": { "address": "Palo Alto, CA" },
    "destination": { "address": "San Francisco Airport, CA" },
    "distance": "35.2 km",
    "duration": "42 min",
    "selectedTravelMode": "driving",
    "travelModes": [
      {
        "mode": "driving",
        "duration": "42 min",
        "isSelected": true,
        "additionalInfo": "Fastest route"
      },
      {
        "mode": "transit",
        "duration": "1 hr 25 min",
        "isSelected": false,
        "additionalInfo": "Via Caltrain"
      },
      {
        "mode": "walking",
        "duration": "7 hr 15 min",
        "isSelected": false
      }
    ],
    "routeOptions": [
      {
        "duration": "42 min",
        "distance": "35.2 km",
        "description": "Fastest route",
        "routeType": "driving"
      },
      {
        "duration": "48 min",
        "distance": "38.1 km",
        "description": "Via US-101",
        "routeType": "driving"
      }
    ],
    "steps": [
      {
        "instruction": "Head north on University Ave",
        "distance": "0.8 km",
        "duration": "2 min"
      },
      {
        "instruction": "Turn right onto US-101 N",
        "distance": "25.2 km",
        "duration": "22 min"
      }
      // ... more steps
    ]
  },
  "searchResults": [
    {
      "name": "San Francisco International Airport",
      "address": "San Francisco, CA 94128",
      "rating": 4.1,
      "reviewCount": 15420,
      "types": ["airport"],
      "isCurrentlySelected": true
    }
  ]
}
```

## Integration with Your AI Assistant

The extracted data is automatically provided to your Maps AI Assistant as context, so it can:

1. **Answer questions about current directions**: "How long will this route take?"
2. **Suggest alternatives**: "Are there faster routes?"
3. **Provide local recommendations**: "What's good near my destination?"
4. **Help with navigation**: "What's the next turn?"
5. **Plan multi-leg trips**: "Add a stop at the grocery store", "Plan a route with multiple stops"

## Using the Display Component

```svelte
<script>
  import MapsDataDisplay from './lib/components/ui/MapsDataDisplay.svelte';
  
  // Your extracted Maps data
  let mapsData = null;
  
  // Extract data when component mounts
  onMount(async () => {
    const result = await extractMapsData();
    if (result.success) {
      mapsData = result.data;
    }
  });
</script>

<!-- Clean, organized display of all extracted data -->
<MapsDataDisplay {mapsData} />

<!-- Or with raw data for debugging -->
<MapsDataDisplay {mapsData} showRawData={true} />
```

## Benefits Over Basic Extraction

1. **Comprehensive**: Extracts all available travel modes and their timings
2. **Robust**: Uses multiple selectors to handle Google Maps UI changes
3. **Structured**: Provides clean, typed data structures
4. **Visual**: Includes a beautiful display component
5. **AI-Ready**: Automatically provides context to your AI assistant

Your extension now extracts far more than just "starting point" and "destination" - it captures the complete Maps experience for your users! 