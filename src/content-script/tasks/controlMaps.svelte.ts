import type { MapsControlCommand, MapsControlResult, Coordinates } from '../../types/mapsData';
import { isGoogleMapsPage } from './extractMapsData.svelte';

/**
 * Wait for an element to be available in the DOM
 */
function waitForElement(selector: string, timeout = 5000): Promise<Element | null> {
  return new Promise((resolve) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Timeout fallback
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

/**
 * Simulate a click event on an element
 */
function simulateClick(element: Element): void {
  const event = new MouseEvent('click', {
    view: window,
    bubbles: true,
    cancelable: true
  });
  element.dispatchEvent(event);
}

/**
 * Simulate typing in an input field with proper execution
 */
function simulateTyping(input: HTMLInputElement, text: string): void {
  // Clear existing value
  input.value = '';
  input.focus();

  // Set the value all at once (more reliable than character by character)
  input.value = text;
  
  // Dispatch input events to trigger any listeners
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  
  // Small delay before pressing Enter to ensure the value is set
  setTimeout(() => {
    // Simulate Enter key press to execute the search
    const enterEvent = new KeyboardEvent('keydown', { 
      key: 'Enter', 
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true, 
      composed: true,
      cancelable: true
    });
    input.dispatchEvent(enterEvent);
    
    // Also dispatch keyup for completeness
    const enterUpEvent = new KeyboardEvent('keyup', { 
      key: 'Enter', 
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true, 
      composed: true 
    });
    input.dispatchEvent(enterUpEvent);
    
    // Try clicking search button as fallback
    const searchButton = document.querySelector('[data-value="Search"], button[aria-label*="Search"], [role="button"][aria-label*="Search"]');
    if (searchButton) {
      setTimeout(() => {
        simulateClick(searchButton);
      }, 100);
    }
  }, 100);
}

/**
 * Zoom in on the map
 */
async function zoomIn(): Promise<MapsControlResult> {
  try {
    console.log('🗺️ Attempting to zoom in');
    
    // Look for zoom in button
    const zoomInSelectors = [
      '[data-value="+"], [aria-label*="Zoom in"], .widget-zoom-in',
      '[jsaction*="zoom.in"], button[title*="Zoom in"]',
      '.gmnoprint button:first-child' // Fallback for zoom controls
    ];
    
    for (const selector of zoomInSelectors) {
      const button = await waitForElement(selector, 2000);
      if (button) {
        simulateClick(button);
        console.log('🗺️ Zoom in button clicked');
        return { success: true, action: 'zoom_in', result: 'Zoomed in successfully' };
      }
    }
    
    // Fallback: simulate keyboard shortcut
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
    
    return { success: true, action: 'zoom_in', result: 'Zoom in attempted via keyboard' };
  } catch (error) {
    console.error('🗺️ Failed to zoom in:', error);
    return { 
      success: false, 
      action: 'zoom_in', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Zoom out on the map
 */
async function zoomOut(): Promise<MapsControlResult> {
  try {
    console.log('🗺️ Attempting to zoom out');
    
    // Look for zoom out button
    const zoomOutSelectors = [
      '[data-value="-"], [aria-label*="Zoom out"], .widget-zoom-out',
      '[jsaction*="zoom.out"], button[title*="Zoom out"]',
      '.gmnoprint button:last-child' // Fallback for zoom controls
    ];
    
    for (const selector of zoomOutSelectors) {
      const button = await waitForElement(selector, 2000);
      if (button) {
        simulateClick(button);
        console.log('🗺️ Zoom out button clicked');
        return { success: true, action: 'zoom_out', result: 'Zoomed out successfully' };
      }
    }
    
    // Fallback: simulate keyboard shortcut
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '-', bubbles: true }));
    
    return { success: true, action: 'zoom_out', result: 'Zoom out attempted via keyboard' };
  } catch (error) {
    console.error('🗺️ Failed to zoom out:', error);
    return { 
      success: false, 
      action: 'zoom_out', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Search for a location or place
 */
async function search(query: string): Promise<MapsControlResult> {
  try {
    console.log('🗺️ Attempting to search for:', query);
    
    // Look for search input with more specific selectors
    const searchSelectors = [
      '#searchboxinput',
      'input[data-value]',
      'input[aria-label*="Search"]',
      'input[placeholder*="Search"]',
      'input[name="q"]',
      'input[role="combobox"]'
    ];
    
    for (const selector of searchSelectors) {
      const searchInput = await waitForElement(selector, 3000) as HTMLInputElement;
      if (searchInput) {
        console.log('🗺️ Found search input:', selector, 'typing query');
        
        // Clear any existing text first
        searchInput.focus();
        searchInput.select();
        
        // Use the improved typing function
        simulateTyping(searchInput, query);
        
        // Wait longer for search to execute and results to load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if search was successful by looking for results or URL change
        const hasResults = document.querySelector('[data-result-index], .section-result, [role="article"]');
        const urlChanged = window.location.href.includes(encodeURIComponent(query)) || window.location.href.includes('search');
        
        if (hasResults || urlChanged) {
          return { 
            success: true, 
            action: 'search', 
            result: `Successfully searched for "${query}" and found results` 
          };
        } else {
          return { 
            success: true, 
            action: 'search', 
            result: `Searched for "${query}" (results may still be loading)` 
          };
        }
      }
    }
    
    return { 
      success: false, 
      action: 'search', 
      error: 'Could not find search input field' 
    };
  } catch (error) {
    console.error('🗺️ Failed to search:', error);
    return { 
      success: false, 
      action: 'search', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get directions to a destination
 */
async function getDirections(destination: string, origin?: string): Promise<MapsControlResult> {
  try {
    console.log('🗺️ Attempting to get directions to:', destination);
    
    // Look for directions button
    const directionsSelectors = [
      '[data-value="directions"], [aria-label*="Directions"], .section-directions-button',
      'button[data-value="directions"], [jsaction*="directions"]'
    ];
    
    for (const selector of directionsSelectors) {
      const directionsButton = await waitForElement(selector, 3000);
      if (directionsButton) {
        simulateClick(directionsButton);
        console.log('🗺️ Directions button clicked');
        
        // Wait for directions panel to load
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Look for destination input
        const destInputSelectors = [
          'input[aria-label*="destination"], input[placeholder*="destination"]',
          '.section-directions-trip input:last-child'
        ];
        
        for (const destSelector of destInputSelectors) {
          const destInput = await waitForElement(destSelector, 2000) as HTMLInputElement;
          if (destInput) {
            simulateTyping(destInput, destination);
            
            return { 
              success: true, 
              action: 'get_directions', 
              result: `Getting directions to "${destination}"` 
            };
          }
        }
        
        // If we can't find destination input, try constructing URL
        const directionsUrl = `https://maps.google.com/maps/dir/${origin || 'My Location'}/${encodeURIComponent(destination)}`;
        window.location.href = directionsUrl;
        
        return { 
          success: true, 
          action: 'get_directions', 
          result: `Navigated to directions URL for "${destination}"` 
        };
      }
    }
    
    // Fallback: direct URL navigation
    const directionsUrl = `https://maps.google.com/maps/dir/${origin || 'My Location'}/${encodeURIComponent(destination)}`;
    window.location.href = directionsUrl;
    
    return { 
      success: true, 
      action: 'get_directions', 
      result: `Navigated to directions URL for "${destination}"` 
    };
  } catch (error) {
    console.error('🗺️ Failed to get directions:', error);
    return { 
      success: false, 
      action: 'get_directions', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Change map type (roadmap, satellite, etc.)
 */
async function changeMapType(mapType: 'roadmap' | 'satellite' | 'hybrid' | 'terrain'): Promise<MapsControlResult> {
  try {
    console.log('🗺️ Attempting to change map type to:', mapType);
    
    // Look for layers/map type button
    const layersSelectors = [
      '[data-value="layers"], [aria-label*="Layers"], .widget-layers',
      'button[data-value="satellite"], [jsaction*="layers"]'
    ];
    
    for (const selector of layersSelectors) {
      const layersButton = await waitForElement(selector, 3000);
      if (layersButton) {
        simulateClick(layersButton);
        console.log('🗺️ Layers button clicked');
        
        // Wait for menu to appear
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Look for specific map type option
        const typeSelectors = {
          satellite: '[data-value="satellite"], [aria-label*="Satellite"]',
          roadmap: '[data-value="roadmap"], [aria-label*="Default"], [aria-label*="Map"]',
          hybrid: '[data-value="hybrid"], [aria-label*="Hybrid"]',
          terrain: '[data-value="terrain"], [aria-label*="Terrain"]'
        };
        
        const typeButton = await waitForElement(typeSelectors[mapType], 2000);
        if (typeButton) {
          simulateClick(typeButton);
          return { 
            success: true, 
            action: 'change_map_type', 
            result: `Changed map type to ${mapType}` 
          };
        }
      }
    }
    
    // Fallback: URL parameter manipulation
    const url = new URL(window.location.href);
    const layerMap = {
      satellite: 's',
      hybrid: 'y',
      terrain: 'p',
      roadmap: 'm'
    };
    
    if (layerMap[mapType] && layerMap[mapType] !== 'm') {
      url.searchParams.set('layer', layerMap[mapType]);
    } else {
      url.searchParams.delete('layer');
    }
    
    window.location.href = url.toString();
    
    return { 
      success: true, 
      action: 'change_map_type', 
      result: `Changed map type to ${mapType} via URL` 
    };
  } catch (error) {
    console.error('🗺️ Failed to change map type:', error);
    return { 
      success: false, 
      action: 'change_map_type', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Pan to specific coordinates
 */
async function panTo(coordinates: Coordinates): Promise<MapsControlResult> {
  try {
    console.log('🗺️ Attempting to pan to coordinates:', coordinates);
    
    // Construct URL with coordinates
    const url = new URL(window.location.href);
    const coordString = `@${coordinates.lat},${coordinates.lng},15z`;
    
    // Update URL to pan to location
    const newUrl = url.origin + url.pathname + coordString;
    window.location.href = newUrl;
    
    return { 
      success: true, 
      action: 'pan_to', 
      result: `Panned to coordinates ${coordinates.lat}, ${coordinates.lng}` 
    };
  } catch (error) {
    console.error('🗺️ Failed to pan to coordinates:', error);
    return { 
      success: false, 
      action: 'pan_to', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Add a waypoint to the current route
 */
async function addWaypoint(waypoint: string, position?: number): Promise<MapsControlResult> {
  try {
    console.log('🗺️ Attempting to add waypoint:', waypoint);
    
    // First, ensure we're in directions mode
    const directionsBox = document.querySelector('#omnibox-directions');
    if (!directionsBox || (directionsBox as HTMLElement).style.display === 'none') {
      return {
        success: false,
        action: 'add_waypoint',
        error: 'No active directions found. Please start directions first.'
      };
    }
    
    // Look for the "Add destination" or "+" button
    const addDestinationSelectors = [
      '[data-value="add-destination"]',
      '[aria-label*="Add destination"]',
      '[aria-label*="Add stop"]',
      'button[data-value="directions.add-stop"]',
      '.directions-add-stop',
      '.directions-waypoint-add'
    ];
    
    for (const selector of addDestinationSelectors) {
      const addButton = await waitForElement(selector, 2000);
      if (addButton) {
        console.log('🗺️ Found add destination button');
        simulateClick(addButton);
        
        // Wait for new input field to appear
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Find the new waypoint input field
        const waypointInputSelectors = [
          '#directions-searchbox input:last-child',
          '.directions-waypoint-input:last-child',
          'input[placeholder*="waypoint"]',
          'input[aria-label*="waypoint"]'
        ];
        
        for (const inputSelector of waypointInputSelectors) {
          const waypointInput = await waitForElement(inputSelector, 2000) as HTMLInputElement;
          if (waypointInput) {
            console.log('🗺️ Found waypoint input field');
            simulateTyping(waypointInput, waypoint);
            
            // Press Enter to confirm
            const enterEvent = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true
            });
            waypointInput.dispatchEvent(enterEvent);
            
            return {
              success: true,
              action: 'add_waypoint',
              result: `Successfully added waypoint "${waypoint}" to the route`
            };
          }
        }
        
        return {
          success: false,
          action: 'add_waypoint',
          error: 'Could not find waypoint input field after clicking add button'
        };
      }
    }
    
    // Fallback: Try to construct a multi-destination URL
    const currentUrl = new URL(window.location.href);
    
    // If we have a directions URL, try to add the waypoint to it
    if (currentUrl.pathname.includes('/dir/')) {
      // This is a more complex URL manipulation that would need the current origin and destination
      console.log('🗺️ Attempting URL-based waypoint addition (fallback)');
      
      // For now, return a message suggesting manual addition
      return {
        success: false,
        action: 'add_waypoint',
        error: 'Could not automatically add waypoint. Please manually click "Add destination" and enter the waypoint.'
      };
    }
    
    return {
      success: false,
      action: 'add_waypoint',
      error: 'Could not find add destination button or waypoint input'
    };
    
  } catch (error) {
    console.error('🗺️ Failed to add waypoint:', error);
    return {
      success: false,
      action: 'add_waypoint',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Clear/exit current directions to return to normal map view
 */
async function clearDirections(): Promise<MapsControlResult> {
  try {
    console.log('🗺️ Attempting to clear directions');
    
    // Method 1: Look for close/X button in directions panel
    const closeSelectors = [
      '[data-value="close"], [aria-label*="Close"], [aria-label*="Exit"]',
      'button[aria-label*="Close directions"], [jsaction*="close"]',
      '.directions-panel button[aria-label*="Close"]',
      '[data-value="directions"] button:first-child'
    ];
    
    for (const selector of closeSelectors) {
      const closeButton = await waitForElement(selector, 2000);
      if (closeButton) {
        simulateClick(closeButton);
        console.log('🗺️ Close directions button clicked');
        
        // Wait for directions to clear
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return { 
          success: true, 
          action: 'clear_directions', 
          result: 'Successfully cleared directions using close button' 
        };
      }
    }
    
    // Method 2: Navigate to maps home URL to clear directions
    const currentUrl = new URL(window.location.href);
    const mapsHomeUrl = `${currentUrl.origin}/maps`;
    
    // If we're on a directions URL, navigate to clean maps
    if (currentUrl.pathname.includes('/dir/') || currentUrl.search.includes('dirflg=')) {
      window.location.href = mapsHomeUrl;
      
      return { 
        success: true, 
        action: 'clear_directions', 
        result: 'Cleared directions by navigating to maps home' 
      };
    }
    
    // Method 3: Try to manipulate URL to remove directions parameters
    const cleanUrl = new URL(window.location.href);
    
    // Remove directions-related parameters
    cleanUrl.searchParams.delete('dirflg');
    cleanUrl.searchParams.delete('destination');
    cleanUrl.searchParams.delete('origin');
    cleanUrl.searchParams.delete('travelmode');
    
    // Remove /dir/ from pathname
    if (cleanUrl.pathname.includes('/dir/')) {
      cleanUrl.pathname = cleanUrl.pathname.replace(/\/dir\/[^/]*/, '');
    }
    
    // If URL changed, navigate to clean URL
    if (cleanUrl.href !== window.location.href) {
      window.location.href = cleanUrl.href;
      
      return { 
        success: true, 
        action: 'clear_directions', 
        result: 'Cleared directions by cleaning URL parameters' 
      };
    }
    
    // Method 4: Try keyboard shortcut (Escape key)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    
    return { 
      success: true, 
      action: 'clear_directions', 
      result: 'Attempted to clear directions using Escape key' 
    };
    
  } catch (error) {
    console.error('🗺️ Failed to clear directions:', error);
    return { 
      success: false, 
      action: 'clear_directions', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Execute a maps control command
 */
export async function controlMaps(command: MapsControlCommand): Promise<MapsControlResult> {
  try {
    console.log('🗺️ Executing maps control command:', command);
    
    if (!isGoogleMapsPage()) {
      return {
        success: false,
        action: command.action,
        error: 'Current page is not Google Maps'
      };
    }
    
    switch (command.action) {
      case 'zoom_in':
        return await zoomIn();
      
      case 'zoom_out':
        return await zoomOut();
      
      case 'search':
        if (!command.params?.query) {
          return {
            success: false,
            action: command.action,
            error: 'Search query is required'
          };
        }
        return await search(command.params.query);
      
      case 'get_directions':
        if (!command.params?.destination) {
          return {
            success: false,
            action: command.action,
            error: 'Destination is required for directions'
          };
        }
        return await getDirections(command.params.destination, command.params.origin);
      
      case 'change_map_type':
        if (!command.params?.mapType) {
          return {
            success: false,
            action: command.action,
            error: 'Map type is required'
          };
        }
        return await changeMapType(command.params.mapType);
      
      case 'pan_to':
        if (!command.params?.coordinates) {
          return {
            success: false,
            action: command.action,
            error: 'Coordinates are required for panning'
          };
        }
        return await panTo(command.params.coordinates);
      
      case 'clear_directions':
        return await clearDirections();
      
      case 'add_waypoint':
        if (!command.params?.waypoint) {
          return {
            success: false,
            action: command.action,
            error: 'Waypoint address is required'
          };
        }
        return await addWaypoint(command.params.waypoint, command.params.position);
      
      default:
        return {
          success: false,
          action: command.action,
          error: `Unknown command: ${command.action}`
        };
    }
  } catch (error) {
    console.error('🗺️ Maps control execution failed:', error);
    return {
      success: false,
      action: command.action,
      error: error instanceof Error ? error.message : 'Maps control execution failed'
    };
  }
} 