# Research Paper Extractor Usage

## Overview

The Research Paper Extractor provides AI-powered analysis of academic papers with customizable background context. It follows the same pattern as the Summary component but is specifically designed for research papers.

## Components

### 1. AiResearchPaper.svelte
The main component that provides the user interface for research paper analysis.

**Props:**
- `tabData: TabData | null` - The current tab data
- `onRefresh?: () => void` - Optional callback for refreshing the panel

**Features:**
- Comprehensive analysis mode (full paper analysis)
- Quick analysis mode (key insights only)
- User background customization
- Progress tracking
- Error handling

### 2. researchPaperManager.svelte.ts
Manages the research paper extraction state and handles communication with the background script.

**Methods:**
- `handleExtractResearchPaper(url, userBackground?, onSuccess?)` - Extract comprehensive analysis
- `handleQuickExtractResearchPaper(url, userBackground?, onSuccess?)` - Extract quick analysis
- `getExtractionButtonClass()` - Get CSS classes based on status
- `reset()` - Reset the manager state

### 3. researchPaperService.svelte.ts
Handles the actual research paper analysis using the GroqService.

**Methods:**
- `extractResearchPaper(tabData, userBackground?)` - Comprehensive analysis
- `extractResearchPaperQuick(tabData, userBackground?)` - Quick analysis
- `validateSettings()` - Check if API key is configured

## Usage Example

```svelte
<script lang="ts">
  import AiResearchPaper from './lib/components/AiResearchPaper.svelte';
  import type { TabData } from './types/tabData';

  let tabData: TabData | null = null;

  // Function to refresh the panel data
  function handleRefresh() {
    // Refresh logic here
    console.log('Panel refreshed');
  }
</script>

<AiResearchPaper {tabData} onRefresh={handleRefresh} />
```

## Analysis Types

### Comprehensive Analysis
Provides detailed analysis including:
- Title and authors
- Abstract
- Key findings
- Methodology
- Significance
- Limitations
- Future work
- Practical implications
- Technical details

### Quick Analysis
Provides concise insights including:
- TL;DR summary
- Key insights
- Why it matters
- Practical takeaways
- Next steps

## Background Context

Users can specify their background (e.g., "computer science", "biology", "economics") to get explanations tailored to their field of expertise.

## Data Flow

1. User clicks "Analyze Research Paper" or "Quick" button
2. `researchPaperManager` sends message to background script
3. Background script calls `handleResearchPaperExtraction` or `handleQuickResearchPaperExtraction`
4. Handler uses `ResearchPaperService` to analyze the content
5. Service uses `GroqService` to generate AI analysis
6. Results are saved to `TabData` and displayed in the component

## Error Handling

The system includes comprehensive error handling:
- API key validation
- Content validation (checks if content appears to be a research paper)
- Network error handling
- Parsing error handling
- User-friendly error messages

## Styling

The component uses Tailwind-inspired CSS classes with:
- Responsive design
- Loading states
- Error states
- Success states
- Accessibility features

## Integration

To integrate into your application:

1. Import the component: `import AiResearchPaper from './lib/components/AiResearchPaper.svelte';`
2. Ensure your `TabData` type includes the research paper fields
3. Make sure the background script handlers are registered
4. Configure the Groq API key in settings

## Type Definitions

The `ResearchPaperAnalysis` type supports both comprehensive and quick analysis formats with optional fields for maximum flexibility. 