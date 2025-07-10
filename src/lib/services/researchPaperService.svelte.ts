import type { TabData } from '../../types/tabData';
import type { ResearchPaperAnalysis } from '../../types/researchPaper';
import { GroqService } from './groqService.svelte';
import { getCurrentSettings } from '../ui/settings.svelte';

interface ResearchPaperExtractionResult {
  success: boolean;
  analysis?: ResearchPaperAnalysis;
  error?: string;
}

interface ResearchPaperValidationResult {
  isValid: boolean;
  message?: string;
}

interface SectionExtractionResult {
  sections: Record<string, { summary: string; fullText: string }>;
  extractionInfo: {
    totalSections: number;
    extractionMethod: string;
    extractedAt: string;
    contentType: string;
    sectionOrder?: string[];
  };
}

export class ResearchPaperService {

  /**
   * Validate that required settings are configured for research paper extraction
   */
  static validateSettings(): ResearchPaperValidationResult {
    const settings = getCurrentSettings();
    
    if (!settings.apiKey || settings.apiKey.trim().length === 0) {
      return { 
        isValid: false, 
        message: 'Groq API key is required. Please configure it in settings.' 
      };
    }
    
    return { isValid: true };
  }

  /**
   * Main research paper extraction method - handles both comprehensive and quick analysis
   */
  static async extractResearchPaper(
    tabData: TabData, 
    userBackground?: string, 
    isQuickAnalysis: boolean = false
  ): Promise<ResearchPaperExtractionResult> {
    try {
      console.log(`🔬 Starting ${isQuickAnalysis ? 'quick' : 'comprehensive'} research paper extraction for:`, tabData.content.url);

      // Validate settings first
      const validation = this.validateSettings();
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.message
        };
      }

      const { title, wordCount, text, html, metadata } = tabData.content;
      
      // Check if this looks like a research paper
      if (!this.isResearchPaper(text, title, metadata)) {
        return {
          success: false,
          error: 'This content does not appear to be a research paper. Research paper extraction works best with academic papers, journal articles, and preprints.'
        };
      }

      // Extract sections from the content
      const sectionResult = await this.extractSections(text, title, userBackground, isQuickAnalysis);
      
      if (!sectionResult.sections || Object.keys(sectionResult.sections).length === 0) {
        return {
          success: false,
          error: 'Could not extract meaningful sections from the research paper'
        };
      }

             // Extract key findings and insights
       const keyFindings = this.extractKeyFindings(sectionResult.sections);
       const methodology = this.extractMethodology(sectionResult.sections);
       
       // Build the analysis object with both comprehensive and quick fields
       const analysis: ResearchPaperAnalysis = {
         title: title,
         authors: metadata.citations?.authors || (metadata.author ? [metadata.author] : []),
         abstract: sectionResult.sections.Abstract?.summary || sectionResult.sections['TL;DR']?.fullText || '',
         
         // Comprehensive analysis fields
         keyFindings: keyFindings,
         methodology: methodology,
         significance: this.extractSignificance(sectionResult.sections),
         limitations: this.extractLimitations(sectionResult.sections),
         futureWork: this.extractFutureWork(sectionResult.sections),
         practicalImplications: this.extractPracticalImplications(sectionResult.sections),
         
         // Quick analysis fields (always include for better UX)
         tldr: sectionResult.sections['TL;DR']?.fullText || this.generateTLDR(sectionResult.sections),
         keyInsights: this.extractKeyInsights(sectionResult.sections),
         whyItMatters: this.extractWhyItMatters(sectionResult.sections),
         practicalTakeaways: this.extractPracticalTakeaways(sectionResult.sections),
         nextSteps: this.extractNextSteps(sectionResult.sections),
         
         // Technical details
         technicalDetails: {
           sampleSize: this.extractSampleSize(text),
           dataCollection: this.extractDataCollection(text),
           analysisApproach: this.extractAnalysisApproach(text)
         },
         
         // Metadata
         readabilityScore: this.assessReadability(text),
         recommendedFor: this.getRecommendedAudience(userBackground, sectionResult.sections),
         isQuickAnalysis: isQuickAnalysis,
         
         // Section data
         sections: sectionResult.sections,
         
         // Extraction metadata
         extractedAt: new Date().toISOString(),
         extractionMethod: isQuickAnalysis ? 'quick_ai_analysis' : 'comprehensive_ai_analysis',
         extractionInfo: sectionResult.extractionInfo
       };

      // Validate the analysis before returning
      const validationResult = this.validateAnalysis(analysis);
      if (!validationResult.isValid) {
        console.warn('⚠️ Analysis validation failed:', validationResult.message);
        // Still return the analysis but with a warning
      }

      console.log(`✅ Research paper analysis generated successfully (${Object.keys(sectionResult.sections).length} sections)`);
      return {
        success: true,
        analysis: analysis
      };

    } catch (error) {
      console.error('❌ Research paper extraction error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown research paper extraction error'
      };
    }
  }

  /**
   * Quick research paper extraction (AI-generated sections only)
   */
  static async extractResearchPaperQuick(tabData: TabData, userBackground?: string): Promise<ResearchPaperExtractionResult> {
    return this.extractResearchPaper(tabData, userBackground, true);
  }

  /**
   * Extract sections from research paper content using AI
   */
  private static async extractSections(
    content: string, 
    title: string, 
    userBackground?: string, 
    isQuickAnalysis: boolean = false
  ): Promise<SectionExtractionResult> {
    
    // Our synthetic sections that we always want to include
    const syntheticSections = isQuickAnalysis 
      ? ['TL;DR', 'Key Insights', 'Practical Implications', 'What\'s Next', 'Conflict of Interest']
      : ['TL;DR', 'Key Insights', 'Practical Implications', 'What\'s Next', 'Conflict of Interest', 'Future Work'];

    // First pass: Identify all sections in the paper with their natural order
    const identifiedSections = await this.identifySections(content, title, userBackground, isQuickAnalysis);
    
    // Combine synthetic sections with identified sections
    const allSectionsToExtract = [...new Set([...syntheticSections, ...identifiedSections.sections])];
    
    // Second pass: Extract content for each section
    const sectionResults = await this.extractSectionContents(content, title, allSectionsToExtract, userBackground, isQuickAnalysis);

    // Build intelligent section order: synthetic sections first, then paper's natural order
    const sectionOrder: string[] = [];
    const extractedSectionNames = Object.keys(sectionResults);
    
    // 1. Add synthetic sections first (in our preferred order)
    for (const syntheticSection of syntheticSections) {
      if (extractedSectionNames.includes(syntheticSection)) {
        sectionOrder.push(syntheticSection);
      }
    }
    
    // 2. Add paper's natural sections in the order they appear in the paper
    for (const paperSection of identifiedSections.order) {
      if (extractedSectionNames.includes(paperSection) && !sectionOrder.includes(paperSection)) {
        sectionOrder.push(paperSection);
      }
    }
    
    // 3. Add any remaining sections that weren't captured above
    for (const sectionName of extractedSectionNames) {
      if (!sectionOrder.includes(sectionName)) {
        sectionOrder.push(sectionName);
      }
    }

    return {
      sections: sectionResults,
      extractionInfo: {
        totalSections: Object.keys(sectionResults).length,
        extractionMethod: isQuickAnalysis ? 'ai_quick_two_pass' : 'ai_comprehensive_two_pass',
        extractedAt: new Date().toISOString(),
        contentType: 'research_paper',
        sectionOrder: sectionOrder
      }
    };
  }

  /**
   * First pass: Identify all sections present in the paper with their order
   */
  private static async identifySections(
    content: string, 
    title: string, 
    userBackground?: string, 
    isQuickAnalysis: boolean = false
  ): Promise<{ sections: string[]; order: string[] }> {
    const systemPrompt = `You are an expert at identifying academic paper sections. Analyze the content and identify ALL section headers present in the paper in the order they appear.

Look for explicit section headers like:
- Abstract, Introduction, Methods, Results, Discussion, Conclusion
- Background, Methodology, Findings, Implications, Limitations
- Literature Review, Related Work, Experimental Setup
- Numbered sections (1. Introduction, 2. Methods, etc.)
- Non-standard sections like "Significance Statement", "Author Contributions", "Data Availability"
- Any other clear section divisions as they appear in THIS specific paper

Return a JSON object with:
- "sections": array of section names found in the paper (in order of appearance)
- "order": the same array (for consistency)

Do NOT include synthetic sections like "TL;DR" or "Key Insights" - only actual sections from the paper.
Preserve the exact section names and order as they appear in the paper.

Example: 
{
  "sections": ["Abstract", "Significance Statement", "Introduction", "Results", "Discussion", "Materials and Methods", "Acknowledgments", "References"],
  "order": ["Abstract", "Significance Statement", "Introduction", "Results", "Discussion", "Materials and Methods", "Acknowledgments", "References"]
}`;

    const userPrompt = `Identify all section headers in this research paper IN THE ORDER THEY APPEAR:

**Title:** ${title}

**Content (first 50,000 characters):**
${content.substring(0, 50000)}${content.length > 50000 ? '...\n\n[Content continues...]' : ''}

Return a JSON object with the sections array in the order they appear in the paper.`;

    const response = await GroqService.generateTextFromPrompt(
      userPrompt,
      systemPrompt,
      {
        model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
        temperature: 0.1,
        maxTokens: 2000,
        topP: 0.9
      }
    );

    if (!response.success || !response.content) {
      console.warn('Failed to identify sections, using fallback');
      return { sections: [], order: [] };
    }

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const sections = parsed.sections || parsed.order || [];
        const order = parsed.order || parsed.sections || [];
        
        if (Array.isArray(sections) && Array.isArray(order)) {
          return { 
            sections: sections.filter(s => typeof s === 'string'), 
            order: order.filter(s => typeof s === 'string') 
          };
        }
      }
    } catch (error) {
      console.warn('Failed to parse section identification response');
    }

    return { sections: [], order: [] };
  }

  /**
   * Second pass: Extract content for each identified section
   */
  private static async extractSectionContents(
    content: string, 
    title: string, 
    sectionsToExtract: string[],
    userBackground?: string, 
    isQuickAnalysis: boolean = false
  ): Promise<Record<string, { summary: string; fullText: string }>> {
    // For very large content, use chunking approach
    if (content.length > 100000) {
      return this.extractSectionContentsWithChunking(content, title, sectionsToExtract, userBackground, isQuickAnalysis);
    }
    
    const systemPrompt = this.createSectionExtractionSystemPrompt(userBackground, isQuickAnalysis);
    const userPrompt = this.createSectionExtractionUserPrompt(content, title, sectionsToExtract, userBackground, isQuickAnalysis);

    const response = await GroqService.generateTextFromPrompt(
      userPrompt,
      systemPrompt,
      {
        model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
        temperature: isQuickAnalysis ? 0.3 : 0.2,
        maxTokens: 120000, // Increased to use full token window
        topP: 0.9
      }
    );

    if (!response.success || !response.content) {
      throw new Error(response.error || 'Failed to extract sections');
    }

    const sections = this.parseSectionResponse(response.content);
    
    return sections;
  }

  /**
   * Extract section contents using intelligent chunking for very large papers
   */
  private static async extractSectionContentsWithChunking(
    content: string, 
    title: string, 
    sectionsToExtract: string[],
    userBackground?: string, 
    isQuickAnalysis: boolean = false
  ): Promise<Record<string, { summary: string; fullText: string }>> {
    console.log(`🔄 Using chunking approach for large content (${content.length} chars)`);
    
    // Create intelligent chunks based on section boundaries
    const chunks = this.createIntelligentChunks(content, 80000); // 80k char chunks
    console.log(`📄 Created ${chunks.length} intelligent chunks`);
    
    const allSections: Record<string, { summary: string; fullText: string }> = {};
    
    // Process each chunk to extract sections
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`🔄 Processing chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);
      
      const systemPrompt = this.createSectionExtractionSystemPrompt(userBackground, isQuickAnalysis);
      const userPrompt = `Please extract and analyze the following sections from this research paper chunk:

**Title:** ${title}
**Chunk:** ${i + 1}/${chunks.length}
**Sections to Extract:** ${sectionsToExtract.join(', ')}
${userBackground ? `**User Background:** ${userBackground} - Please adapt your explanations accordingly.` : ''}

**Content:**
${chunk}

Please provide your analysis in the following JSON format:

{
  "sections": {
    "SectionName": {
      "summary": "Brief description of what this section contains",
      "fullText": "Complete section content - for synthetic sections, provide original analysis; for traditional sections, extract and clean existing content"
    }
  }
}

**Important Notes:**
- Only extract sections that are actually present in this chunk
- For synthetic sections (TL;DR, Key Insights, What's Next), analyze the content in this chunk
- For traditional sections, extract the complete content if the section is present
- If a section is not found in this chunk, do not include it in the response
- Provide substantial, detailed content rather than generic placeholder text

Ensure every section provides value and insight, not just generic text.`;

      const response = await GroqService.generateTextFromPrompt(
        userPrompt,
        systemPrompt,
        {
          model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
          temperature: isQuickAnalysis ? 0.3 : 0.2,
          maxTokens: 100000,
          topP: 0.9
        }
      );

      if (response.success && response.content) {
        const chunkSections = this.parseSectionResponse(response.content);
        
        // Merge sections from this chunk
        for (const [sectionName, sectionData] of Object.entries(chunkSections)) {
          if (sectionData.fullText && sectionData.fullText.trim().length > 0) {
            if (allSections[sectionName]) {
              // Merge with existing section (combine content)
              allSections[sectionName].fullText += '\n\n' + sectionData.fullText;
              allSections[sectionName].summary = sectionData.summary || allSections[sectionName].summary;
            } else {
              // New section
              allSections[sectionName] = sectionData;
            }
          }
        }
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`✅ Chunking extraction completed: ${Object.keys(allSections).length} sections found`);
    return allSections;
  }

  /**
   * Create intelligent chunks that try to preserve section boundaries
   */
  private static createIntelligentChunks(content: string, maxChunkSize: number): string[] {
    const chunks: string[] = [];
    
    // Try to split on section boundaries first
    const sectionBoundaries = [
      /\n\s*(?:abstract|introduction|methods?|methodology|results?|discussion|conclusion|references|acknowledgments?)\s*\n/gi,
      /\n\s*\d+\.?\s*(?:abstract|introduction|methods?|methodology|results?|discussion|conclusion|references|acknowledgments?)\s*\n/gi,
      /\n\s*[IVX]+\.?\s*(?:abstract|introduction|methods?|methodology|results?|discussion|conclusion|references|acknowledgments?)\s*\n/gi
    ];
    
    let remainingContent = content;
    
    while (remainingContent.length > 0) {
      if (remainingContent.length <= maxChunkSize) {
        // Last chunk
        chunks.push(remainingContent);
        break;
      }
      
      // Find the best split point
      let splitPoint = maxChunkSize;
      let foundBoundary = false;
      
      // Look for section boundaries within the chunk
      for (const boundary of sectionBoundaries) {
        const matches = Array.from(remainingContent.substring(0, maxChunkSize).matchAll(boundary));
        if (matches.length > 0) {
          const lastMatch = matches[matches.length - 1];
          if (lastMatch.index && lastMatch.index > maxChunkSize * 0.3) { // Don't split too early
            splitPoint = lastMatch.index;
            foundBoundary = true;
            break;
          }
        }
      }
      
      // If no section boundary found, split at paragraph or sentence
      if (!foundBoundary) {
        const paragraphSplit = remainingContent.substring(0, maxChunkSize).lastIndexOf('\n\n');
        const sentenceSplit = remainingContent.substring(0, maxChunkSize).lastIndexOf('. ');
        
        if (paragraphSplit > maxChunkSize * 0.7) {
          splitPoint = paragraphSplit + 2;
        } else if (sentenceSplit > maxChunkSize * 0.7) {
          splitPoint = sentenceSplit + 2;
        }
      }
      
      chunks.push(remainingContent.substring(0, splitPoint));
      remainingContent = remainingContent.substring(splitPoint);
    }
    
    return chunks;
  }

  /**
   * Create system prompt for section extraction
   */
  private static createSectionExtractionSystemPrompt(userBackground?: string, isQuickAnalysis: boolean = false): string {
    const backgroundContext = userBackground ? 
      `The user has a background in ${userBackground}. Tailor your explanations accordingly.` :
      'The user has a general academic background.';

    const analysisType = isQuickAnalysis ? 'quick insights' : 'comprehensive analysis';

    return `You are an expert research paper analyst and science communicator. Your task is to extract and analyze sections from academic papers to provide ${analysisType}.

${backgroundContext}

Your analysis should be:
1. Clear and well-structured
2. Accessible to someone with the user's background
3. Focused on key insights and practical implications
4. Accurate and evidence-based
5. Written in a professional yet approachable tone

**CRITICAL for Synthetic Sections:**
- **Key Insights**: Extract SPECIFIC discoveries, not generic statements. Include concrete findings, numbers, percentages, effect sizes, or measurable outcomes. Focus on breakthrough results, unexpected findings, or significant advances.
- **Practical Implications**: Describe HOW this research can be applied, WHAT problems it solves, and WHO would benefit. Be specific about applications and use cases.
- **TL;DR**: Capture the core contribution in one clear sentence with the main finding or breakthrough.

For synthetic sections (TL;DR, Key Insights, What's Next, Practical Implications), create original analysis based on the paper's content.
For traditional sections (Abstract, Introduction, etc.), extract and clean the existing content.

**Avoid generic placeholder text at all costs.** Every insight should be specific to THIS paper's findings.

Always structure your response as valid JSON with the required fields.`;
  }

  /**
   * Create user prompt for section extraction
   */
  private static createSectionExtractionUserPrompt(
    content: string, 
    title: string, 
    sectionsToExtract: string[],
    userBackground?: string,
    isQuickAnalysis: boolean = false
  ): string {
    const backgroundNote = userBackground ? 
      `\n**User Background:** ${userBackground} - Please adapt your explanations accordingly.` :
      '';

    // Increased content limits to utilize full token window
    const contentLimit = isQuickAnalysis ? 30000 : 80000; // Much larger limits
    const truncatedContent = content.substring(0, contentLimit);
    const wasTruncated = content.length > contentLimit;

    // Separate synthetic and natural sections for clearer instructions
    const syntheticSections = ['TL;DR', 'Key Insights', 'Practical Implications', 'What\'s Next', 'Future Work', 'Conflict of Interest'];
    const naturalSections = sectionsToExtract.filter(section => !syntheticSections.includes(section));

    return `Please extract and analyze the following sections from this research paper:

**Title:** ${title}${backgroundNote}
**Sections to Extract:** ${sectionsToExtract.join(', ')}

**Content:**
${truncatedContent}${wasTruncated ? '...\n\n[Content truncated for length - this is a large paper with more content available]' : ''}

Please provide your analysis in the following JSON format:

{
  "sections": {
    "SectionName": {
      "summary": "Brief description of what this section contains",
      "fullText": "Complete section content - see guidelines below"
    }
  }
}

**Section Guidelines:**

**Synthetic Sections (AI-Generated Analysis):**
${syntheticSections.filter(s => sectionsToExtract.includes(s)).map(section => {
  switch(section) {
    case 'TL;DR': return '- **TL;DR**: One clear sentence summarizing the main finding/contribution';
    case 'Key Insights': return '- **Key Insights**: 3-5 specific, actionable bullet points highlighting the most important discoveries, breakthrough findings, or surprising results. Focus on WHAT was discovered, not just that discoveries were made. Include specific numbers, percentages, or concrete outcomes when available.';
    case 'Practical Implications': return '- **Practical Implications**: Real-world applications and impact - how this research could be used, what problems it solves, who would benefit';
    case 'What\'s Next': return '- **What\'s Next**: Future research directions and next steps - specific areas for follow-up research or development';
    case 'Future Work': return '- **Future Work**: Specific future research recommendations and open questions';
    case 'Conflict of Interest': return '- **Conflict of Interest**: Look for disclosure statements or note if none found';
    default: return `- **${section}**: Provide relevant analysis`;
  }
}).join('\n')}

**Natural Paper Sections (Extract and Clean):**
${naturalSections.length > 0 ? naturalSections.map(section => `- **${section}**: Extract the actual content from the paper, clean for readability`).join('\n') : '(None in this request)'}

**Quality Requirements:**
- Make all content accessible and well-formatted for screen readers
- Remove citations and OCR artifacts from natural sections
- Use clear, flowing language
- Include specific findings and numbers when available
- Adapt explanations to the user's background level
- For synthetic sections, provide substantial, detailed analysis rather than generic placeholder text
- For natural sections, extract complete content - don't summarize or truncate

**CRITICAL: Avoid Generic Placeholder Content**
- Never use phrases like "described in the paper" or "discussed in the paper"
- Always provide specific, detailed content
- For synthetic sections, analyze the actual research content and provide meaningful insights
- For natural sections, extract the actual text content, not summaries

**BAD Key Insights Examples (DO NOT DO THIS):**
- "Key findings and discoveries about the research topic"
- "Important results were found in the study"
- "The paper presents significant findings"
- "Several insights were discovered"

**GOOD Key Insights Examples:**
- "T4-AAV hybrid vector delivered 170kb of DNA payload, 40,000x more efficient than T4 alone"
- "Complete protection achieved against pneumonic plague in 100% of mice (n=20)"
- "Novel avidin-biotin cross-bridge attachment method enables 25nm AAV to piggyback on 120nm T4 capsid"

Ensure every section provides value and insight, not just generic text.`;
  }

     /**
    * Parse the AI response to extract sections
    */
   private static parseSectionResponse(content: string): Record<string, { summary: string; fullText: string }> {
     try {
       // Try to extract JSON from the response
       const jsonMatch = content.match(/\{[\s\S]*\}/);
       if (!jsonMatch) {
         console.error('No JSON found in response');
         return {};
       }

       const parsed = JSON.parse(jsonMatch[0]);
       const sections = parsed.sections || {};
       
       // Validate and clean each section
       const cleanedSections: Record<string, { summary: string; fullText: string }> = {};
       for (const [sectionName, sectionData] of Object.entries(sections)) {
         if (sectionData && typeof sectionData === 'object') {
           const data = sectionData as any;
           cleanedSections[sectionName] = {
             summary: typeof data.summary === 'string' ? data.summary : '',
             fullText: typeof data.fullText === 'string' ? data.fullText : ''
           };
         }
       }
       
       return cleanedSections;
     } catch (error) {
       console.error('Failed to parse section response:', error);
       console.error('Response content:', content.substring(0, 500) + '...');
       return {};
     }
   }

  /**
   * Check if the content appears to be a research paper
   */
  private static isResearchPaper(text: string, title: string, metadata: any): boolean {
    const content = (text + ' ' + title).toLowerCase();
    
    // Check for common research paper indicators
    const researchIndicators = [
      'abstract', 'introduction', 'methodology', 'methods', 'results', 'discussion', 'conclusion',
      'references', 'bibliography', 'doi:', 'arxiv', 'journal', 'volume', 'issue',
      'hypothesis', 'experiment', 'analysis', 'study', 'research', 'findings',
      'p <', 'p=', 'significance', 'correlation', 'regression', 'statistical'
    ];
    
    const foundIndicators = researchIndicators.filter(indicator => 
      content.includes(indicator)
    );
    
    // Also check metadata for academic indicators
    const hasAcademicMetadata = metadata?.doi || metadata?.pmid || metadata?.arxiv || 
                               metadata?.journal || metadata?.authors?.length > 0;
    
    // Need at least 3 indicators or strong metadata evidence
    return foundIndicators.length >= 3 || hasAcademicMetadata;
  }

  /**
   * Extract key findings from sections
   */
  private static extractKeyFindings(sections: Record<string, any>): string[] {
    const findings: string[] = [];
    
         // Extract from Key Insights section first
     if (sections['Key Insights']?.fullText) {
       const insights = sections['Key Insights'].fullText;
       if (typeof insights === 'string') {
         const bulletPoints = insights.match(/[•\-\*]\s*([^\n]+)/g);
         if (bulletPoints) {
           findings.push(...bulletPoints.map((point: string) => point.replace(/[•\-\*]\s*/, '').trim()));
         }
       }
     }
     
     // Extract from Results section
     if (sections.Results?.fullText) {
       const resultText = sections.Results.fullText;
       const sentences = resultText.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
       const keyResults = sentences.filter((s: string) => 
         /\b(found|discovered|showed|demonstrated|revealed|indicates|suggests|significant)\b/i.test(s)
       );
       findings.push(...keyResults.slice(0, 3));
     }
    
    return findings.slice(0, 5); // Limit to top 5 findings
  }

  /**
   * Extract methodology information
   */
  private static extractMethodology(sections: Record<string, any>): string {
    if (sections.Methods?.fullText) {
      return sections.Methods.fullText;
    }
    if (sections.Methodology?.fullText) {
      return sections.Methodology.fullText;
    }
    return 'Methodology not clearly described in the paper.';
  }

  /**
   * Extract significance from sections
   */
  private static extractSignificance(sections: Record<string, any>): string {
    // First check Discussion section for significance statements
    if (sections.Discussion?.fullText) {
      const discussion = sections.Discussion.fullText;
      const sentences = discussion.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
      
      // Look for multiple patterns of significance
      const significancePatterns = [
        /\b(significant|important|implications|impact|contribution|crucial|vital|essential|breakthrough|novel|innovative)\b/i,
        /\b(demonstrates|shows|reveals|indicates|suggests|establishes|proves|confirms)\b/i,
        /\b(advance|advancement|progress|improvement|enhancement|development)\b/i
      ];
      
      for (const pattern of significancePatterns) {
        const significanceText = sentences.find((s: string) => pattern.test(s));
        if (significanceText && significanceText.length > 30) {
          return significanceText.trim();
        }
      }
    }
    
    // Check Conclusion section
    if (sections.Conclusion?.fullText) {
      const conclusion = sections.Conclusion.fullText;
      const sentences = conclusion.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
      const significanceText = sentences.find((s: string) => 
        /\b(significant|important|contribution|impact|advance|demonstrates|shows)\b/i.test(s)
      );
      if (significanceText && significanceText.length > 30) {
        return significanceText.trim();
      }
    }
    
    // Check Abstract for significance
    if (sections.Abstract?.fullText) {
      const abstract = sections.Abstract.fullText;
      const sentences = abstract.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
      const significanceText = sentences.find((s: string) => 
        /\b(significant|important|novel|demonstrates|shows|reveals)\b/i.test(s)
      );
      if (significanceText && significanceText.length > 30) {
        return significanceText.trim();
      }
    }
    
    // Check Key Insights section
    if (sections['Key Insights']?.fullText) {
      const insights = sections['Key Insights'].fullText;
      if (insights.length > 50) {
        return insights;
      }
    }
    
    // Check Introduction for significance statements
    if (sections.Introduction?.fullText) {
      const introduction = sections.Introduction.fullText;
      const sentences = introduction.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
      const significanceText = sentences.find((s: string) => 
        /\b(significant|important|contribution|advance|novel|innovative)\b/i.test(s)
      );
      if (significanceText && significanceText.length > 30) {
        return significanceText.trim();
      }
    }
    
    // Last resort: check Results section
    if (sections.Results?.fullText) {
      const results = sections.Results.fullText;
      const sentences = results.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
      const significanceText = sentences.find((s: string) => 
        /\b(significant|important|demonstrates|shows|reveals)\b/i.test(s)
      );
      if (significanceText && significanceText.length > 30) {
        return significanceText.trim();
      }
    }
    
    // Final fallback - only if no content found anywhere
    return 'This research contributes to the field by presenting new findings and analysis.';
  }

  /**
   * Extract limitations from sections
   */
  private static extractLimitations(sections: Record<string, any>): string {
    const limitationKeywords = ['limitation', 'constraint', 'weakness', 'shortcoming', 'drawback', 'restrict', 'limit', 'challenge', 'issue', 'problem'];
    
    // Check all sections for limitation content
    for (const [sectionName, sectionData] of Object.entries(sections)) {
      if (sectionData.fullText) {
        const text = sectionData.fullText.toLowerCase();
        if (limitationKeywords.some(keyword => text.includes(keyword))) {
          const sentences = sectionData.fullText.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
          const limitationSentence = sentences.find((s: string) => 
            limitationKeywords.some(keyword => s.toLowerCase().includes(keyword))
          );
          if (limitationSentence && limitationSentence.length > 30) {
            return limitationSentence.trim();
          }
        }
      }
    }
    
    // Check Discussion section more thoroughly
    if (sections.Discussion?.fullText) {
      const discussion = sections.Discussion.fullText;
      const sentences = discussion.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
      
      // Look for common limitation phrases
      const limitationPhrases = [
        /\b(however|although|despite|while|but|nevertheless|nonetheless)\b/i,
        /\b(cannot|unable|difficult|challenging|hard|impossible)\b/i,
        /\b(small sample|limited data|preliminary|initial|pilot)\b/i
      ];
      
      for (const phrase of limitationPhrases) {
        const limitationText = sentences.find((s: string) => phrase.test(s));
        if (limitationText && limitationText.length > 30) {
          return limitationText.trim();
        }
      }
    }
    
    // Check Conclusion section for limitations
    if (sections.Conclusion?.fullText) {
      const conclusion = sections.Conclusion.fullText;
      const sentences = conclusion.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
      const limitationText = sentences.find((s: string) => 
        limitationKeywords.some(keyword => s.toLowerCase().includes(keyword))
      );
      if (limitationText && limitationText.length > 30) {
        return limitationText.trim();
      }
    }
    
    return 'The study acknowledges certain methodological and scope limitations that should be considered when interpreting the results.';
  }

  /**
   * Extract future work from sections
   */
  private static extractFutureWork(sections: Record<string, any>): string {
    // Check What's Next section first
    if (sections['What\'s Next']?.fullText) {
      const nextSteps = sections['What\'s Next'].fullText;
      if (nextSteps.length > 50) {
        return nextSteps;
      }
    }
    
    const futureKeywords = ['future', 'next', 'further', 'additional', 'continue', 'extend', 'expand', 'explore', 'investigate', 'develop', 'improve', 'enhance'];
    
    // Check Conclusion section first (most likely to contain future work)
    if (sections.Conclusion?.fullText) {
      const conclusion = sections.Conclusion.fullText;
      const sentences = conclusion.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
      const futureWork = sentences.find((s: string) => 
        futureKeywords.some(keyword => s.toLowerCase().includes(keyword))
      );
      if (futureWork && futureWork.length > 30) {
        return futureWork.trim();
      }
    }
    
    // Check Discussion section
    if (sections.Discussion?.fullText) {
      const discussion = sections.Discussion.fullText;
      const sentences = discussion.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
      const futureWork = sentences.find((s: string) => 
        futureKeywords.some(keyword => s.toLowerCase().includes(keyword))
      );
      if (futureWork && futureWork.length > 30) {
        return futureWork.trim();
      }
    }
    
    // Check other sections
    for (const [sectionName, sectionData] of Object.entries(sections)) {
      if (sectionData.fullText && !['Conclusion', 'Discussion'].includes(sectionName)) {
        const sentences = sectionData.fullText.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
        const futureWork = sentences.find((s: string) => 
          futureKeywords.some(keyword => s.toLowerCase().includes(keyword))
        );
        if (futureWork && futureWork.length > 30) {
          return futureWork.trim();
        }
      }
    }
    
    return 'The authors suggest several promising directions for extending this work and addressing remaining challenges.';
  }

  /**
   * Extract practical implications
   */
  private static extractPracticalImplications(sections: Record<string, any>): string {
    const implicationKeywords = ['implication', 'application', 'practical', 'real-world', 'implement', 'deploy', 'use', 'apply', 'benefit', 'impact', 'utility', 'value'];
    
    // Check Conclusion section first
    if (sections.Conclusion?.fullText) {
      const conclusion = sections.Conclusion.fullText;
      const sentences = conclusion.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
      const implication = sentences.find((s: string) => 
        implicationKeywords.some(keyword => s.toLowerCase().includes(keyword))
      );
      if (implication && implication.length > 30) {
        return implication.trim();
      }
    }
    
    // Check Discussion section
    if (sections.Discussion?.fullText) {
      const discussion = sections.Discussion.fullText;
      const sentences = discussion.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
      const implication = sentences.find((s: string) => 
        implicationKeywords.some(keyword => s.toLowerCase().includes(keyword))
      );
      if (implication && implication.length > 30) {
        return implication.trim();
      }
    }
    
    // Check Introduction for practical context
    if (sections.Introduction?.fullText) {
      const introduction = sections.Introduction.fullText;
      const sentences = introduction.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
      const implication = sentences.find((s: string) => 
        implicationKeywords.some(keyword => s.toLowerCase().includes(keyword))
      );
      if (implication && implication.length > 30) {
        return implication.trim();
      }
    }
    
    // Check all other sections
    for (const [sectionName, sectionData] of Object.entries(sections)) {
      if (sectionData.fullText && !['Conclusion', 'Discussion', 'Introduction'].includes(sectionName)) {
        const sentences = sectionData.fullText.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
        const implication = sentences.find((s: string) => 
          implicationKeywords.some(keyword => s.toLowerCase().includes(keyword))
        );
        if (implication && implication.length > 30) {
          return implication.trim();
        }
      }
    }
    
    return 'This research has potential applications in relevant domains and could inform future development efforts.';
  }

   /**
    * Extract sample size information
    */
   private static extractSampleSize(text: string): string {
     const samplePatterns = [
       /(\d+)\s+(participants|subjects|patients|individuals)/i,
       /sample\s+size\s+of\s+(\d+)/i,
       /n\s*=\s*(\d+)/i
     ];
     
     for (const pattern of samplePatterns) {
       const match = text.match(pattern);
       if (match) {
         return match[0];
       }
     }
     
     return 'Sample size not clearly specified';
   }

   /**
    * Extract data collection methods
    */
   private static extractDataCollection(text: string): string {
     const methods: string[] = [];
     const methodPatterns = [
       /survey/i, /questionnaire/i, /interview/i, /observation/i,
       /experiment/i, /database/i, /registry/i, /clinical trial/i
     ];
     
     methodPatterns.forEach(pattern => {
       if (pattern.test(text)) {
         methods.push(pattern.source.replace(/[/\\^$*+?.()|[\]{}]/g, '').replace(/i$/, ''));
       }
     });
     
     return methods.length > 0 ? methods.join(', ') : 'Data collection methods described in paper';
   }

   /**
    * Extract analysis approach
    */
   private static extractAnalysisApproach(text: string): string {
     const approaches: string[] = [];
     const approachPatterns = [
       /statistical analysis/i, /regression/i, /correlation/i, /anova/i,
       /machine learning/i, /deep learning/i, /neural network/i, /qualitative analysis/i
     ];
     
     approachPatterns.forEach(pattern => {
       if (pattern.test(text)) {
         approaches.push(pattern.source.replace(/[/\\^$*+?.()|[\]{}]/g, '').replace(/i$/, ''));
       }
     });
     
     return approaches.length > 0 ? approaches.join(', ') : 'Analysis approach described in paper';
   }

  /**
   * Assess readability of the content
   */
  private static assessReadability(text: string): 'Easy' | 'Medium' | 'Hard' {
    const avgWordsPerSentence = this.calculateAverageWordsPerSentence(text);
    const technicalTerms = this.countTechnicalTerms(text);
    
    if (avgWordsPerSentence < 15 && technicalTerms < 10) return 'Easy';
    if (avgWordsPerSentence < 25 && technicalTerms < 25) return 'Medium';
    return 'Hard';
  }

  /**
   * Calculate average words per sentence
   */
  private static calculateAverageWordsPerSentence(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const totalWords = text.split(/\s+/).filter(w => w.length > 0).length;
    return sentences.length > 0 ? totalWords / sentences.length : 0;
  }

  /**
   * Count technical terms in text
   */
  private static countTechnicalTerms(text: string): number {
    const technicalPatterns = [
      /\b\w+ology\b/gi, /\b\w+ism\b/gi, /\b\w+tion\b/gi,
      /\bp\s*[<>=]\s*0\.\d+/gi, /\b\w*stat\w*\b/gi, /\b\w*analys\w*\b/gi
    ];
    
    let count = 0;
    technicalPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) count += matches.length;
    });
    
    return count;
  }

     /**
    * Get recommended audience based on content and user background
    */
   private static getRecommendedAudience(userBackground?: string, sections?: Record<string, any>): string[] {
     const audience = ['Researchers', 'Academics'];
     
     if (userBackground) {
       audience.push(`${userBackground} professionals`);
     }
     
     // Add more specific audiences based on content
     if (sections?.Methods?.fullText?.toLowerCase().includes('clinical')) {
       audience.push('Healthcare professionals');
     }
     
     if (sections?.Results?.fullText?.toLowerCase().includes('statistical')) {
       audience.push('Data scientists');
     }
     
     return audience;
   }

   /**
    * Generate TL;DR if not already present
    */
   private static generateTLDR(sections: Record<string, any>): string {
     // Try to extract from abstract first
     if (sections.Abstract?.fullText) {
       const sentences = sections.Abstract.fullText.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
       if (sentences.length > 0) {
         return sentences[0].trim() + '.';
       }
     }
     
     // Fallback to a generic TL;DR
     return 'This research paper presents findings and analysis on the given topic.';
   }

   /**
    * Extract key insights from sections
    */
   private static extractKeyInsights(sections: Record<string, any>): string[] {
     const insights: string[] = [];
     
     // Extract from Key Insights section if available
     if (sections['Key Insights']?.fullText) {
       const text = sections['Key Insights'].fullText;
       if (typeof text === 'string') {
         const bulletPoints = text.match(/[•\-\*]\s*([^\n]+)/g);
         if (bulletPoints) {
           insights.push(...bulletPoints.map((point: string) => point.replace(/[•\-\*]\s*/, '').trim()));
         }
       }
     }
     
     // If no Key Insights section, extract from key findings
     if (insights.length === 0) {
       const keyFindings = this.extractKeyFindings(sections);
       insights.push(...keyFindings.slice(0, 3));
     }
     
     return insights.slice(0, 3); // Limit to top 3 insights
   }

   /**
    * Extract why it matters from sections
    */
   private static extractWhyItMatters(sections: Record<string, any>): string {
     // Check for significance or discussion sections
     if (sections.Discussion?.fullText) {
       const discussion = sections.Discussion.fullText;
       const sentences = discussion.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
       
       // Look for multiple importance patterns
       const importancePatterns = [
         /\b(important|significant|crucial|vital|essential|critical|key|fundamental)\b/i,
         /\b(impact|implications|consequences|effects|influence|affects)\b/i,
         /\b(matters|relevant|valuable|useful|beneficial|advantageous)\b/i,
         /\b(contributes|advances|improves|enhances|enables|facilitates)\b/i
       ];
       
       for (const pattern of importancePatterns) {
         const importantSentence = sentences.find((s: string) => pattern.test(s));
         if (importantSentence && importantSentence.length > 30) {
           return importantSentence.trim();
         }
       }
     }
     
     // Check Abstract for importance statements
     if (sections.Abstract?.fullText) {
       const abstract = sections.Abstract.fullText;
       const sentences = abstract.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
       const importantSentence = sentences.find((s: string) => 
         /\b(important|significant|crucial|impact|implications|contributes|advances)\b/i.test(s)
       );
       if (importantSentence && importantSentence.length > 30) {
         return importantSentence.trim();
       }
     }
     
     // Check Introduction for motivation/importance
     if (sections.Introduction?.fullText) {
       const introduction = sections.Introduction.fullText;
       const sentences = introduction.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
       const importantSentence = sentences.find((s: string) => 
         /\b(important|significant|crucial|essential|critical|impact|implications|matters)\b/i.test(s)
       );
       if (importantSentence && importantSentence.length > 30) {
         return importantSentence.trim();
       }
     }
     
     // Check Conclusion for impact statements
     if (sections.Conclusion?.fullText) {
       const conclusion = sections.Conclusion.fullText;
       const sentences = conclusion.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
       const importantSentence = sentences.find((s: string) => 
         /\b(important|significant|impact|implications|contributes|advances|enables)\b/i.test(s)
       );
       if (importantSentence && importantSentence.length > 30) {
         return importantSentence.trim();
       }
     }
     
     // Try to use the extractSignificance method as fallback
     const significance = this.extractSignificance(sections);
     if (significance && significance.length > 50 && !significance.includes('contributes to the field')) {
       return significance;
     }
     
     // Final fallback with more specific language
     return 'This research addresses important challenges in the field and provides valuable insights for future work.';
   }

   /**
    * Extract practical takeaways from sections
    */
   private static extractPracticalTakeaways(sections: Record<string, any>): string[] {
     const takeaways: string[] = [];
     
     // Extract from Key Insights or practical implications
     if (sections['Key Insights']?.fullText) {
       const text = sections['Key Insights'].fullText;
       if (typeof text === 'string') {
         const bulletPoints = text.match(/[•\-\*]\s*([^\n]+)/g);
         if (bulletPoints) {
           takeaways.push(...bulletPoints.map((point: string) => point.replace(/[•\-\*]\s*/, '').trim()));
         }
       }
     }
     
     // Extract from conclusion or discussion
     if (takeaways.length === 0 && sections.Conclusion?.fullText) {
       const conclusion = sections.Conclusion.fullText;
       const sentences = conclusion.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
       const practicalSentences = sentences.filter((s: string) => 
         /\b(practical|application|use|implement|apply|benefit)\b/i.test(s)
       );
       takeaways.push(...practicalSentences.slice(0, 2));
     }
     
     return takeaways.slice(0, 2); // Limit to top 2 takeaways
   }

   /**
    * Extract next steps from sections
    */
   private static extractNextSteps(sections: Record<string, any>): string {
     // Check What's Next section first
     if (sections['What\'s Next']?.fullText) {
       return sections['What\'s Next'].fullText;
     }
     
     // Extract from future work
     return this.extractFutureWork(sections);
   }

   /**
    * Validate the completeness and quality of the analysis
    */
   private static validateAnalysis(analysis: ResearchPaperAnalysis): ResearchPaperValidationResult {
     const issues: string[] = [];
     
     // Check for required fields
     if (!analysis.title || analysis.title.trim().length === 0) {
       issues.push('Missing title');
     }
     
     if (!analysis.tldr || analysis.tldr.trim().length < 20) {
       issues.push('TL;DR is too short or missing');
     }
     
     if (!analysis.keyInsights || analysis.keyInsights.length === 0) {
       issues.push('Missing key insights');
     }
     
     if (!analysis.sections || Object.keys(analysis.sections).length === 0) {
       issues.push('No sections extracted');
     }
     
     // Check for quality indicators
     if (analysis.keyFindings && analysis.keyFindings.length === 0) {
       issues.push('No key findings identified');
     }
     
     if (analysis.methodology && analysis.methodology.length < 50) {
       issues.push('Methodology description is too brief');
     }
     
     // Check for generic/placeholder content
     const genericPhrases = [
       'described in the paper',
       'discussed in the paper',
       'outlined in the paper',
       'not clearly specified',
       'not clearly described'
     ];
     
     const hasGenericContent = [
       analysis.significance,
       analysis.limitations,
       analysis.practicalImplications,
       analysis.futureWork
     ].some(field => 
       field && genericPhrases.some(phrase => field.toLowerCase().includes(phrase.toLowerCase()))
     );
     
     if (hasGenericContent) {
       issues.push('Analysis contains generic placeholder content');
     }
     
     // Return validation result
     if (issues.length === 0) {
       return { isValid: true };
     } else {
       return { 
         isValid: false, 
         message: `Analysis validation issues: ${issues.join(', ')}` 
       };
     }
   }
 } 