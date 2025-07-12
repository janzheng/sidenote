import type { MapsData, MapsExtractionResult, Coordinates, MapBounds, SearchResult, RouteData } from '../../types/mapsData';

/**
 * Check if current page is Google Maps
 */
export function isGoogleMapsPage(): boolean {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  
  return (hostname === 'maps.google.com' || hostname === 'www.google.com') && 
         (pathname.includes('/maps') || pathname === '/maps');
}

/**
 * Extract coordinates from various Google Maps URL formats
 */
function extractCoordinatesFromUrl(): Coordinates | null {
  try {
    const url = window.location.href;
    
    // Pattern 1: /@lat,lng,zoom
    const coordPattern = /@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+\.?\d*)z/;
    const coordMatch = url.match(coordPattern);
    
    if (coordMatch) {
      return {
        lat: parseFloat(coordMatch[1]),
        lng: parseFloat(coordMatch[2])
      };
    }
    
    // Pattern 2: /place/name/@lat,lng
    const placePattern = /\/place\/[^/]+\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/;
    const placeMatch = url.match(placePattern);
    
    if (placeMatch) {
      return {
        lat: parseFloat(placeMatch[1]),
        lng: parseFloat(placeMatch[2])
      };
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to extract coordinates from URL:', error);
    return null;
  }
}

/**
 * Extract search query from URL or DOM
 */
function extractSearchQuery(): string | null {
  try {
    // Try URL first
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    if (query) return query;
    
    // Try search input field
    const searchInput = document.querySelector('input[data-value]') as HTMLInputElement;
    if (searchInput && searchInput.value) {
      return searchInput.value;
    }
    
    // Try aria-label search
    const searchBox = document.querySelector('input[aria-label*="Search"]') as HTMLInputElement;
    if (searchBox && searchBox.value) {
      return searchBox.value;
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to extract search query:', error);
    return null;
  }
}

/**
 * Extract visible search results from DOM
 */
function extractSearchResults(): SearchResult[] {
  const results: SearchResult[] = [];
  
  try {
    // Look for place result cards (active search results)
    const resultElements = document.querySelectorAll('[data-result-index], [role="article"], .section-result');
    
    resultElements.forEach((element, index) => {
      try {
        const nameElement = element.querySelector('[data-value], .section-result-title, .fontHeadlineSmall');
        const addressElement = element.querySelector('.section-result-location, [data-value]:nth-of-type(2)');
        const ratingElement = element.querySelector('[data-value*="."], .section-result-rating');
        
        if (nameElement) {
          const name = nameElement.textContent?.trim() || `Place ${index + 1}`;
          const address = addressElement?.textContent?.trim() || '';
          
          // Try to extract rating
          let rating: number | undefined;
          if (ratingElement) {
            const ratingText = ratingElement.textContent?.trim();
            const ratingMatch = ratingText?.match(/(\d+\.?\d*)/);
            if (ratingMatch) {
              rating = parseFloat(ratingMatch[1]);
            }
          }
          
          results.push({
            name,
            address,
            coordinates: { lat: 0, lng: 0 }, // Will be updated if we can extract from URL
            rating,
            types: [],
            placeId: element.getAttribute('data-cid') || undefined
          });
        }
      } catch (error) {
        console.warn('Failed to extract result:', error);
      }
    });
  } catch (error) {
    console.warn('Failed to extract search results:', error);
  }
  
  return results;
}

/**
 * Extract nearby visible places from the map (when no active search)
 */
function extractNearbyPlaces(): SearchResult[] {
  const places: SearchResult[] = [];
  
  try {
    // Look for place markers and labels on the map
    const placeSelectors = [
      // Specific place markers and labels
      '[data-place-id]',
      '[data-cid]',
      '[jsaction*="pane.place"]',
      '[data-value*="Restaurant"]',
      '[data-value*="Pizza"]',
      '[data-value*="Coffee"]',
      '[data-value*="Market"]',
      '[data-value*="Store"]',
      '[data-value*="Shop"]',
      '[data-value*="Bank"]',
      '[data-value*="Hotel"]',
      '[data-value*="Gas"]',
      '[data-value*="Pharmacy"]',
      // Map labels that might contain business names
      '[role="button"][aria-label]',
      '.place-name',
      '.poi-info-window'
    ];
    
    placeSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element, index) => {
        try {
          const ariaLabel = element.getAttribute('aria-label');
          const dataValue = element.getAttribute('data-value');
          const textContent = element.textContent?.trim();
          
          // Extract place name from various sources
          let name = '';
          if (ariaLabel && ariaLabel.length > 0 && ariaLabel.length < 100) {
            name = ariaLabel;
          } else if (dataValue && dataValue.length > 0 && dataValue.length < 100) {
            name = dataValue;
          } else if (textContent && textContent.length > 0 && textContent.length < 100) {
            name = textContent;
          }
          
                     // Filter out non-place elements and UI components
           if (name && 
               !name.includes('Google Maps') && 
               !name.includes('Search') &&
               !name.includes('Menu') &&
               !name.includes('Zoom') &&
               !name.includes('Layer') &&
               !name.includes('Collapse') &&
               !name.includes('Directions') &&
               !name.includes('Delete') &&
               !name.includes('side panel') &&
               !name.includes('Things to do') &&
               !name.includes('Hotels') &&
               !name.includes('Restaurants') &&
               !name.includes('Museums') &&
               !name.includes('Transit') &&
               !name.includes('Pharmacies') &&
               !name.includes('ATMs') &&
               !name.includes('Button') &&
               !name.includes('Close') &&
               !name.includes('Open') &&
               name.length > 2 &&
               name.length < 50) {
            
            // Check if we already have this place
            const exists = places.some(p => p.name === name);
            if (!exists) {
              places.push({
                name,
                address: '',
                coordinates: { lat: 0, lng: 0 },
                rating: undefined,
                types: [],
                placeId: element.getAttribute('data-cid') || element.getAttribute('data-place-id') || undefined
              });
            }
          }
        } catch (error) {
          console.warn('Failed to extract nearby place:', error);
        }
      });
    });
  } catch (error) {
    console.warn('Failed to extract nearby places:', error);
  }
  
  return places.slice(0, 10); // Limit to 10 places
}

/**
 * Extract current route information from DOM
 */
function extractRouteData(): RouteData | null {
  try {
    console.log('🗺️ Attempting to extract route data...');
    
    // Check if we're on a directions page by looking at the URL
    const url = window.location.href;
    const hasDirections = url.includes('/dir/') || url.includes('dirflg=') || url.includes('destination=');
    
    if (!hasDirections) {
      console.log('🗺️ No directions detected in URL');
      return null;
    }
    
    // Multiple approaches to find route information
    let origin = { address: '', coordinates: { lat: 0, lng: 0 } };
    let destination = { address: '', coordinates: { lat: 0, lng: 0 } };
    let duration = '';
    let distance = '';
    let routeOptions: any[] = [];
    
    // Approach 1: Look for input fields in the directions panel
    const originInput = document.querySelector('input[placeholder*="starting point"], input[placeholder*="origin"], input[aria-label*="starting point"]') as HTMLInputElement;
    const destinationInput = document.querySelector('input[placeholder*="destination"], input[aria-label*="destination"]') as HTMLInputElement;
    
    if (originInput && originInput.value) {
      origin.address = originInput.value.trim();
      console.log('🗺️ Found origin from input:', origin.address);
    }
    
    if (destinationInput && destinationInput.value) {
      destination.address = destinationInput.value.trim();
      console.log('🗺️ Found destination from input:', destination.address);
    }
    
    // Approach 2: Look for route options in the sidebar
    const routeElements = document.querySelectorAll('[data-trip-index], [data-value*="min"], div[role="button"]:has([data-value*="min"])');
    
    routeElements.forEach((element, index) => {
      try {
        const timeElement = element.querySelector('[data-value*="min"], [data-value*="hour"]') || element;
        const distanceElement = element.querySelector('[data-value*="km"], [data-value*="mi"], [data-value*="miles"]');
        
        const timeText = timeElement?.textContent?.trim() || '';
        const distanceText = distanceElement?.textContent?.trim() || '';
        
        // Look for time patterns like "17 min", "1 hour 20 min"
        const timeMatch = timeText.match(/(\d+)\s*(min|hour|hr)/i);
        const distanceMatch = distanceText.match(/(\d+\.?\d*)\s*(km|mi|miles)/i);
        
        if (timeMatch) {
          const routeOption = {
            duration: timeText,
            distance: distanceText,
            routeType: 'driving',
            index: index
          };
          
          routeOptions.push(routeOption);
          
          // Use the first route as the main route
          if (index === 0) {
            duration = timeText;
            distance = distanceText;
          }
          
          console.log('🗺️ Found route option:', routeOption);
        }
      } catch (error) {
        console.warn('Failed to extract route option:', error);
      }
    });
    
    // Approach 3: Try to extract from URL parameters
    if (!origin.address || !destination.address) {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const dirParam = urlParams.get('dir');
        
        if (dirParam) {
          const parts = dirParam.split('/');
          if (parts.length >= 2) {
            origin.address = decodeURIComponent(parts[0]);
            destination.address = decodeURIComponent(parts[1]);
            console.log('🗺️ Extracted from URL params:', { origin: origin.address, destination: destination.address });
          }
        }
      } catch (error) {
        console.warn('Failed to extract from URL params:', error);
      }
    }
    
    // Approach 4: Look for text content in the directions panel
    if (!origin.address || !destination.address) {
      const directionsPanel = document.querySelector('[data-value="directions"], .directions-panel, [role="main"]');
      if (directionsPanel) {
        const textElements = directionsPanel.querySelectorAll('[data-value]');
        
        textElements.forEach((element, index) => {
          const text = element.textContent?.trim() || '';
          
          // Skip common UI elements
          if (text && 
              !text.includes('Search') && 
              !text.includes('Menu') && 
              !text.includes('Button') &&
              !text.includes('Close') &&
              text.length > 3 && 
              text.length < 100) {
            
            if (index === 0 && !origin.address) {
              origin.address = text;
            } else if (index === 1 && !destination.address) {
              destination.address = text;
            }
          }
        });
      }
    }
    
    // Only return route data if we have meaningful information
    if (origin.address || destination.address || duration || routeOptions.length > 0) {
      const routeData: RouteData = {
        origin,
        destination,
        distance,
        duration,
        steps: [], // Could be extracted from detailed directions
        routeType: 'driving',
        extractedAt: Date.now(),
        routeOptions // Add route options for multiple routes
      };
      
      console.log('🗺️ Successfully extracted route data:', routeData);
      return routeData;
    }
    
    console.log('🗺️ No meaningful route data found');
    return null;
  } catch (error) {
    console.warn('🗺️ Failed to extract route data:', error);
    return null;
  }
}

/**
 * Extract current zoom level from URL or DOM
 */
function extractZoomLevel(): number {
  try {
    const url = window.location.href;
    const zoomPattern = /@[^,]+,[^,]+,(\d+\.?\d*)z/;
    const match = url.match(zoomPattern);
    
    if (match) {
      return parseInt(match[1]);
    }
    
    // Default zoom if not found
    return 15;
  } catch (error) {
    console.warn('Failed to extract zoom level:', error);
    return 15;
  }
}

/**
 * Extract map type from URL or DOM
 */
function extractMapType(): 'roadmap' | 'satellite' | 'hybrid' | 'terrain' {
  try {
    const url = window.location.href;
    
    if (url.includes('layer=c')) return 'satellite';
    if (url.includes('layer=s')) return 'satellite';
    if (url.includes('layer=y')) return 'hybrid';
    if (url.includes('layer=p')) return 'terrain';
    
    // Check for satellite button state
    const satelliteButton = document.querySelector('[data-value="satellite"], [aria-label*="Satellite"]');
    if (satelliteButton?.getAttribute('aria-pressed') === 'true') {
      return 'satellite';
    }
    
    return 'roadmap'; // Default
  } catch (error) {
    console.warn('Failed to extract map type:', error);
    return 'roadmap';
  }
}

/**
 * Extract comprehensive Google Maps data from the current page
 */
export async function extractMapsData(): Promise<MapsExtractionResult> {
  try {
    console.log('🗺️ Starting Google Maps data extraction');
    
    if (!isGoogleMapsPage()) {
      return {
        success: false,
        error: 'Current page is not Google Maps'
      };
    }
    
    const currentUrl = window.location.href;
    
    // Extract all available data
    const currentLocation = extractCoordinatesFromUrl();
    const searchQuery = extractSearchQuery();
    const searchResults = extractSearchResults();
    const nearbyPlaces = extractNearbyPlaces();
    const currentRoute = extractRouteData();
    const zoomLevel = extractZoomLevel();
    const mapType = extractMapType();
    
    // Combine search results with nearby places
    const allPlaces = [...searchResults];
    
    // If no search results, use nearby places
    if (searchResults.length === 0 && nearbyPlaces.length > 0) {
      allPlaces.push(...nearbyPlaces);
    }
    
    const mapsData: MapsData = {
      currentLocation,
      visibleBounds: null, // Could be calculated from coordinates and zoom
      mapType,
      zoomLevel,
      searchQuery,
      searchResults: allPlaces,
      selectedPlace: allPlaces.length > 0 ? allPlaces[0] : null,
      currentRoute,
      trafficInfo: null, // Could be extracted from traffic layer
      url: currentUrl,
      extractedAt: Date.now(),
      extractionMethod: 'dom-scraping'
    };
    
    console.log('🗺️ Maps data extracted successfully:', {
      hasLocation: !!currentLocation,
      searchQuery,
      searchResultsCount: searchResults.length,
      nearbyPlacesCount: nearbyPlaces.length,
      totalPlacesCount: allPlaces.length,
      hasRoute: !!currentRoute,
      zoomLevel,
      mapType
    });
    
    return {
      success: true,
      data: mapsData
    };
    
  } catch (error) {
    console.error('🗺️ Maps data extraction failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Maps data extraction failed'
    };
  }
} 