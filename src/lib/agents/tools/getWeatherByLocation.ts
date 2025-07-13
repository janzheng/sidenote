import type { AgentTool } from './types';

export const getWeatherByLocationTool: AgentTool = {
  name: 'get_weather_by_location',
  description: 'Get current weather information for a location',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'The city and state/country to get weather for (must be specific, no placeholders like [location])'
      }
    },
    required: ['location']
  },
  func: async (params: { location: string }) => {
    // Validate location is not a placeholder or too short
    if (!params.location || params.location.length < 2 || 
        params.location.includes('[') || params.location.includes(']') ||
        params.location.toLowerCase().includes('location') ||
        params.location.toLowerCase().includes('placeholder')) {
      return {
        type: 'comment' as const,
        text: `⚠️ Invalid location "${params.location}". Please provide a specific city name, not a placeholder.`
      };
    }
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock weather data
    const mockWeather = {
      temp_c: Math.floor(Math.random() * 30) + 5,
      condition: ['Sunny', 'Cloudy', 'Rainy', 'Snowy'][Math.floor(Math.random() * 4)],
      location: params.location,
      ts: new Date().toISOString()
    };
    
    return [
      {
        type: 'tool_result' as const,
        data: mockWeather
      },
      {
        type: 'component' as const,
        name: 'WeatherCard',
        props: mockWeather
      }
    ];
  }
}; 