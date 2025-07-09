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
    
    // Clean up common LLM JSON issues
    let cleaned = jsonStr
      .trim()
      // Remove any trailing commas before closing braces/brackets
      .replace(/,(\s*[}\]])/g, '$1')
      // Ensure property names are properly quoted
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
      // Remove problematic control characters but preserve newlines and tabs
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Fix common issues with bullet points and special characters in JSON strings
      .replace(/\n\s*\* /g, '\\n• ')
      .replace(/\* /g, '• ');
    
    return JSON.parse(cleaned);
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