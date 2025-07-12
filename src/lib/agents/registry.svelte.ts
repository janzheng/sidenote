import { z } from 'zod';

// Component registry
export const registry: Record<string, any> = {};
export const schemas: Record<string, z.ZodTypeAny> = {};

// Base content types for the agent
export const AgentContent = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    content: z.string().max(10000) // 10KB limit
  }),
  z.object({
    type: z.literal('component'),
    name: z.string(),
    props: z.record(z.string(), z.any()).refine(
      (props: Record<string, any>) => JSON.stringify(props).length <= 10240, // 10KB limit
      { message: "Props must be under 10KB when serialized" }
    )
  }),
  z.object({
    type: z.literal('tool_result'),
    data: z.record(z.string(), z.any())
  }),
  z.object({
    type: z.literal('comment'),
    text: z.string().max(1000)
  }),
  z.object({
    type: z.literal('thinking'),
    content: z.string().max(5000)
  })
]);

export type AgentContent = z.infer<typeof AgentContent>;

// Component loader with schema registration
export async function loadComponent(name: string) {
  switch (name) {
    case 'WeatherCard':
      if (!registry[name]) {
        // Component will be rendered by the UI layer
        registry[name] = true; // Mark as loaded
        schemas[name] = z.object({
          location: z.string(),
          temp_c: z.number(),
          condition: z.string(),
          ts: z.string().datetime()
        });
      }
      break;
    
    case 'SearchResults':
      if (!registry[name]) {
        // Component will be rendered by the UI layer
        registry[name] = true; // Mark as loaded
        schemas[name] = z.object({
          query: z.string(),
          results: z.array(z.object({
            title: z.string(),
            url: z.string().url(),
            snippet: z.string()
          })),
          count: z.number()
        });
      }
      break;
    
    case 'StatusCard':
      if (!registry[name]) {
        // Component will be rendered by the UI layer
        registry[name] = true; // Mark as loaded
        schemas[name] = z.object({
          status: z.enum(['success', 'error', 'warning', 'info']),
          message: z.string(),
          details: z.string().optional()
        });
      }
      break;
    
    default:
      console.warn(`Unknown component: ${name}`);
      break;
  }
}

// Sanitize text content using basic HTML escaping
export function sanitize(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Validate component props against schema
export function validateComponentProps(name: string, props: any): { success: boolean; error?: string; data?: any } {
  const schema = schemas[name];
  if (!schema) {
    return { success: true, data: props }; // No schema means no validation
  }
  
  const result = schema.safeParse(props);
  if (!result.success) {
    return { 
      success: false, 
      error: result.error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ')
    };
  }
  
  return { success: true, data: result.data };
} 