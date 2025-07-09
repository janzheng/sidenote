/**
 * Extract JSON-LD structured data from the current page
 * This is a specialized task that can be used independently
 */
export interface JsonLdExtractionResult {
  success: boolean;
  data?: any[];
  error?: string;
}

/**
 * Extract all JSON-LD scripts from the page and parse them
 */
export async function extractJsonLd(): Promise<JsonLdExtractionResult> {
  try {
    console.log('🔍 Extracting JSON-LD structured data from:', window.location.href);
    
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    
    if (jsonLdScripts.length === 0) {
      return {
        success: true,
        data: []
      };
    }
    
    const schemaData = Array.from(jsonLdScripts).map((script, index) => {
      try {
        const parsed = JSON.parse(script.textContent || '');
        return {
          index,
          data: parsed,
          source: 'json-ld'
        };
      } catch (parseError) {
        console.warn(`🔍 Failed to parse JSON-LD script ${index}:`, parseError);
        return {
          index,
          error: parseError instanceof Error ? parseError.message : 'Parse error',
          source: 'json-ld'
        };
      }
    });
    
    const validData = schemaData.filter(item => item.data);
    const errors = schemaData.filter(item => item.error);
    
    console.log('🔍 JSON-LD extraction complete:', {
      totalScripts: jsonLdScripts.length,
      validData: validData.length,
      errors: errors.length
    });
    
    if (errors.length > 0) {
      console.warn('🔍 JSON-LD parsing errors:', errors);
    }
    
    return {
      success: true,
      data: validData.map(item => item.data)
    };
  } catch (error) {
    console.error('🔍 JSON-LD extraction failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'JSON-LD extraction failed'
    };
  }
}

/**
 * Extract and flatten all objects from JSON-LD data
 * Handles @graph arrays and nested structures
 */
export function flattenJsonLdObjects(data: any[]): any[] {
  const allObjects: any[] = [];
  
  const processObject = (obj: any): void => {
    if (Array.isArray(obj)) {
      obj.forEach(processObject);
    } else if (obj && typeof obj === 'object') {
      if (obj['@graph'] && Array.isArray(obj['@graph'])) {
        obj['@graph'].forEach(processObject);
      } else if (obj['@type']) {
        allObjects.push(obj);
      }
      
      // Process nested objects
      Object.values(obj).forEach((value: any) => {
        if (Array.isArray(value)) {
          value.forEach(processObject);
        } else if (value && typeof value === 'object' && value['@type']) {
          processObject(value);
        }
      });
    }
  };
  
  data.forEach(processObject);
  return allObjects;
}

/**
 * Find specific schema types in JSON-LD data
 */
export function findSchemaTypes(data: any[], types: string[]): any[] {
  const flattened = flattenJsonLdObjects(data);
  
  return flattened.filter((obj: any) => {
    if (!obj['@type']) return false;
    
    const objTypes = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
    return types.some(type => objTypes.includes(type));
  });
} 