<script lang="ts">
  import { marked } from 'marked';
  import Icon from "@iconify/svelte";
  import CopyButton from './CopyButton.svelte';
  import { researchPaperManager } from '../../ui/researchPaperManager.svelte';
  import { settingsManager } from '../../ui/settings.svelte';
  // Component for reading research paper sections

  // Props
  interface Props {
    analysisData?: any;
    url?: string;
    onRefresh?: () => void;
  }

  let { analysisData, url, onRefresh }: Props = $props();

  // Section interface for drag and drop
  interface PaperSection {
    id: string;
    title: string;
    content: string;
    markdown?: boolean;
    type: 'synthetic' | 'abstract' | 'introduction' | 'methods' | 'results' | 'discussion' | 'conclusion' | 'references' | 'acknowledgments' | 'other';
    icon: string;
    color: string;
    expanded: boolean;
    order: number;
  }

  // Component state for drag and drop
  let sections = $state<PaperSection[]>([]);
  let draggedSection = $state<PaperSection | null>(null);
  let dragOverDropZone = $state<number>(-1);
  
  // Track expanded state separately to preserve across updates
  let expandedSections = $state<Set<string>>(new Set());
  
  // Track loading state for individual sections
  let loadingSections = $state<Set<string>>(new Set());
  
  // Debug loading state changes
  $effect(() => {
    if (loadingSections.size > 0) {
      console.log('📊 Loading sections updated:', Array.from(loadingSections));
    }
  });

  // Section patterns for detection
  const sectionPatterns = [
    // Synthetic sections with special AI icon
    {
      type: 'synthetic' as const,
      patterns: [/\btl;dr\b/i, /\bkey\s+insights?\b/i, /\bpractical\s+implications?\b/i, /\bwhat'?s\s+next\b/i, /\bconflict\s+of\s+interest\b/i, /\bconflicts\s+of\s+interest\b/i, /\bcompeting\s+interests?\b/i, /\bfinancial\s+disclosures?\b/i, /\bdisclosures?\b/i],
      icon: 'mdi:auto-awesome',
      color: 'violet'
    },
    {
      type: 'abstract' as const,
      patterns: [/\babstract\b/i, /\bsummary\b/i],
      icon: 'mdi:file-document-outline',
      color: 'blue'
    },
    {
      type: 'introduction' as const,
      patterns: [/\bintroduction\b/i, /\bintro\b/i, /\bbackground\b/i],
      icon: 'mdi:map-marker-outline',
      color: 'green'
    },
    {
      type: 'methods' as const,
      patterns: [/\bmethods?\b/i, /\bmethodology\b/i],
      icon: 'mdi:flask-outline',
      color: 'purple'
    },
    {
      type: 'results' as const,
      patterns: [/\bresults?\b/i, /\bfindings?\b/i],
      icon: 'mdi:chart-line',
      color: 'orange'
    },
    {
      type: 'discussion' as const,
      patterns: [/\bdiscussion\b/i],
      icon: 'mdi:message-text-outline',
      color: 'indigo'
    },
    {
      type: 'conclusion' as const,
      patterns: [/\bconclusions?\b/i],
      icon: 'mdi:flag-checkered',
      color: 'red'
    },
    {
      type: 'references' as const,
      patterns: [/\breferences?\b/i, /\bbibliography\b/i],
      icon: 'mdi:book-open-page-variant',
      color: 'gray'
    },
    {
      type: 'acknowledgments' as const,
      patterns: [/\backnowledgments?\b/i, /\bcompeting\s+interests?\b/i, /\bfinancial\s+disclosures?\b/i, /\bdisclosures?\b/i],
      icon: 'mdi:heart-outline',
      color: 'pink'
    }
  ];

  // Priority section ordering
  const PRIORITY_SECTIONS = [
    'TL;DR',
    'Key Insights', 
    'Practical Implications',
    'What\'s Next',
    'Conflict of Interest',
    'Conflicts of Interest',
    'Competing Interests',
    'Financial Disclosures',
    'Disclosures'
  ];

  // Extract sections from analysis data and convert to draggable format
  function extractSections() {
    if (!analysisData?.sections) {
      sections = [];
      return;
    }
    
    const sectionsData = analysisData.sections;
    const sectionOrder = analysisData.extractionInfo?.sectionOrder;
    const orderedEntries: Array<[string, any]> = [];
    const processedSections = new Set<string>();
    
    // 1. Add priority sections first (in order)
    for (const prioritySection of PRIORITY_SECTIONS) {
      if (sectionsData[prioritySection]) {
        orderedEntries.push([prioritySection, sectionsData[prioritySection]]);
        processedSections.add(prioritySection);
      }
    }
    
    // 2. Add all remaining sections in the order they come from backend
    if (sectionOrder && Array.isArray(sectionOrder)) {
      for (const sectionName of sectionOrder) {
        if (sectionsData[sectionName] && !processedSections.has(sectionName)) {
          orderedEntries.push([sectionName, sectionsData[sectionName]]);
          processedSections.add(sectionName);
        }
      }
    } else {
      // 3. Fallback: Add all remaining sections that haven't been processed yet
      for (const [sectionName, sectionData] of Object.entries(sectionsData)) {
        if (!processedSections.has(sectionName)) {
          orderedEntries.push([sectionName, sectionData]);
          processedSections.add(sectionName);
        }
      }
    }
    
    // Convert to PaperSection format
    const newSections: PaperSection[] = orderedEntries.map(([sectionName, sectionData], index) => {
      const sectionStyle = getSectionStyle(sectionName);
      const fullContent = (sectionData as any)?.fullText || (sectionData as any)?.content || (sectionData as any)?.summary || 'No content available';
      // Use section name as stable ID (not dependent on index which can change)
      const sectionId = `section-${sectionName.replace(/\s+/g, '-').toLowerCase()}`;
      
      return {
        id: sectionId,
        title: sectionName,
        content: fullContent,
        // content: fullContent,
        markdown: true, // Enable markdown processing for all sections
        type: sectionStyle.type || 'other',
        icon: sectionStyle.icon,
        color: sectionStyle.color,
        expanded: expandedSections.has(sectionId), // Preserve expanded state
        order: index
      };
    });
    
    sections = newSections;
    
    // Clean up expanded states for sections that no longer exist
    const currentSectionIds = new Set(newSections.map(s => s.id));
    const staleIds = Array.from(expandedSections).filter(id => !currentSectionIds.has(id));
    staleIds.forEach(id => expandedSections.delete(id));
  }

  // Get section styling
  function getSectionStyle(sectionName: string) {
    const sectionNameLower = sectionName.toLowerCase();
    for (const pattern of sectionPatterns) {
      if (pattern.patterns.some(p => p.test(sectionNameLower))) {
        return pattern;
      }
    }
    return { type: 'other' as const, icon: 'mdi:file-document-outline', color: 'gray' };
  }

  // Watch for analysis data changes
  $effect(() => {
    extractSections();
  });

  // Check if a section is a promise section (not yet extracted)
  function isPromiseSection(content: string): boolean {
    return content.includes('[Section not yet extracted');
  }

  // Toggle section expansion with lazy loading
  async function toggleSection(sectionId: string) {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    // If section is being collapsed, just collapse it
    if (expandedSections.has(sectionId)) {
      expandedSections.delete(sectionId);
      sections = sections.map(s => 
        s.id === sectionId 
          ? { ...s, expanded: false }
          : s
      );
      return;
    }

    // If section is a promise section, extract it first
    if (isPromiseSection(section.content) && url) {
      // Immediately set loading state before async operation
      loadingSections = new Set([...loadingSections, sectionId]);
      console.log(`🔍 Starting lazy loading for section: ${section.title}`, 'Loading sections:', Array.from(loadingSections));
      
      try {
        const result = await researchPaperManager.handleExtractSingleSection(
          url, 
          section.title, 
          settingsManager.settings.userBackground,
          onRefresh
        );
        
        if (result.success && result.section) {
          // Update the section content
          sections = sections.map(s => 
            s.id === sectionId 
              ? { 
                  ...s, 
                  content: result.section.fullText,
                  expanded: true 
                }
              : s
          );
          
          expandedSections.add(sectionId);
          console.log(`✅ Successfully lazy loaded section: ${section.title}`);
        } else {
          console.error(`❌ Failed to lazy load section: ${section.title}`, result.error);
          // Still expand to show the error or promise message
          expandedSections.add(sectionId);
          sections = sections.map(s => 
            s.id === sectionId 
              ? { ...s, expanded: true }
              : s
          );
        }
      } catch (error) {
        console.error(`❌ Error lazy loading section: ${section.title}`, error);
        // Still expand to show the error
        expandedSections.add(sectionId);
        sections = sections.map(s => 
          s.id === sectionId 
            ? { ...s, expanded: true }
            : s
        );
      } finally {
        // Always clear loading state by creating new Set without this section
        const newLoadingSections = new Set(loadingSections);
        newLoadingSections.delete(sectionId);
        loadingSections = newLoadingSections;
        console.log(`🏁 Finished loading section: ${section.title}`, 'Loading sections:', Array.from(loadingSections));
      }
    } else {
      // Normal expansion for already loaded sections
      expandedSections.add(sectionId);
      sections = sections.map(s => 
        s.id === sectionId 
          ? { ...s, expanded: true }
          : s
      );
    }
  }

  // Drag and drop functions
  function handleDragStart(event: DragEvent, section: PaperSection) {
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/html', ''); // Required for Firefox
    }
    draggedSection = section;
  }

  function handleDropZoneDragOver(event: DragEvent, dropZoneIndex: number) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    dragOverDropZone = dropZoneIndex;
  }

  function handleDropZoneDragLeave() {
    // Small delay to prevent flickering when moving between related elements
    setTimeout(() => {
      dragOverDropZone = -1;
    }, 10);
  }

  function handleDropZoneDrop(event: DragEvent, dropZoneIndex: number) {
    event.preventDefault();
    dragOverDropZone = -1;
    
    if (!draggedSection) return;
    
    const draggedIndex = sections.findIndex(s => s.id === draggedSection!.id);
    if (draggedIndex === -1) return;
    
    // Calculate target index based on drop zone
    let targetIndex = dropZoneIndex;
    
    // If dropping after the dragged item, adjust target index
    if (dropZoneIndex > draggedIndex) {
      targetIndex = dropZoneIndex - 1;
    }
    
    if (draggedIndex === targetIndex) return;
    
    // Reorder sections
    const newSections = [...sections];
    const [movedSection] = newSections.splice(draggedIndex, 1);
    newSections.splice(targetIndex, 0, movedSection);
    
    // Update order values
    newSections.forEach((section, index) => {
      section.order = index;
    });
    
    sections = newSections;
    draggedSection = null;
  }

  function handleDragEnd() {
    draggedSection = null;
    dragOverDropZone = -1;
  }

  function handleSectionDragOver(event: DragEvent, sectionIndex: number) {
    if (!draggedSection) return;
    
    event.preventDefault();
    
    const target = event.currentTarget as HTMLElement;
    if (!target) return;
    
    const rect = target.getBoundingClientRect();
    const mouseY = event.clientY;
    const sectionTop = rect.top;
    const sectionHeight = rect.height;
    const midPoint = sectionTop + (sectionHeight / 2);
    
    // Determine which drop zone should be active based on mouse position
    if (mouseY < midPoint) {
      // Mouse in top half - activate drop zone above this section
      dragOverDropZone = sectionIndex;
    } else {
      // Mouse in bottom half - activate drop zone below this section
      dragOverDropZone = sectionIndex + 1;
    }
  }

  function handleSectionDragLeave(event: DragEvent) {
    // Check if we're leaving to enter a child element (like the drop zone)
    const relatedTarget = event.relatedTarget as Element;
    const currentTarget = event.currentTarget as Element;
    
    // If we're entering a child element or another section, don't clear the drop zone
    if (relatedTarget && (currentTarget.contains(relatedTarget) || relatedTarget.closest('.section-card') || relatedTarget.closest('.drop-zone'))) {
      return;
    }
    
    dragOverDropZone = -1;
  }

  // Render markdown safely
  function renderMarkdown(content: string): string {
    try {
      const result = marked.parse(content);
      return typeof result === 'string' ? result : content;
    } catch (error) {
      console.warn('Markdown rendering error:', error);
      return content;
    }
  }

  // Render inline markdown
  function renderInlineMarkdown(content: string | undefined): string {
    if (!content) return '';
    try {
      const result = marked.parseInline(content);
      return typeof result === 'string' ? result : content;
    } catch (error) {
      console.warn('Inline markdown rendering error:', error);
      return content;
    }
  }

  // Copy all sections as text
  function copyAllSections() {
    if (sections.length === 0) return;
    
    const allSectionsText = sections
      .map(section => {
        const title = section.title.replace(/<[^>]*>/g, ''); // Strip HTML tags
        const content = section.content;
        return `${title}\n${'='.repeat(title.length)}\n\n${content}\n`;
      })
      .join('\n');
    
    return allSectionsText;
  }

  // Get color classes
  function getColorClasses(color: string) {
    const colorMap = {
      violet: 'border-violet-200 bg-violet-50',
      blue: 'border-blue-200 bg-blue-50',
      green: 'border-green-200 bg-green-50',
      purple: 'border-purple-200 bg-purple-50',
      orange: 'border-orange-200 bg-orange-50',
      indigo: 'border-indigo-200 bg-indigo-50',
      red: 'border-red-200 bg-red-50',
      gray: 'border-gray-200 bg-gray-50',
      pink: 'border-pink-200 bg-pink-50'
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.gray;
  }

  function getTextColor(color: string) {
    const colorMap = {
      violet: 'text-violet-800',
      blue: 'text-blue-800',
      green: 'text-green-800',
      purple: 'text-purple-800',
      orange: 'text-orange-800',
      indigo: 'text-indigo-800',
      red: 'text-red-800',
      gray: 'text-gray-800',
      pink: 'text-pink-800'
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.gray;
  }
</script>

<div class="section-reader">
  {#if sections.length === 0}
    <div class="empty-state">
      <Icon icon="mdi:file-document-multiple-outline" class="w-8 h-8 opacity-50" />
      <div class="text-sm font-medium">No Research Sections Found</div>
      <div class="text-sm opacity-75">
        {#if !analysisData}
          Start research paper analysis to extract sections
        {:else}
          This document doesn't appear to have standard research paper sections
        {/if}
      </div>
    </div>
  {:else}
    <!-- Controls -->
    <div class="controls">
      <div class="section-count">
        {#if analysisData?.wordCount}
          {analysisData.wordCount.toLocaleString()} words
        {/if}
        • {sections.length} sections
        {#if analysisData?.isProcessing}
          <span class="processing-indicator">• Extracting... </span>
          <!-- {#if $currentTabId}
            <span class="tab-indicator">on Tab {$currentTabId}</span>
          {/if} -->
        {/if}
      </div>
      
      <CopyButton 
        content={copyAllSections()}
        buttonClass="copy-all-sections-btn"
        iconClass="w-6 h-6"
        title="Copy all sections as text"
      >
        Copy All
      </CopyButton>
    </div>

    <!-- Sections with Drop Zones -->
    <div class="sections-container" role="list">
      {#each sections as section, index (section.id)}
        <!-- Drop zone before first section -->
        {#if index === 0}
          <div
            class="drop-zone"
            class:active={dragOverDropZone === 0 && draggedSection !== null}
            class:visible={draggedSection !== null}
            role="button"
            tabindex="-1"
            ondragover={(e) => handleDropZoneDragOver(e, 0)}
            ondragleave={handleDropZoneDragLeave}
            ondrop={(e) => handleDropZoneDrop(e, 0)}
          >
            <div class="drop-zone-line"></div>
          </div>
        {/if}

        <!-- Section Card -->
        <div
          class="section-card {getColorClasses(section.color)}"
          class:dragging={draggedSection?.id === section.id}
          class:expanded={section.expanded}
          draggable={!section.expanded}
          role="listitem"
          data-section-id={section.id}
          ondragstart={(e) => handleDragStart(e, section)}
          ondragover={(e) => handleSectionDragOver(e, index)}
          ondragleave={handleSectionDragLeave}
          ondrop={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseY = e.clientY;
            const sectionTop = rect.top;
            const sectionHeight = rect.height;
            const midPoint = sectionTop + (sectionHeight / 2);

            const dropZoneIndex = mouseY < midPoint ? index : index + 1;
            handleDropZoneDrop(e, dropZoneIndex);
          }}
          ondragend={handleDragEnd}
        >
          <!-- Section Header -->
          <div 
            class="section-header"
            role="button"
            tabindex="0"
            onclick={() => toggleSection(section.id)}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleSection(section.id);
              }
            }}
            aria-expanded={section.expanded}
            aria-label="Toggle {section.title} section"
          >
            <div class="section-info">
              <Icon 
                icon={section.expanded ? 'mdi:chevron-down' : 'mdi:chevron-right'} 
                class="w-6 h-6 text-gray-500 transition-transform arrow-icon flex-shrink-0"
              />
              <Icon icon={section.icon} class="w-6 h-6 min-w-6 min-h-6 flex-shrink-0 {getTextColor(section.color)}" />
              <h3 class="section-title {getTextColor(section.color)}">{@html renderInlineMarkdown(section.title)}</h3>
            </div>
            <div class="section-controls">
              {#if isPromiseSection(section.content)}
                <!-- Brain-freeze icon instead of copy for promise sections -->
                <div 
                  class="content-copy-btn brain-freeze-btn"
                  title="Click to extract this section"
                  role="button"
                  tabindex="0"
                  onclick={(e) => {
                    e.stopPropagation();
                    toggleSection(section.id);
                  }}
                  onkeydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleSection(section.id);
                    }
                  }}
                >
                  {#if loadingSections.has(section.id)}
                    <Icon icon="mdi:loading" class="w-6 h-6 animate-spin flex-shrink-0" />
                  {:else}
                    <Icon icon="mdi:brain-freeze" class="w-6 h-6 flex-shrink-0" />
                  {/if}
                </div>
              {:else}
                <CopyButton 
                  content={section.content}
                  buttonClass="content-copy-btn"
                  iconClass="w-6 h-6"
                  title="Copy section content"
                />
              {/if}
              <Icon icon="mdi:drag-vertical" class="w-6 h-6 text-gray-400 drag-handle flex-shrink-0" />
            </div>
          </div>

          <!-- Section Content -->
          {#if section.expanded}
            <div class="section-content">
              <div class="content-body">
                {#if isPromiseSection(section.content)}
                  <div class="promise-section-content">
                    <div class="promise-message">
                      <Icon icon="mdi:brain-freeze" class="w-5 h-5 text-blue-500" />
                      <span class="text-blue-700 font-medium">Section not yet extracted</span>
                    </div>
                    <p class="text-gray-600 text-sm mt-2">
                      Click on this section header to extract the content using AI.
                    </p>
                  </div>
                {:else}
                  {@html renderMarkdown(section.content)}
                {/if}
              </div>
            </div>
          {/if}
        </div>

        <!-- Drop zone after each section -->
        <div
          class="drop-zone"
          class:active={dragOverDropZone === index + 1 && draggedSection !== null}
          class:visible={draggedSection !== null}
          role="button"
          tabindex="-1"
          ondragover={(e) => handleDropZoneDragOver(e, index + 1)}
          ondragleave={handleDropZoneDragLeave}
          ondrop={(e) => handleDropZoneDrop(e, index + 1)}
        >
          <div class="drop-zone-line"></div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .section-reader {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    min-height: 200px;
  }

  .quick-summary {
    background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
    border-bottom: 1px solid #e5e7eb;
    padding: 16px;
    margin: 0;
  }

  .quick-summary-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .quick-summary-title {
    font-size: 14px;
    font-weight: 600;
    color: #7c3aed;
    margin: 0;
  }

  .summary-item {
    margin-bottom: 12px;
  }

  .summary-item:last-child {
    margin-bottom: 0;
  }

  .summary-label {
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .summary-content {
    font-size: 13px;
    line-height: 1.5;
    color: #374151;
  }

  .insights-list {
    margin: 0;
    padding-left: 16px;
    list-style-type: disc;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    color: #6b7280;
    text-align: center;
    gap: 8px;
  }

  .controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
    border-radius: 6px 6px 0 0;
  }

  .section-count {
    font-size: 12px;
    color: #6b7280;
    font-weight: 500;
  }

  .processing-indicator {
    color: #3b82f6;
    font-weight: 600;
    animation: pulse 2s ease-in-out infinite;
  }

  .tab-indicator {
    color: #6b7280;
    font-size: 10px;
    font-weight: 500;
    background: rgba(59, 130, 246, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: 4px;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .sections-container {
    padding: 16px;
    display: flex;
    flex-direction: column;
  }

  /* Drop zones provide ALL spacing between sections */
  .drop-zone {
    opacity: 0;
    transition: all 0.2s ease;
    position: relative;
    height: 4px; /* Default spacing between sections */
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  .drop-zone.visible {
    opacity: 0;
    height: 16px; /* Large hit area when dragging */
    margin: 0;
    padding: 0;
  }

  .drop-zone.active {
    opacity: 1;
    height: 16px;
    margin: 0;
    padding: 0;
  }

  .drop-zone-line {
    height: 4px;
    background: #3b82f6;
    border-radius: 2px;
    transition: all 0.2s ease;
    position: absolute;
    top: 50%;
    left: 0; /* Full width */
    right: 0; /* Full width */
    transform: translateY(-50%);
    pointer-events: none;
  }

  .drop-zone.active .drop-zone-line {
    background: #1d4ed8;
    height: 5px;
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
    left: 0; /* Full width when active too */
    right: 0; /* Full width when active too */
  }

  /* Section Card Styles */
  .section-card {
    border: 1px solid;
    border-radius: 8px;
    transition: all 0.2s ease;
    cursor: move;
    position: relative;
  }

  .section-card.expanded {
    cursor: default;
  }

  .section-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  .section-card.expanded:hover {
    transform: none;
    box-shadow: none;
  }

  .section-card.dragging {
    opacity: 0.3;
    transform: scale(0.98);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .section-header:hover {
    background-color: rgba(0, 0, 0, 0.02);
  }

  .section-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0; /* Allow text to shrink */
  }

  .section-title {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
    flex: 1;
    min-width: 0; /* Allow text to shrink and wrap */
    word-break: break-word;
  }

  .section-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .arrow-icon {
    transition: transform 0.2s ease;
  }

  .section-card.expanded .arrow-icon {
    transform: rotate(90deg);
  }

  .drag-handle {
    cursor: grab;
  }

  .drag-handle:active {
     cursor: grabbing;
  }

  .section-content {
    border-top: 1px solid rgba(0, 0, 0, 0.05);
    background-color: rgba(255, 255, 255, 0.5);
    user-select: text;
    cursor: text;
  }

  :global(.content-copy-btn) {
    padding: 4px;
    background: transparent;
    border: none;
    color: #6b7280;
    transition: all 0.2s ease;
    border-radius: 4px;
  }

  :global(.content-copy-btn:hover) {
    background: rgba(0, 0, 0, 0.05);
    color: #374151;
  }

  :global(.brain-freeze-btn) {
    color: #3b82f6 !important;
  }

  :global(.brain-freeze-btn:hover) {
    background: rgba(59, 130, 246, 0.1) !important;
    color: #1d4ed8 !important;
  }

  :global(.copy-all-sections-btn) {
    padding: 6px 12px;
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    color: #374151;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  :global(.copy-all-sections-btn:hover) {
    background: #e5e7eb;
    color: #1f2937;
    border-color: #9ca3af;
  }

  .content-body {
    padding: 8px 16px 16px 16px;
  }

  .prose-content {
    font-size: 14px;
    line-height: 1.6;
    color: #374151;
    white-space: pre-wrap;
    user-select: text;
  }

  .promise-section-content {
    padding: 16px;
    background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
    border: 1px solid #bfdbfe;
    border-radius: 6px;
    text-align: center;
  }

  .promise-message {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: 8px;
  }
</style> 