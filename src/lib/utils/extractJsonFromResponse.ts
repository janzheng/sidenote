import { cleanAndParseJson, extractKeyValuePairs } from './cleanAndParseJson';

/**
 * Extract JSON from XML tags or code blocks in LLM responses
 * Handles various formats: <json>...</json>, ```json...```, or plain JSON
 */
export function extractJsonFromResponse(content: string): any {
  try {
    console.log('🔍 Attempting to extract JSON from LLM response...');
    
    // First try to extract from <json></json> tags
    const xmlMatch = content.match(/<json>\s*([\s\S]*?)\s*<\/json>/i);
    if (xmlMatch) {
      console.log('📋 Found JSON in XML tags, attempting to parse...');
      try {
        const result = cleanAndParseJson(xmlMatch[1]);
        console.log('✅ Successfully parsed JSON from XML tags');
        return result;
      } catch (parseError) {
        console.warn('❌ Failed to parse JSON from XML tags:', parseError instanceof Error ? parseError.message : parseError);
      }
    }

    // Try to extract from ```json code blocks
    const codeBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch) {
      console.log('📋 Found JSON in code block, attempting to parse...');
      try {
        const result = cleanAndParseJson(codeBlockMatch[1]);
        console.log('✅ Successfully parsed JSON from code block');
        return result;
      } catch (parseError) {
        console.warn('❌ Failed to parse JSON from code block:', parseError instanceof Error ? parseError.message : parseError);
      }
    }

    // Try to extract from ``` blocks without json tag
    const genericCodeBlockMatch = content.match(/```\s*([\s\S]*?)\s*```/);
    if (genericCodeBlockMatch) {
      console.log('📋 Found generic code block, attempting to parse...');
      try {
        const result = cleanAndParseJson(genericCodeBlockMatch[1]);
        console.log('✅ Successfully parsed JSON from generic code block');
        return result;
      } catch (parseError) {
        console.warn('❌ Failed to parse JSON from generic code block:', parseError instanceof Error ? parseError.message : parseError);
      }
    }

    // Try to find JSON object in the content
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      console.log('📋 Found JSON object in content, attempting to parse...');
      try {
        const result = cleanAndParseJson(jsonMatch[0]);
        console.log('✅ Successfully parsed JSON object from content');
        return result;
      } catch (parseError) {
        console.warn('❌ Failed to parse JSON object from content:', parseError instanceof Error ? parseError.message : parseError);

        // Last resort: try manual key-value extraction
        try {
          const manualResult = extractKeyValuePairs(jsonMatch[0]);
          if (manualResult) {
            console.log('✅ Successfully extracted data using manual parsing');
            return manualResult;
          }
        } catch (manualError) {
          console.warn('❌ Manual extraction also failed:', manualError instanceof Error ? manualError.message : manualError);
        }
      }
    }

    // Try to find JSON array in the content
    const jsonArrayMatch = content.match(/\[[\s\S]*\]/);
    if (jsonArrayMatch) {
      console.log('📋 Found JSON array in content, attempting to parse...');
      try {
        const result = JSON.parse(jsonArrayMatch[0]);
        if (Array.isArray(result)) {
          console.log('✅ Successfully parsed JSON array from content');
          return result;
        }
      } catch (parseError) {
        console.warn('❌ Failed to parse JSON array from content:', parseError instanceof Error ? parseError.message : parseError);
      }
    }

    console.warn('⚠️ No valid JSON structure found in content');
    console.log('📄 Content preview:', content.substring(0, 500) + (content.length > 500 ? '...' : ''));
    return null;
  } catch (error) {
    console.error('💥 Error extracting JSON from content:', error);
    return null;
  }
} 