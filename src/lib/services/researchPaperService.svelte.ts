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

      // Extract sections from the content using the new iterative approach
      const sectionResult = await this.extractSections(text, title, userBackground, isQuickAnalysis);
      
      if (!sectionResult.sections || Object.keys(sectionResult.sections).length === 0) {
        return {
          success: false,
          error: 'Could not extract meaningful sections from the research paper'
        };
      }

      // Build the analysis object with both comprehensive and quick fields
      const analysis: ResearchPaperAnalysis = {
        title: title,
        authors: metadata.citations?.authors || (metadata.author ? [metadata.author] : []),
        abstract: sectionResult.sections.Abstract?.fullText || sectionResult.sections['TL;DR']?.fullText || '',
        
        // Comprehensive analysis fields - now handled by LLM sections
        keyFindings: sectionResult.sections['Key Insights']?.fullText ? [sectionResult.sections['Key Insights'].fullText] : [],
        methodology: sectionResult.sections.Methods?.fullText || sectionResult.sections.Methodology?.fullText || '',
        significance: sectionResult.sections['Key Insights']?.fullText || '',
        limitations: sectionResult.sections.Limitations?.fullText || '',
        futureWork: sectionResult.sections['What\'s Next']?.fullText || sectionResult.sections['Future Work']?.fullText || '',
        practicalImplications: sectionResult.sections['Practical Implications']?.fullText || '',
        
        // Quick analysis fields (always include for better UX)
        tldr: sectionResult.sections['TL;DR']?.fullText || '',
        keyInsights: sectionResult.sections['Key Insights']?.fullText ? [sectionResult.sections['Key Insights'].fullText] : [],
        whyItMatters: sectionResult.sections['Key Insights']?.fullText || '',
        practicalTakeaways: sectionResult.sections['Practical Implications']?.fullText ? [sectionResult.sections['Practical Implications'].fullText] : [],
        nextSteps: sectionResult.sections['What\'s Next']?.fullText || '',
        
        // Metadata
        isQuickAnalysis: isQuickAnalysis,
        
        // Section data
        sections: sectionResult.sections,
        
        // Extraction metadata
        extractedAt: new Date().toISOString(),
        extractionMethod: isQuickAnalysis ? 'quick_ai_analysis_iterative' : 'comprehensive_ai_analysis_iterative',
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
   * Extract a single section on demand for lazy loading
   */
  static async extractSingleSectionOnDemand(
    tabData: TabData,
    sectionName: string,
    userBackground?: string
  ): Promise<{ success: boolean; section?: { summary: string; fullText: string }; error?: string }> {
    try {
      console.log(`🔍 Extracting single section on demand: ${sectionName}`);

      // Validate settings first
      const validation = this.validateSettings();
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.message
        };
      }

      const { title, text } = tabData.content;
      
      // Define section based on name
      const syntheticSectionNames = ['TL;DR', 'Key Insights', 'Practical Implications', 'What\'s Next', 'Future Work', 'Conflict of Interest', 'Limitations'];
      const isSyntheticSection = syntheticSectionNames.includes(sectionName);
      
      let sectionDef: { name: string; description: string };
      
      if (isSyntheticSection) {
        // Define synthetic section descriptions
        const syntheticDescriptions: Record<string, string> = {
          'TL;DR': 'Create a concise, impactful summary that captures the core breakthrough or main finding. Focus on WHAT was discovered, HOW significant it is, and WHY it matters. Be specific and concrete.',
          'Key Insights': 'Extract 3-5 SPECIFIC, CONCRETE insights that represent genuine breakthroughs or discoveries. Include specific numbers, percentages, measurements, or quantifiable results.',
          'Practical Implications': 'Identify SPECIFIC, REAL-WORLD applications and impacts. Describe exactly HOW this research can be applied in practice and WHO would benefit.',
          'What\'s Next': 'Outline SPECIFIC next steps and future research directions. Include immediate follow-up studies and specific technical challenges.',
          'Future Work': 'Provide detailed future research recommendations including specific experimental designs and technical improvements needed.',
          'Conflict of Interest': 'Look for and extract any conflict of interest statements, funding disclosures, or competing interests. If none are found, state this clearly.',
          'Limitations': 'Identify and describe the study\'s limitations, including methodological constraints, sample size limitations, and generalizability concerns.'
        };
        
        sectionDef = {
          name: sectionName,
          description: syntheticDescriptions[sectionName] || `Generate ${sectionName} section based on the paper content.`
        };
      } else {
        // Natural section from the paper
        sectionDef = {
          name: sectionName,
          description: `Extract the complete "${sectionName}" section from the paper, cleaning for readability while preserving all technical details.`
        };
      }

      // Extract the single section
      const sectionResult = await this.extractSingleSection(
        text,
        title,
        sectionDef,
        userBackground,
        false // Not quick analysis when extracting individual sections
      );

      if (sectionResult && sectionResult.summary && sectionResult.fullText) {
        console.log(`✅ Successfully extracted section: ${sectionName}`);
        return {
          success: true,
          section: sectionResult
        };
      } else {
        return {
          success: false,
          error: `Could not extract meaningful content for section: ${sectionName}`
        };
      }

    } catch (error) {
      console.error(`❌ Error extracting section ${sectionName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error extracting section'
      };
    }
  }

  /**
   * Extract sections from research paper content using iterative AI approach
   * For quick analysis: only identify sections without extracting content
   * For comprehensive analysis: extract each section individually with full context
   */
  private static async extractSections(
    content: string, 
    title: string, 
    userBackground?: string, 
    isQuickAnalysis: boolean = false
  ): Promise<SectionExtractionResult> {
    
    // Define synthetic sections with their instructions
    const syntheticSectionDefinitions = [
      {
        name: 'TL;DR',
        description: 'Create a concise, impactful summary that captures the core breakthrough or main finding. Focus on WHAT was discovered, HOW significant it is, and WHY it matters. Be specific and concrete.'
      },
      {
        name: 'Key Insights',
        description: `Extract 3-5 SPECIFIC, CONCRETE insights that represent genuine breakthroughs or discoveries. Each insight should:
- Include specific numbers, percentages, measurements, or quantifiable results
- Describe actual discoveries, not just that discoveries were made
- Focus on surprising findings, breakthrough results, or significant advances
- Be actionable and meaningful to researchers in the field
- Avoid generic statements like "the study found" or "research shows"`
      },
      {
        name: 'Practical Implications',
        description: `Identify SPECIFIC, REAL-WORLD applications and impacts. Describe:
- Exactly HOW this research can be applied in practice
- WHAT specific problems it solves or addresses
- WHO would benefit and in what contexts
- WHEN and WHERE these applications might be implemented
- Concrete examples of potential use cases or implementations`
      },
      {
        name: 'What\'s Next',
        description: `Outline SPECIFIC next steps and future research directions. Include:
- Immediate follow-up studies that should be conducted
- Specific technical challenges that need to be addressed
- Concrete research questions that remain unanswered
- Potential collaborations or interdisciplinary approaches needed
- Timeline considerations for future work`
      },
      {
        name: 'Conflict of Interest',
        description: 'Look for and extract any conflict of interest statements, funding disclosures, or competing interests. If none are found, state this clearly.'
      }
    ];

    // Add additional sections for comprehensive analysis
    if (!isQuickAnalysis) {
      syntheticSectionDefinitions.push(
        {
          name: 'Future Work',
          description: `Provide detailed future research recommendations including:
- Specific experimental designs for follow-up studies
- Technical improvements or optimizations needed
- Scaling considerations and implementation challenges
- Long-term research goals and milestones`
        },
        {
          name: 'Limitations',
          description: `Identify and describe the study's limitations, including:
- Methodological constraints and potential biases
- Sample size or scope limitations
- Technical or resource constraints
- Generalizability concerns
- Acknowledged weaknesses or areas for improvement`
        }
      );
    }

    // First pass: Identify natural sections in the paper
    const identifiedSections = await this.identifySections(content, title, userBackground, isQuickAnalysis);
    
    // Create section definitions for natural sections
    const naturalSectionDefinitions = identifiedSections.sections.map(sectionName => ({
      name: sectionName,
      description: `Extract the complete "${sectionName}" section from the paper, cleaning for readability while preserving all technical details.`
    }));

    // Combine all section definitions
    const allSectionDefinitions = [...syntheticSectionDefinitions, ...naturalSectionDefinitions];
    
    // For quick analysis, return promise sections without content
    if (isQuickAnalysis) {
      console.log(`📋 Quick analysis: Identifying ${allSectionDefinitions.length} sections as promises`);
      
      const promiseSections: Record<string, { summary: string; fullText: string }> = {};
      
      // Create promise sections for synthetic sections
      for (const sectionDef of syntheticSectionDefinitions) {
        promiseSections[sectionDef.name] = {
          summary: `AI-generated ${sectionDef.name} section`,
          fullText: `[Section not yet extracted - click to expand and generate ${sectionDef.name}]`
        };
      }
      
      // Create promise sections for natural sections
      for (const sectionDef of naturalSectionDefinitions) {
        promiseSections[sectionDef.name] = {
          summary: `${sectionDef.name} section from the paper`,
          fullText: `[Section not yet extracted - click to expand and extract ${sectionDef.name}]`
        };
      }
      
      // Build section order
      const sectionOrder: string[] = [];
      
      // Add synthetic sections first
      for (const syntheticDef of syntheticSectionDefinitions) {
        sectionOrder.push(syntheticDef.name);
      }
      
      // Add natural sections in order
      for (const paperSection of identifiedSections.order) {
        if (!sectionOrder.includes(paperSection)) {
          sectionOrder.push(paperSection);
        }
      }
      
      return {
        sections: promiseSections,
        extractionInfo: {
          totalSections: Object.keys(promiseSections).length,
          extractionMethod: 'quick_section_identification',
          extractedAt: new Date().toISOString(),
          contentType: 'research_paper',
          sectionOrder: sectionOrder
        }
      };
    }
    
    // For comprehensive analysis, extract all sections
    console.log(`📋 Extracting ${allSectionDefinitions.length} sections individually with full context`);
    
    // Extract each section individually with full context
    const extractedSections: Record<string, { summary: string; fullText: string }> = {};
    
    for (const sectionDef of allSectionDefinitions) {
      console.log(`🔄 Extracting section: ${sectionDef.name}`);
      
      try {
        const sectionResult = await this.extractSingleSection(
          content, 
          title, 
          sectionDef, 
          userBackground, 
          isQuickAnalysis
        );
        
        if (sectionResult && sectionResult.summary && sectionResult.fullText) {
          extractedSections[sectionDef.name] = sectionResult;
          console.log(`✅ Successfully extracted: ${sectionDef.name} (${sectionResult.fullText.length} chars)`);
        } else {
          console.log(`⚠️ Skipping section ${sectionDef.name} - insufficient content`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.error(`❌ Failed to extract section ${sectionDef.name}:`, error);
        // Continue with other sections
      }
    }

    // Build intelligent section order
    const sectionOrder: string[] = [];
    const extractedSectionNames = Object.keys(extractedSections);
    
    // 1. Add synthetic sections first (in our preferred order)
    for (const syntheticDef of syntheticSectionDefinitions) {
      if (extractedSectionNames.includes(syntheticDef.name)) {
        sectionOrder.push(syntheticDef.name);
      }
    }
    
    // 2. Add paper's natural sections in the order they appear
    for (const paperSection of identifiedSections.order) {
      if (extractedSectionNames.includes(paperSection) && !sectionOrder.includes(paperSection)) {
        sectionOrder.push(paperSection);
      }
    }
    
    // 3. Add any remaining sections
    for (const sectionName of extractedSectionNames) {
      if (!sectionOrder.includes(sectionName)) {
        sectionOrder.push(sectionName);
      }
    }

    return {
      sections: extractedSections,
      extractionInfo: {
        totalSections: Object.keys(extractedSections).length,
        extractionMethod: isQuickAnalysis ? 'ai_iterative_full_context_quick' : 'ai_iterative_full_context_comprehensive',
        extractedAt: new Date().toISOString(),
        contentType: 'research_paper',
        sectionOrder: sectionOrder
      }
    };
  }

  /**
   * Extract a single section with full context and maximum quality
   */
  private static async extractSingleSection(
    content: string,
    title: string,
    sectionDef: { name: string; description: string },
    userBackground?: string,
    isQuickAnalysis: boolean = false
  ): Promise<{ summary: string; fullText: string } | null> {
    
    const syntheticSectionNames = ['TL;DR', 'Key Insights', 'Practical Implications', 'What\'s Next', 'Future Work', 'Conflict of Interest', 'Limitations'];
    const isSyntheticSection = syntheticSectionNames.includes(sectionDef.name);
    
    const systemPrompt = this.createSingleSectionSystemPrompt(sectionDef, userBackground, isQuickAnalysis, isSyntheticSection);
    const userPrompt = this.createSingleSectionUserPrompt(content, title, sectionDef, userBackground, isSyntheticSection);

    const response = await GroqService.generateTextFromPrompt(
      userPrompt,
      systemPrompt,
      {
        model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
        temperature: isSyntheticSection ? 0.3 : 0.1,
        maxTokens: 130000, // Use full context window
        topP: 0.9
      }
    );

    if (!response.success || !response.content) {
      console.error(`Failed to extract section ${sectionDef.name}:`, response.error);
      return null;
    }

    return this.parseSingleSectionResponse(response.content, sectionDef.name);
  }

  /**
   * Create system prompt for single section extraction
   */
  private static createSingleSectionSystemPrompt(
    sectionDef: { name: string; description: string },
    userBackground?: string,
    isQuickAnalysis: boolean = false,
    isSyntheticSection: boolean = false
  ): string {
    const backgroundContext = userBackground ? 
      `The user has a background in ${userBackground}. Tailor your explanations accordingly.` :
      'The user has a general academic background.';

    const basePrompt = `You are an expert research paper analyst specializing in extracting and analyzing the "${sectionDef.name}" section. ${backgroundContext}

Your task is to provide the highest quality analysis possible for this specific section.`;

    if (isSyntheticSection) {
      return `${basePrompt}

**SPECIFIC INSTRUCTIONS for ${sectionDef.name}:**
${sectionDef.description}

**CRITICAL QUALITY REQUIREMENTS:**
- Be extremely specific and concrete - include actual numbers, measurements, and quantifiable results
- Focus on genuine breakthroughs and discoveries, not generic findings
- Provide substantial, detailed content that adds real value
- Avoid any generic phrases like "the paper discusses" or "research shows"
- Every statement should be specific to THIS paper's actual findings
- Include concrete examples and specific applications where relevant

Return your analysis in JSON format with "summary" and "fullText" fields.`;
    } else {
      return `${basePrompt}

**EXTRACTION INSTRUCTIONS:**
${sectionDef.description}

**TECHNICAL REQUIREMENTS:**
- Remove citation markers like [1], [2], (Smith et al., 2023)
- Remove OCR artifacts and formatting issues
- Preserve all substantive content
- Maintain the original structure and flow
- Clean up any garbled text or formatting problems
- Keep all technical details, numbers, and specific information

Return your analysis in JSON format with "summary" and "fullText" fields.`;
    }
  }

  /**
   * Create user prompt for single section extraction
   */
  private static createSingleSectionUserPrompt(
    content: string,
    title: string,
    sectionDef: { name: string; description: string },
    userBackground?: string,
    isSyntheticSection: boolean = false
  ): string {
    const backgroundNote = userBackground ? 
      `\n**User Background:** ${userBackground} - Please adapt your explanations accordingly.` :
      '';

    if (isSyntheticSection) {
      return `Analyze this research paper and create a high-quality "${sectionDef.name}" section.

**Title:** ${title}${backgroundNote}

**Full Paper Content:**
${content}

**Instructions:**
Create an original, insightful "${sectionDef.name}" section based on your analysis of the complete paper content above. Focus on extracting the most important and specific information relevant to this section type.

**Section Requirements:**
${sectionDef.description}

**Return Format:**
{
  "summary": "Brief description of what this section contains",
  "fullText": "Complete, detailed ${sectionDef.name} content with specific findings, numbers, and concrete insights"
}

**Quality Requirements:**
- Be extremely specific and include actual numbers, measurements, and quantifiable results
- Focus on concrete discoveries and breakthroughs specific to this paper
- Avoid generic statements - every insight should be unique to this research
- Provide substantial, detailed content that adds real value to readers
- Include specific applications, use cases, or next steps where relevant`;
    } else {
      return `Extract the "${sectionDef.name}" section from this research paper.

**Title:** ${title}${backgroundNote}

**Full Paper Content:**
${content}

**Instructions:**
${sectionDef.description}

**Return Format:**
{
  "summary": "Brief description of what this section contains",
  "fullText": "Complete section content, cleaned for readability but preserving all technical details"
}

**Extraction Requirements:**
- Extract the COMPLETE section content, not a summary
- Remove citation markers like [1], [2], (Author, Year)
- Clean up OCR artifacts and formatting issues
- Preserve all technical details, numbers, and specific information
- Maintain the original structure and logical flow
- If the section is not found, return empty strings for both fields`;
    }
  }

  /**
   * Parse single section response
   */
  private static parseSingleSectionResponse(
    content: string,
    sectionName: string
  ): { summary: string; fullText: string } | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error(`No JSON found in response for section ${sectionName}`);
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
      const fullText = typeof parsed.fullText === 'string' ? parsed.fullText.trim() : '';
      
      // Validate content quality
      if (!summary || !fullText) {
        console.error(`Missing content for section ${sectionName}`);
        return null;
      }
      
      // Check for minimum quality thresholds
      if (fullText.length < 50) {
        console.error(`Section ${sectionName} content too short: ${fullText.length} chars`);
        return null;
      }
      
      return { summary, fullText };
      
    } catch (error) {
      console.error(`Failed to parse section ${sectionName} response:`, error);
      return null;
    }
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

**Complete Paper Content:**
${content}

Return a JSON object with the sections array in the order they appear in the paper.`;

    const response = await GroqService.generateTextFromPrompt(
      userPrompt,
      systemPrompt,
      {
        model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
        temperature: 0.1,
        maxTokens: 130000, // Use full context
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