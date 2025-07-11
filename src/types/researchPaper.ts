export interface ResearchPaperAnalysis {
  // Basic metadata
  title?: string;
  authors?: string[];
  abstract?: string;
  extractedAt: string;
  extractionMethod?: string;
  isQuickAnalysis?: boolean;

  // Comprehensive analysis fields
  keyFindings?: string[];
  methodology?: string;
  significance?: string;
  limitations?: string;
  futureWork?: string;
  practicalImplications?: string;

  // Quick analysis fields
  tldr?: string;
  keyInsights?: string[];
  whyItMatters?: string;
  practicalTakeaways?: string[];
  nextSteps?: string;

  // Section data
  sections?: Record<string, { summary: string; fullText: string }>;
  
  // Extraction info
  extractionInfo?: {
    totalSections: number;
    extractionMethod: string;
    extractedAt: string;
    contentType: string;
  };

  // Legacy fields (for backward compatibility)
  findings?: string;
  conclusions?: string;
  references?: string[];
} 