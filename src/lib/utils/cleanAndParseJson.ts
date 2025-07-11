/**
 * Clean and parse JSON from LLM responses
 * Handles common formatting issues from AI-generated JSON
 */
export function cleanAndParseJson(jsonStr: string): any {
  try {
    // First try parsing as-is
    return JSON.parse(jsonStr);
  } catch (parseError) {
    console.log('🧹 Initial parse failed, attempting cleanup...');
    
    try {
      // Clean up common LLM JSON issues
      let cleaned = jsonStr
        .trim()
        // Remove any trailing commas before closing braces/brackets
        .replace(/,(\s*[}\]])/g, '$1')
        // Ensure property names are properly quoted
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
        // Fix newlines and control characters in JSON string values
        .replace(/"([^"]*)"(\s*:\s*)"([^"]*(?:\\.[^"]*)*)"/g, (match, key, colon, value) => {
          // Clean the value part - escape newlines and remove control characters
          const cleanValue = value
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
          return `"${key}"${colon}"${cleanValue}"`;
        })
        // Remove any remaining problematic control characters outside of strings
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      
      return JSON.parse(cleaned);
    } catch (secondError) {
      console.log('🧹 Second cleanup attempt failed, trying more aggressive cleaning...');
      
      try {
        // More aggressive cleaning - extract and rebuild JSON structure
        const summaryMatch = jsonStr.match(/"summary"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
        const fullTextMatch = jsonStr.match(/"fullText"\s*:\s*"([^"]*(?:\\.[^"]*)*)"(?:\s*}?\s*$)/s);
        
        if (summaryMatch && fullTextMatch) {
          const summary = summaryMatch[1]
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
            
          const fullText = fullTextMatch[1]
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
          
          return {
            summary: summary,
            fullText: fullText
          };
        }
        
        throw new Error('Could not extract summary and fullText fields');
      } catch (thirdError) {
        console.error('🚨 All JSON cleanup attempts failed');
        throw new Error(`JSON parsing failed: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
    }
  }
}

/**
 * Manual key-value extraction as a last resort
 * Attempts to extract basic citation fields even from malformed JSON
 */
export function extractKeyValuePairs(jsonStr: string): any {
  const result: any = {};
  
  // Common citation fields to look for
  const fieldPatterns = [
    { field: 'doi', pattern: /"?doi"?\s*:\s*"([^"]*)"/ },
    { field: 'title', pattern: /"?title"?\s*:\s*"([^"]*)"/ },
    { field: 'journal', pattern: /"?journal"?\s*:\s*"([^"]*)"/ },
    { field: 'year', pattern: /"?year"?\s*:\s*"([^"]*)"/ },
    { field: 'pmid', pattern: /"?pmid"?\s*:\s*"([^"]*)"/ },
    { field: 'pmcid', pattern: /"?pmcid"?\s*:\s*"([^"]*)"/ },
    { field: 'arxiv', pattern: /"?arxiv"?\s*:\s*"([^"]*)"/ },
    { field: 'volume', pattern: /"?volume"?\s*:\s*"([^"]*)"/ },
    { field: 'issue', pattern: /"?issue"?\s*:\s*"([^"]*)"/ },
    { field: 'pages', pattern: /"?pages"?\s*:\s*"([^"]*)"/ },
    { field: 'publisher', pattern: /"?publisher"?\s*:\s*"([^"]*)"/ },
  ];
  
  // Try to extract authors array
  const authorsMatch = jsonStr.match(/"?authors"?\s*:\s*\[(.*?)\]/s);
  if (authorsMatch) {
    try {
      const authorsStr = authorsMatch[1];
      const authors = authorsStr
        .split(',')
        .map(author => author.trim().replace(/^"|"$/g, ''))
        .filter(author => author.length > 0);
      
      if (authors.length > 0) {
        result.authors = authors;
        result.first_author = authors[0];
        if (authors.length > 1) {
          result.last_author = authors[authors.length - 1];
        }
      }
    } catch (error) {
      console.warn('Failed to extract authors array');
    }
  }
  
  // Extract individual fields
  for (const { field, pattern } of fieldPatterns) {
    const match = jsonStr.match(pattern);
    if (match && match[1] && match[1].trim().length > 0) {
      result[field] = match[1].trim();
    }
  }
  
  console.log('🔧 Manual extraction result:', result);
  return Object.keys(result).length > 0 ? result : null;
} 