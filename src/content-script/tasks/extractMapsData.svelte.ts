import type { MapsData, MapsExtractionResult, Coordinates, MapBounds, SearchResult, RouteData, RouteStep } from '../../types/mapsData';

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
    
    // Try main search input
    const searchInput = document.querySelector('#searchboxinput') as HTMLInputElement;
    if (searchInput && searchInput.value) {
      return searchInput.value;
    }
    
    // Try other search input selectors
    const altSearchInput = document.querySelector('input[data-value]') as HTMLInputElement;
    if (altSearchInput && altSearchInput.value) {
      return altSearchInput.value;
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
 * Extract the currently selected/viewed place name from the side panel
 */
function extractCurrentPlaceName(): string | null {
  try {
    console.log('🏢 Extracting current place name...');
    
    // Primary selector for place title in side panel
    const titleSelectors = [
      'h1.DUwDvf.lfPIob',           // Main place title
      'h1.DUwDvf lfPIob',
      'h1.DUwDvf',
      '.DUwDvf.lfPIob',
      '.lfPIob',
      'h1[data-attrid="title"]',
      '.section-hero-header-title',
      '.section-hero-header-title-title',
      '[data-value]:first-child h1',
      'h1.fontHeadlineLarge'
    ];
    
    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const name = element.textContent?.trim();
        if (name && name.length > 0 && name.length < 200) {
          console.log('🏢 Found place name:', name);
          return name;
        }
      }
    }
    
    console.log('🏢 No place name found in side panel');
    return null;
  } catch (error) {
    console.warn('Failed to extract current place name:', error);
    return null;
  }
}

/**
 * Extract detailed information about the currently selected place
 */
function extractCurrentPlaceDetails(): SearchResult | null {
  try {
    console.log('🏢 Extracting current place details...');
    
    const name = extractCurrentPlaceName();
    if (!name) {
      return null;
    }
    
    // Extract rating
    let rating: number | undefined;
    let reviewCount: number | undefined;
    
    const ratingSelectors = [
      '.F7nice .ceNzKf',           // Rating number
      '.MW4etd',                   // Star rating
      '[data-value*="stars"]',
      '[aria-label*="stars"]'
    ];
    
    for (const selector of ratingSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim() || '';
        const ariaLabel = element.getAttribute('aria-label') || '';
        const fullText = `${text} ${ariaLabel}`;
        
        const ratingMatch = fullText.match(/(\d+\.?\d*)/);
        if (ratingMatch) {
          rating = parseFloat(ratingMatch[1]);
          break;
        }
      }
    }
    
    // Extract review count
    const reviewSelectors = [
      '.F7nice .UY7F9',           // Review count
      '.UY7F9',
      '[data-value*="review"]'
    ];
    
    for (const selector of reviewSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim() || '';
        const reviewMatch = text.match(/\(?(\d+)\)?/);
        if (reviewMatch) {
          reviewCount = parseInt(reviewMatch[1]);
          break;
        }
      }
    }
    
    // Extract address
    let address = '';
    const addressSelectors = [
      '.Io6YTe.fontBodyMedium',    // Address in place details
      '.QSFF4d.fontBodyMedium',
      '[data-item-id="address"]',
      '.section-info-line'
    ];
    
    for (const selector of addressSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const candidateAddress = element.textContent?.trim() || '';
        if (candidateAddress && candidateAddress.length > 5) {
          address = candidateAddress;
          break;
        }
      }
    }
    
    // Extract phone number
    let phoneNumber: string | undefined;
    const phoneSelectors = [
      '[data-item-id="phone:tel"]',
      '[href^="tel:"]',
      '.section-info-phone'
    ];
    
    for (const selector of phoneSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        phoneNumber = element.textContent?.trim() || element.getAttribute('href')?.replace('tel:', '') || undefined;
        if (phoneNumber) break;
      }
    }
    
    // Extract website
    let website: string | undefined;
    const websiteSelectors = [
      '[data-item-id="authority"]',
      '[data-value*=".com"]',
      '[href*=".com"]:not([href*="google.com"])'
    ];
    
    for (const selector of websiteSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        website = element.getAttribute('href') || element.textContent?.trim() || undefined;
        if (website && website.includes('.')) break;
      }
    }
    
    // Extract opening hours
    const openingHours: string[] = [];
    const hoursSelectors = [
      '.t39EBf.GUrTXd',           // Hours section
      '[data-item-id="oh"]',
      '.section-open-hours-container'
    ];
    
    for (const selector of hoursSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const hoursText = element.textContent?.trim();
        if (hoursText) {
          openingHours.push(hoursText);
          break;
        }
      }
    }
    
    // Extract price level
    let priceLevel: number | undefined;
    const priceSelectors = [
      '.mgr77e .fontBodyMedium',   // Price level
      '[data-value*="$"]',
      '[aria-label*="$"]'
    ];
    
    for (const selector of priceSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim() || '';
        const dollarCount = (text.match(/\$/g) || []).length;
        if (dollarCount > 0) {
          priceLevel = dollarCount;
          break;
        }
      }
    }
    
    // Extract business type
    const types: string[] = [];
    const typeSelectors = [
      '.DkEaL',                   // Business type
      '.mgr77e span:first-child',
      '[data-value*="Restaurant"]',
      '[data-value*="Store"]'
    ];
    
    for (const selector of typeSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const typeText = element.textContent?.trim() || '';
        if (typeText && typeText.length > 0 && typeText.length < 50) {
          types.push(typeText);
        }
      }
    }
    
    const result: SearchResult = {
      name,
      address,
      coordinates: extractCoordinatesFromUrl() || { lat: 0, lng: 0 },
      rating,
      reviewCount,
      priceLevel,
      types,
      phoneNumber,
      website,
      openingHours: openingHours.length > 0 ? openingHours : undefined,
      isCurrentlySelected: true
    };
    
    console.log('🏢 Extracted current place details:', result);
    return result;
    
  } catch (error) {
    console.warn('Failed to extract current place details:', error);
    return null;
  }
}

/**
 * Extract search results from the left sidebar using proper Google Maps selectors
 */
function extractSearchResults(): SearchResult[] {
  const results: SearchResult[] = [];
  
  try {
    console.log('🔍 Starting enhanced search results extraction...');
    
    // Main search results container selectors
    const containerSelectors = [
      '.m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde.ecceSd',  // Main results feed
      '.section-listbox',
      '.section-scrollbox',
      '[role="main"] .Nv2PK'
    ];
    
    let container: Element | null = null;
    for (const selector of containerSelectors) {
      container = document.querySelector(selector);
      if (container) {
        console.log('🔍 Found results container:', selector);
        break;
      }
    }
    
    if (!container) {
      console.log('🔍 No results container found');
      return results;
    }
    
    // Individual result selectors
    const resultElements = container.querySelectorAll('.Nv2PK, [data-result-index], .section-result');
    console.log('🔍 Found', resultElements.length, 'result elements');
    
    resultElements.forEach((element, index) => {
      try {
        // Extract name
        const nameSelectors = [
          '.qBF1Pd.fontHeadlineSmall',    // Primary name selector
          '.qBF1Pd',
          '.fontHeadlineSmall',
          '.section-result-title',
          'h3',
          'h4'
        ];
        
        let name = '';
        for (const selector of nameSelectors) {
          const nameElement = element.querySelector(selector);
          if (nameElement) {
            name = nameElement.textContent?.trim() || '';
            if (name && name.length > 0) break;
          }
        }
        
        if (!name || name.length === 0) {
          return; // Skip if no name found
        }
        
        // Extract rating
        let rating: number | undefined;
        let reviewCount: number | undefined;
        
        const ratingElement = element.querySelector('.MW4etd');
        if (ratingElement) {
          const ratingText = ratingElement.textContent?.trim() || '';
          const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
          if (ratingMatch) {
            rating = parseFloat(ratingMatch[1]);
          }
        }
        
        // Extract review count
        const reviewElement = element.querySelector('.UY7F9');
        if (reviewElement) {
          const reviewText = reviewElement.textContent?.trim() || '';
          const reviewMatch = reviewText.match(/\(?(\d+)\)?/);
          if (reviewMatch) {
            reviewCount = parseInt(reviewMatch[1]);
          }
        }
        
        // Extract address and type from .W4Efsd spans
        let address = '';
        let businessType = '';
        let status = '';
        
        const infoSpans = element.querySelectorAll('.W4Efsd span');
        infoSpans.forEach((span, spanIndex) => {
          const text = span.textContent?.trim() || '';
          const style = span.getAttribute('style') || '';
          
          // Status (Open/Closed) - usually green text
          if (style.includes('color: rgba(25,134,57,1.00)') || text.toLowerCase().includes('open')) {
            status = text;
          }
          // Business type - usually first span
          else if (spanIndex === 0 && text.length > 0 && text.length < 50) {
            businessType = text;
          }
          // Address - usually contains street indicators
          else if (text.includes('Ave') || text.includes('Street') || text.includes('St') || 
                   text.includes('Road') || text.includes('Rd') || text.includes('Blvd') || 
                   text.includes('Dr') || text.includes('Drive') || text.match(/\d+/)) {
            address = text;
          }
        });
        
        // Extract price level
        let priceLevel: number | undefined;
        const priceElement = element.querySelector('[data-value*="$"], [aria-label*="$"]');
        if (priceElement) {
          const priceText = priceElement.textContent?.trim() || '';
          const dollarCount = (priceText.match(/\$/g) || []).length;
          if (dollarCount > 0) {
            priceLevel = dollarCount;
          }
        }
        
        const result: SearchResult = {
          name,
          address,
          coordinates: { lat: 0, lng: 0 }, // Will be populated if coordinates are available
          rating,
          reviewCount,
          priceLevel,
          types: businessType ? [businessType] : [],
          status,
          placeId: element.getAttribute('data-cid') || undefined,
          searchResultIndex: index
        };
        
        results.push(result);
        console.log('✅ Extracted search result:', name, rating ? `(${rating}⭐)` : '');
        
      } catch (error) {
        console.warn('Failed to extract search result:', error);
      }
    });
    
    console.log('🔍 Total search results extracted:', results.length);
    return results;
    
  } catch (error) {
    console.warn('Failed to extract search results:', error);
    return [];
  }
}

/**
 * Extract "People also search for" nearby places
 */
function extractNearbyPlaces(): SearchResult[] {
  const nearby: SearchResult[] = [];
  
  try {
    console.log('🏘️ Extracting nearby places...');
    
    // Check if "People also search for" section exists
    const nearbyHeader = document.querySelector('h2.etbuEf');
    if (!nearbyHeader || !nearbyHeader.textContent?.includes('People also search for')) {
      console.log('🏘️ No "People also search for" section found');
      return nearby;
    }
    
    // Find the carousel container
    const carouselContainer = nearbyHeader.closest('.section-layout')?.querySelector('.fp2VUc');
    if (!carouselContainer) {
      console.log('🏘️ No carousel container found');
      return nearby;
    }
    
    // Extract each nearby place card
    const nearbyCards = carouselContainer.querySelectorAll('.Ymd7jc.Lnaw4c');
    console.log('🏘️ Found', nearbyCards.length, 'nearby place cards');
    
    nearbyCards.forEach((card, index) => {
      try {
        // Extract name
        const nameElement = card.querySelector('.GgK1If.fontTitleSmall, .GgK1If');
        const name = nameElement?.textContent?.trim() || '';
        
        if (!name) return;
        
        // Extract rating
        let rating: number | undefined;
        const ratingElement = card.querySelector('.MW4etd');
        if (ratingElement) {
          const ratingText = ratingElement.textContent?.trim() || '';
          const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
          if (ratingMatch) {
            rating = parseFloat(ratingMatch[1]);
          }
        }
        
        // Extract review count
        let reviewCount: number | undefined;
        const reviewElement = card.querySelector('.UY7F9');
        if (reviewElement) {
          const reviewText = reviewElement.textContent?.trim() || '';
          const reviewMatch = reviewText.match(/\(?(\d+)\)?/);
          if (reviewMatch) {
            reviewCount = parseInt(reviewMatch[1]);
          }
        }
        
        // Extract business type (usually the last .Q5g20 element)
        const typeElements = card.querySelectorAll('.Q5g20');
        const businessType = typeElements.length > 0 ? 
          typeElements[typeElements.length - 1].textContent?.trim() || '' : '';
        
        const result: SearchResult = {
          name,
          address: '',
          coordinates: { lat: 0, lng: 0 },
          rating,
          reviewCount,
          types: businessType ? [businessType] : [],
          isNearbyPlace: true,
          nearbyIndex: index
        };
        
        nearby.push(result);
        console.log('✅ Extracted nearby place:', name, rating ? `(${rating}⭐)` : '');
        
      } catch (error) {
        console.warn('Failed to extract nearby place:', error);
      }
    });
    
    console.log('🏘️ Total nearby places extracted:', nearby.length);
    return nearby;
    
  } catch (error) {
    console.warn('Failed to extract nearby places:', error);
    return [];
  }
}

/**
 * Extract comprehensive directions/route information
 */
function extractRouteData(): RouteData | null {
  try {
    console.log('🗺️ Extracting route/directions data...');
    
    // Check if directions are active
    const directionsBox = document.querySelector('#omnibox-directions');
    const isDirectionsActive = directionsBox && 
      (directionsBox as HTMLElement).style.display !== 'none';
    
    // Also check URL for directions
    const url = window.location.href;
    const hasDirectionsInUrl = url.includes('/dir/') || url.includes('dirflg=') || url.includes('destination=');
    
    if (!isDirectionsActive && !hasDirectionsInUrl) {
      console.log('🗺️ No active directions found');
      return null;
    }
    
    let origin = { address: '', coordinates: { lat: 0, lng: 0 } };
    let destination = { address: '', coordinates: { lat: 0, lng: 0 } };
    let duration = '';
    let distance = '';
    let routeOptions: any[] = [];
    let selectedTravelMode = '';
    let travelModes: any[] = [];
    
    // Extract from/to addresses and waypoints from input boxes with enhanced selectors
    const fromInputSelectors = [
      '#directions-searchbox-0 .searchboxinput',
      '#directions-searchbox-0 input',
      'input[placeholder*="starting point"]',
      'input[aria-label*="Starting point"]',
      'input[data-value]:first-of-type'
    ];
    
    const toInputSelectors = [
      '#directions-searchbox-1 .searchboxinput', 
      '#directions-searchbox-1 input',
      'input[placeholder*="destination"]',
      'input[aria-label*="Destination"]',
      'input[data-value]:last-of-type'
    ];
    
    // Extract waypoints (intermediate stops)
    const waypoints: { address: string; coordinates: { lat: number; lng: number } }[] = [];
    const waypointSelectors = [
      '#directions-searchbox input:not(:first-child):not(:last-child)', // Middle inputs
      '.directions-waypoint-input',
      '[aria-label*="waypoint"]',
      '[placeholder*="waypoint"]'
    ];
    
    // Look for waypoint inputs (Google Maps creates them dynamically)
    for (const selector of waypointSelectors) {
      const waypointInputs = document.querySelectorAll(selector) as NodeListOf<HTMLInputElement>;
      waypointInputs.forEach((input, index) => {
        const value = input.value?.trim() || input.getAttribute('aria-label')?.trim();
        if (value && !value.includes('Starting point') && !value.includes('Destination')) {
          waypoints.push({
            address: value,
            coordinates: { lat: 0, lng: 0 } // Could be populated from geocoding
          });
          console.log('🗺️ Found waypoint', index + 1, ':', value);
        }
      });
    }
    
    // Extract starting point
    for (const selector of fromInputSelectors) {
      const fromInput = document.querySelector(selector) as HTMLInputElement;
      if (fromInput) {
        const value = fromInput.value?.trim() || fromInput.getAttribute('aria-label')?.replace('Starting point ', '').trim();
        if (value) {
          origin.address = value;
          console.log('🗺️ Found origin:', origin.address);
          break;
        }
      }
    }
    
    // Extract destination
    for (const selector of toInputSelectors) {
      const toInput = document.querySelector(selector) as HTMLInputElement;
      if (toInput) {
        const value = toInput.value?.trim() || toInput.getAttribute('aria-label')?.replace('Destination ', '').trim();
        if (value) {
          destination.address = value;
          console.log('🗺️ Found destination:', destination.address);
          break;
        }
      }
    }
    
    // Extract travel mode buttons and their timing information
    const travelModeSelectors = [
      '.oya4hc', // Travel mode buttons
      '[data-travel_mode]',
      '[data-value*="travel"]',
      '.directions-travel-mode'
    ];
    
    for (const selector of travelModeSelectors) {
      const modeElements = document.querySelectorAll(selector);
      if (modeElements.length > 0) {
        console.log('🗺️ Found travel mode elements:', modeElements.length);
        
        modeElements.forEach((element, index) => {
          try {
            const modeButton = element.querySelector('button') || element;
            const modeType = element.getAttribute('data-travel_mode') || 
                           element.getAttribute('data-value') || 
                           modeButton.getAttribute('data-tooltip') ||
                           modeButton.getAttribute('aria-label') || 
                           'unknown';
            
            // Check if this mode is selected
            const isSelected = element.classList.contains('selected') || 
                             element.classList.contains('active') ||
                             element.getAttribute('aria-selected') === 'true';
            
            if (isSelected) {
              selectedTravelMode = modeType;
            }
            
            // Extract timing information for this mode
            const timeElement = element.querySelector('.Fl2iee, .directions-time, [data-value*="min"], [data-value*="hour"]');
            const timeText = timeElement?.textContent?.trim() || '';
            
            // Extract any additional info (like "fastest route", "via highway", etc.)
            const infoElement = element.querySelector('.directions-mode-info, .route-info');
            const additionalInfo = infoElement?.textContent?.trim() || '';
            
            const travelMode = {
              mode: modeType,
              duration: timeText,
              isSelected,
              additionalInfo,
              index
            };
            
            travelModes.push(travelMode);
            console.log('🗺️ Found travel mode:', travelMode);
          } catch (error) {
            console.warn('Failed to extract travel mode:', error);
          }
        });
        break; // Found travel modes, no need to try other selectors
      }
    }
    
    // Extract route options and timing (alternative routes)
    const routeElements = document.querySelectorAll('[data-trip-index], .section-directions-trip, .directions-route-option');
    
    routeElements.forEach((element, index) => {
      try {
        // Extract time and distance
        const timeElement = element.querySelector('[data-value*="min"], [data-value*="hour"], .section-directions-trip-duration, .route-duration');
        const distanceElement = element.querySelector('[data-value*="km"], [data-value*="mi"], .section-directions-trip-distance, .route-distance');
        
        const timeText = timeElement?.textContent?.trim() || '';
        const distanceText = distanceElement?.textContent?.trim() || '';
        
        // Extract route description (e.g., "Fastest route", "Via I-280", etc.)
        const descriptionElement = element.querySelector('.route-description, .directions-route-description');
        const description = descriptionElement?.textContent?.trim() || '';
        
        if (timeText || distanceText) {
          const routeOption = {
            duration: timeText,
            distance: distanceText,
            routeType: selectedTravelMode || 'driving',
            description,
            index: index
          };
          
          routeOptions.push(routeOption);
          
          // Use first route as main route
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
    
    // Extract route steps with enhanced selectors
    const steps: RouteStep[] = [];
    const stepSelectors = [
      '.section-directions-step',
      '.directions-step',
      '.directions-step-content',
      '[data-step-index]'
    ];
    
    for (const selector of stepSelectors) {
      const stepElements = document.querySelectorAll(selector);
      if (stepElements.length > 0) {
        console.log('🗺️ Found step elements:', stepElements.length);
        
        stepElements.forEach((stepElement, index) => {
          try {
            const instructionElement = stepElement.querySelector('.directions-step-instruction') || stepElement;
            const stepText = instructionElement.textContent?.trim() || '';
            
            // Extract step distance and duration
            const stepDistanceElement = stepElement.querySelector('.directions-step-distance');
            const stepDurationElement = stepElement.querySelector('.directions-step-duration');
            
            const stepDistance = stepDistanceElement?.textContent?.trim() || '';
            const stepDuration = stepDurationElement?.textContent?.trim() || '';
            
            if (stepText && stepText.length > 0) {
              steps.push({
                instruction: stepText,
                distance: stepDistance,
                duration: stepDuration,
                coordinates: []
              });
            }
          } catch (error) {
            console.warn('Failed to extract route step:', error);
          }
        });
        break; // Found steps, no need to try other selectors
      }
    }
    
    // Extract from URL if inputs are empty
    if (!origin.address || !destination.address) {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const dirParam = urlParams.get('dir');
        
        if (dirParam) {
          const parts = dirParam.split('/');
          if (parts.length >= 2) {
            if (!origin.address) origin.address = decodeURIComponent(parts[0]);
            if (!destination.address) destination.address = decodeURIComponent(parts[1]);
            console.log('🗺️ Extracted from URL:', { origin: origin.address, destination: destination.address });
          }
        }
      } catch (error) {
        console.warn('Failed to extract from URL:', error);
      }
    }
    
    // Only return if we have meaningful data
    if (origin.address || destination.address || duration || routeOptions.length > 0 || travelModes.length > 0 || waypoints.length > 0) {
      const routeData: RouteData = {
        origin,
        destination,
        waypoints: waypoints.length > 0 ? waypoints : undefined,
        distance,
        duration,
        steps,
        routeType: selectedTravelMode || 'driving',
        extractedAt: Date.now(),
        routeOptions,
        travelModes,
        selectedTravelMode
      };
      
      console.log('🗺️ Successfully extracted enhanced route data with waypoints:', {
        origin: origin.address,
        destination: destination.address,
        waypoints: waypoints.length,
        travelModes: travelModes.length,
        routeOptions: routeOptions.length
      });
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
 * Wait for elements to load with timeout
 */
function waitForElements(selectors: string[], timeout: number = 3000): Promise<Element[]> {
  return new Promise((resolve) => {
    const elements: Element[] = [];
    let timeoutId: number;
    
    const checkElements = () => {
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && !elements.includes(element)) {
          elements.push(element);
        }
      }
      
      if (elements.length > 0) {
        clearTimeout(timeoutId);
        resolve(elements);
      }
    };
    
    // Check immediately
    checkElements();
    
    // Set up observer for dynamic content
    const observer = new MutationObserver(() => {
      checkElements();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Timeout fallback
    timeoutId = setTimeout(() => {
      observer.disconnect();
      resolve(elements);
    }, timeout);
  });
}

/**
 * Extract comprehensive Google Maps data from the current page
 */
export async function extractMapsData(): Promise<MapsExtractionResult> {
  try {
    console.log('🗺️ Starting comprehensive Google Maps data extraction');
    
    if (!isGoogleMapsPage()) {
      return {
        success: false,
        error: 'Current page is not Google Maps'
      };
    }
    
    const currentUrl = window.location.href;
    
    // Wait for key elements to load
    console.log('🗺️ Waiting for Maps elements to load...');
    await waitForElements([
      '#pane',
      '.m6QErb',
      '.section-layout',
      '#omnibox-directions'
    ], 2000);
    
    // Extract all data components
    const currentLocation = extractCoordinatesFromUrl();
    const searchQuery = extractSearchQuery();
    const currentPlace = extractCurrentPlaceDetails();
    const searchResults = extractSearchResults();
    const nearbyPlaces = extractNearbyPlaces();
    const currentRoute = extractRouteData();
    const zoomLevel = extractZoomLevel();
    const mapType = extractMapType();
    
    // Combine all places data
    const allPlaces: SearchResult[] = [];
    
    // Add current place if available
    if (currentPlace) {
      allPlaces.push(currentPlace);
    }
    
    // Add search results
    allPlaces.push(...searchResults);
    
    // Add nearby places
    allPlaces.push(...nearbyPlaces);
    
    // Remove duplicates based on name
    const uniquePlaces = allPlaces.filter((place, index, self) => 
      index === self.findIndex(p => p.name === place.name)
    );
    
    const mapsData: MapsData = {
      currentLocation,
      visibleBounds: null, // Could be calculated from coordinates and zoom
      mapType,
      zoomLevel,
      searchQuery,
      searchResults: uniquePlaces,
      selectedPlace: currentPlace || (uniquePlaces.length > 0 ? uniquePlaces[0] : null),
      currentRoute,
      trafficInfo: null, // Could be extracted from traffic layer
      url: currentUrl,
      extractedAt: Date.now(),
      extractionMethod: 'enhanced-dom-scraping'
    };
    
    console.log('🗺️ Enhanced Maps data extracted successfully:', {
      hasLocation: !!currentLocation,
      searchQuery,
      currentPlace: currentPlace?.name,
      searchResultsCount: searchResults.length,
      nearbyPlacesCount: nearbyPlaces.length,
      totalPlacesCount: uniquePlaces.length,
      hasRoute: !!currentRoute,
      zoomLevel,
      mapType,
      extractionMethod: 'enhanced-dom-scraping'
    });
    
    return {
      success: true,
      data: mapsData
    };
    
  } catch (error) {
    console.error('🗺️ Enhanced Maps data extraction failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Enhanced Maps data extraction failed'
    };
  }
} 