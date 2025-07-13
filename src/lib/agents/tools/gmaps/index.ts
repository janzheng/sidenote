import type { AgentTool } from '../types';

// Import all maps tools
import { addWaypoint } from './addWaypoint';
import { findPlacesNearbyTool } from './findPlacesNearby';
import { getDirectionsToTool } from './getDirectionsTo';
import { exploreAreaTool } from './exploreArea';
import { goHomeTool } from './goHome';
import { clearDirectionsTool } from './clearDirections';
import { changeMapViewTool } from './changeMapView';
import { zoomMapTool } from './zoomMap';

// Export utility functions
export { getCurrentMapsTabUrl, getMapsData } from './utils';

// Create a multi-destination planning tool
export const planMultiDestinationTripTool: AgentTool = {
  name: 'plan_multi_destination_trip',
  description: 'Plan a trip with multiple destinations in one optimized route. Use this when someone wants to visit multiple places in a single journey.',
  parameters: {
    type: 'object',
    properties: {
      destinations: {
        type: 'string',
        description: 'Array of places to visit in order (e.g., ["Mystery Spot", "Shadowbrook Restaurant"]) or comma-separated string. Minimum 2 destinations required.'
      },
      waypoints: {
        type: 'string',
        description: 'Alternative parameter name for destinations - array of places to visit in order. Use either destinations or waypoints, not both.'
      },
      from: {
        type: 'string',
        description: 'Starting point (optional, defaults to current location)'
      },
      optimize: {
        type: 'boolean',
        description: 'Whether to let Google Maps optimize the route order (default: false)'
      }
    },
    required: []
  },
  func: async (params: { destinations?: string | string[]; waypoints?: string | string[]; from?: string; optimize?: boolean }) => {
    const { getCurrentMapsTabUrl } = await import('./utils');
    
    const url = await getCurrentMapsTabUrl();
    if (!url) {
      return {
        type: 'comment',
        text: 'Please open Google Maps first to plan your multi-destination trip.'
      };
    }

    try {
      console.log('🗺️ Full params object received:', params);
      console.log('🗺️ Params type:', typeof params);
      console.log('🗺️ Params keys:', Object.keys(params));
      
      // Handle both 'destinations' and 'waypoints' parameter names (LLM sometimes confuses them)
      const { destinations: destinationsInput, waypoints: waypointsInput, from, optimize = false } = params;
      const actualInput = destinationsInput || waypointsInput;
      
      console.log('🗺️ Destructured parameters:', { destinationsInput, waypointsInput, actualInput, from, optimize });
      console.log('🗺️ actualInput type:', typeof actualInput);
      
      // Handle both array and string inputs
      let destinations: string[];
      
      if (Array.isArray(actualInput)) {
        // If it's already an array, use it directly
        destinations = actualInput.filter(dest => dest && dest.trim().length > 0);
        console.log('🗺️ Using array input:', destinations);
      } else if (typeof actualInput === 'string') {
        // Check if it's a JSON string first
        try {
          const parsed = JSON.parse(actualInput);
          if (parsed.destinations && Array.isArray(parsed.destinations)) {
            // Extract just the destinations array from the JSON
            destinations = parsed.destinations.filter((dest: any) => dest && typeof dest === 'string' && dest.trim().length > 0);
            console.log('🗺️ Parsed JSON destinations:', destinations);
          } else if (Array.isArray(parsed)) {
            // If the parsed result is an array directly
            destinations = parsed.filter((dest: any) => dest && typeof dest === 'string' && dest.trim().length > 0);
            console.log('🗺️ Parsed JSON array:', destinations);
          } else {
            throw new Error('Invalid JSON structure');
          }
        } catch (jsonError) {
          // If JSON parsing fails, fall back to comma-separated string
          destinations = actualInput.split(',').map(dest => dest.trim()).filter(dest => dest.length > 0);
          console.log('🗺️ Parsed comma-separated string:', destinations);
        }
      } else {
        console.log('🗺️ Invalid input:', actualInput);
        return {
          type: 'comment',
          text: `Invalid destinations parameter. Received: ${JSON.stringify(params)}. Please provide an array of places or a comma-separated string using either 'destinations' or 'waypoints' parameter.`
        };
      }
      
      if (destinations.length < 2) {
        return {
          type: 'comment',
          text: 'Multi-destination trip requires at least 2 destinations. For single destination, use get_directions_to instead.'
        };
      }

      console.log(`🗺️ Planning multi-destination trip with ${destinations.length} stops:`, destinations);
      
      // Construct Google Maps URL with multiple destinations
      // For international trips, use first destination as origin instead of "My Location"
      // BUT respect explicit user preference for starting from current location
      const hasInternationalIndicators = destinations.some(dest => 
        dest.toLowerCase().includes('airport') ||
        dest.toLowerCase().includes('international') ||
        /,\s*[a-z]{2,}$/i.test(dest) || // Ends with ", Country"
        /\b[a-z]{2,}\s*,\s*[a-z]{2,}/i.test(dest) // Contains "City, Country" pattern
      );
      
      // Only override "My Location" for international trips if user didn't specify starting point
      const shouldUseFirstDestinationAsOrigin = hasInternationalIndicators && !from;
      const origin = from || (shouldUseFirstDestinationAsOrigin ? destinations[0] : 'My Location');
      const finalDestination = destinations[destinations.length - 1];
      const waypoints = shouldUseFirstDestinationAsOrigin ? destinations.slice(1, -1) : destinations.slice(0, -1);
      
      let directionsUrl = `https://maps.google.com/maps/dir/${encodeURIComponent(origin)}`;
      
      // Add waypoints
      waypoints.forEach(waypoint => {
        directionsUrl += `/${encodeURIComponent(waypoint)}`;
      });
      
      // Add final destination
      directionsUrl += `/${encodeURIComponent(finalDestination)}`;
      
      // Add optimization parameter if requested
      if (optimize) {
        directionsUrl += '?optimize=true';
      }
      
      // Navigate to the multi-destination URL
      await chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
          chrome.tabs.update(tabs[0].id, { url: directionsUrl });
        }
      });
      
      const tripList = destinations.map((dest, i) => `${i + 1}. ${dest}`).join('\n');
      const fromText = from ? ` from ${from}` : ' from your current location';
      const optimizeText = optimize ? ' Google Maps will optimize the order of your stops for the most efficient route.' : '';
      
      const response = `🗺️ **Multi-Destination Trip Planned!**\n\nI've created a route${fromText} with ${destinations.length} destinations:\n\n${tripList}\n\nYour trip is now displayed on Google Maps with:\n\n• Complete multi-leg journey\n• Turn-by-turn directions for each segment\n• Estimated travel times\n• Total trip duration\n• Ability to reorder stops by dragging${optimizeText}\n\nReady for your multi-destination adventure!`;
      
      return {
        type: 'text',
        content: response
      };
    } catch (error) {
      return {
        type: 'comment',
        text: `Failed to plan multi-destination trip: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
};

// Create a tool for updating existing multi-destination routes
export const updateMultiDestinationTripTool: AgentTool = {
  name: 'update_multi_destination_trip',
  description: 'Update an existing multi-destination route by adding, removing, or modifying stops. Use this when user wants to revise their current trip itinerary.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Type of update: "add" to add stops, "remove" to remove stops, "replace" to replace entire route, or "clear_and_replan" to start fresh. If not provided, will be inferred from other parameters.'
      },
      destinations: {
        type: 'string',
        description: 'New complete list of destinations for replace/clear_and_replan actions. Can also be used as fallback input.'
      },
      waypoints: {
        type: 'string',
        description: 'Alternative parameter name for destinations - array of places to visit in order.'
      },
      add_stops: {
        type: 'string',
        description: 'Stops to add to the route (array or comma-separated string)'
      },
      remove_stops: {
        type: 'string',
        description: 'Stops to remove from the route (array or comma-separated string)'
      },
      position: {
        type: 'string',
        description: 'Position to insert new stops (for add action): "start", "end", or after specific stop name'
      },
      from: {
        type: 'string',
        description: 'Starting point (optional, defaults to current location)'
      },
      optimize: {
        type: 'boolean',
        description: 'Whether to let Google Maps optimize the route order (default: false)'
      }
    },
    required: []
  },
  func: async (params: { 
    action?: string; 
    destinations?: string | string[]; 
    waypoints?: string | string[];
    add_stops?: string | string[]; 
    remove_stops?: string | string[]; 
    position?: string;
    from?: string; 
    optimize?: boolean 
  }) => {
    const { getCurrentMapsTabUrl } = await import('./utils');
    
    const url = await getCurrentMapsTabUrl();
    if (!url) {
      return {
        type: 'comment',
        text: 'Please open Google Maps first to update your multi-destination trip.'
      };
    }

    try {
      console.log('🗺️ Update trip params received:', params);
      
      let { action, destinations, waypoints, add_stops, remove_stops, position, from, optimize = false } = params;
      
      // Handle both 'destinations' and 'waypoints' parameter names
      const actualDestinations = destinations || waypoints;
      
      // Smart action inference if not provided
      if (!action) {
        if (actualDestinations) {
          action = 'clear_and_replan';
          console.log('🗺️ Inferred action: clear_and_replan (destinations/waypoints provided)');
        } else if (add_stops) {
          action = 'add';
          console.log('🗺️ Inferred action: add (add_stops provided)');
        } else if (remove_stops) {
          action = 'remove';
          console.log('🗺️ Inferred action: remove (remove_stops provided)');
        } else {
          action = 'clear_and_replan';
          console.log('🗺️ Default action: clear_and_replan');
        }
      }
      
      if (action === 'clear_and_replan' || action === 'replace') {
        // Use the original planning tool logic
        const actualInput = actualDestinations;
        let newDestinations: string[];
        
        if (Array.isArray(actualInput)) {
          newDestinations = actualInput.filter(dest => dest && dest.trim().length > 0);
        } else if (typeof actualInput === 'string') {
          newDestinations = actualInput.split(',').map(dest => dest.trim()).filter(dest => dest.length > 0);
        } else {
          return {
            type: 'comment',
            text: `Invalid destinations for ${action}. Please provide an array of places or a comma-separated string.`
          };
        }
        
        if (newDestinations.length < 2) {
          return {
            type: 'comment',
            text: 'Multi-destination trip requires at least 2 destinations.'
          };
        }
        
        // Clear existing route first
        await chrome.runtime.sendMessage({
          action: 'controlMaps',
          command: {
            action: 'clear_directions'
          }
        });
        
        // Wait a moment for clearing to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Create new route
        const origin = from || 'My Location';
        const finalDestination = newDestinations[newDestinations.length - 1];
        const waypoints = newDestinations.slice(0, -1);
        
        let directionsUrl = `https://maps.google.com/maps/dir/${encodeURIComponent(origin)}`;
        waypoints.forEach(waypoint => {
          directionsUrl += `/${encodeURIComponent(waypoint)}`;
        });
        directionsUrl += `/${encodeURIComponent(finalDestination)}`;
        
        if (optimize) {
          directionsUrl += '?optimize=true';
        }
        
        await chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0] && tabs[0].id) {
            chrome.tabs.update(tabs[0].id, { url: directionsUrl });
          }
        });
        
        const tripList = newDestinations.map((dest, i) => `${i + 1}. ${dest}`).join('\n');
        const fromText = from ? ` from ${from}` : ' from your current location';
        
        return {
          type: 'text',
          content: `🗺️ **Route ${action === 'clear_and_replan' ? 'Replanned' : 'Updated'}!**\n\nI've ${action === 'clear_and_replan' ? 'cleared the old route and created a new' : 'updated your'} route${fromText} with ${newDestinations.length} destinations:\n\n${tripList}\n\nYour updated trip is now displayed on Google Maps with fresh directions and timing estimates.`
        };
      }
      
      // For add/remove actions, we'd need to get current route info first
      // This is more complex and would require extracting current route data
      return {
        type: 'comment',
        text: `Route update action "${action}" is not yet implemented. Please use "clear_and_replan" or "replace" for now, or use the plan_multi_destination_trip tool to create a new route.`
      };
      
    } catch (error) {
      return {
        type: 'comment',
        text: `Failed to update multi-destination trip: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
};

// Create a tool for validating and fixing multi-destination routes
export const validateMultiDestinationRouteTool: AgentTool = {
  name: 'validate_multi_destination_route',
  description: 'Check if a multi-destination route has geographic inconsistencies (e.g., locations in wrong countries) and suggest corrections. Use this after creating routes that might have ambiguous location names.',
  parameters: {
    type: 'object',
    properties: {
      destinations: {
        type: 'string',
        description: 'Array of destinations to validate, or comma-separated string of places to check for geographic consistency'
      },
      expected_region: {
        type: 'string',
        description: 'Expected geographic region/country (e.g., "New Zealand", "California", "Europe") to validate against'
      },
      fix_errors: {
        type: 'boolean',
        description: 'Whether to automatically create a corrected route if errors are found (default: true)'
      }
    },
    required: ['destinations', 'expected_region']
  },
  func: async (params: { destinations: string | string[]; expected_region: string; fix_errors?: boolean }) => {
    const { getCurrentMapsTabUrl } = await import('./utils');
    
    const url = await getCurrentMapsTabUrl();
    if (!url) {
      return {
        type: 'comment',
        text: 'Please open Google Maps first to validate your route.'
      };
    }

    try {
      console.log('🔍 Validating multi-destination route:', params);
      
      // Parse destinations
      let destinations: string[];
      if (Array.isArray(params.destinations)) {
        destinations = params.destinations;
      } else {
        try {
          const parsed = JSON.parse(params.destinations);
          destinations = Array.isArray(parsed) ? parsed : params.destinations.split(',').map(d => d.trim());
        } catch {
          destinations = params.destinations.split(',').map(d => d.trim());
        }
      }
      
      const expectedRegion = params.expected_region.toLowerCase();
      const fixErrors = params.fix_errors !== false; // Default to true
      
      // Check each destination for geographic consistency
      const problematicDestinations: string[] = [];
      const suggestions: string[] = [];
      
      destinations.forEach((dest, index) => {
        const destLower = dest.toLowerCase();
        
        // Check if destination already has the expected region
        if (destLower.includes(expectedRegion)) {
          return; // This destination is fine
        }
        
        // Check for common geographic mismatches
        const hasWrongCountry = 
          (expectedRegion.includes('new zealand') && (destLower.includes('new york') || destLower.includes('ny'))) ||
          (expectedRegion.includes('california') && destLower.includes('canada')) ||
          (expectedRegion.includes('australia') && destLower.includes('austria')) ||
          (expectedRegion.includes('japan') && destLower.includes('jamaica'));
        
        // Check if destination lacks country specification
        const lacksCountrySpec = !destLower.includes(',') && 
          !destLower.includes('airport') && 
          !destLower.includes(expectedRegion);
        
        if (hasWrongCountry || lacksCountrySpec) {
          problematicDestinations.push(dest);
          
          // Generate suggestion
          let suggestion = dest;
          if (hasWrongCountry) {
            // Remove wrong country and add correct one
            suggestion = dest.replace(/,?\s*(new york|ny|canada|austria|jamaica)/gi, '');
          }
          
          // Add the expected region if not already present
          if (!suggestion.toLowerCase().includes(expectedRegion)) {
            const regionToAdd = expectedRegion.split(' ').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
            suggestion = `${suggestion.trim()}, ${regionToAdd}`;
          }
          
          suggestions.push(suggestion);
        }
      });
      
      if (problematicDestinations.length === 0) {
        return {
          type: 'text',
          content: `✅ **Route Validation Passed!**\n\nAll ${destinations.length} destinations appear to be correctly located in ${params.expected_region}:\n\n${destinations.map((dest, i) => `${i + 1}. ${dest}`).join('\n')}\n\nYour route should work perfectly with Google Maps! 🗺️`
        };
      }
      
      // Found problems - report them
      let response = `⚠️ **Route Validation Issues Found!**\n\nI found ${problematicDestinations.length} destination(s) that might cause Google Maps routing problems:\n\n`;
      
      problematicDestinations.forEach((problem, index) => {
        response += `❌ **"${problem}"** → ✅ **"${suggestions[index]}"**\n`;
      });
      
      response += `\n🔍 **Issue**: These destinations might be resolving to locations in the wrong country/region instead of ${params.expected_region}.\n\n`;
      
      if (fixErrors) {
        // Create corrected destinations list
        const correctedDestinations = destinations.map(dest => {
          const problemIndex = problematicDestinations.indexOf(dest);
          return problemIndex !== -1 ? suggestions[problemIndex] : dest;
        });
        
        response += `🔧 **Auto-Fix Applied**: Creating corrected route with proper location names...\n\n`;
        
        // Create the corrected route
        const correctedTripList = correctedDestinations.map((dest, i) => `${i + 1}. ${dest}`).join('\n');
        
        // Construct corrected Google Maps URL
        const origin = correctedDestinations[0];
        const finalDestination = correctedDestinations[correctedDestinations.length - 1];
        const waypoints = correctedDestinations.slice(1, -1);
        
        let directionsUrl = `https://maps.google.com/maps/dir/${encodeURIComponent(origin)}`;
        waypoints.forEach(waypoint => {
          directionsUrl += `/${encodeURIComponent(waypoint)}`;
        });
        directionsUrl += `/${encodeURIComponent(finalDestination)}`;
        
        // Navigate to corrected URL
        await chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0] && tabs[0].id) {
            chrome.tabs.update(tabs[0].id, { url: directionsUrl });
          }
        });
        
        response += `✅ **Corrected Route Created!**\n\n${correctedTripList}\n\nThe route has been updated on Google Maps with more specific location names to prevent geographic confusion.`;
      } else {
        response += `💡 **Recommendation**: Use the corrected destination names above, or set \`fix_errors: true\` to automatically create a corrected route.`;
      }
      
      return {
        type: 'text',
        content: response
      };
      
    } catch (error) {
      return {
        type: 'comment',
        text: `Failed to validate route: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
};

// Enhanced Maps tools for ReAct agent
export const mapsTools: AgentTool[] = [
  addWaypoint,
  findPlacesNearbyTool,
  getDirectionsToTool,
  planMultiDestinationTripTool,
  updateMultiDestinationTripTool,
  validateMultiDestinationRouteTool,
  exploreAreaTool,
  goHomeTool,
  clearDirectionsTool,
  changeMapViewTool,
  zoomMapTool
];

// Get only Maps tools for Maps-specific agent
export function getMapsTools(): AgentTool[] {
  return mapsTools;
} 