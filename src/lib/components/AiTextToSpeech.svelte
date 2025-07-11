<script lang="ts">
  import { marked } from 'marked';
  import Icon from "@iconify/svelte";
  import { textToSpeechManager } from '../ui/textToSpeechManager.svelte';
  import ToggleDrawer from './ui/ToggleDrawer.svelte';
  import ApiSettings from './ui/ApiSettings.svelte';
  import CopyButton from './ui/CopyButton.svelte';
  import type { TextToSpeech } from '../../types/textToSpeech';

  interface Props {
    url: string | null;
    content: any;
    textToSpeech: TextToSpeech | null;
    isGenerating: boolean;
    onRefresh?: () => void;
  }

  let { url, content, textToSpeech, isGenerating, onRefresh }: Props = $props();

  // Component UI state
  let isExpanded = $state(false);
  let editableText = $state('');
  let isEditingText = $state(false);
  let isGeneratingText = $state(false);
  let isGeneratingAudio = $state(false);
  let currentAudioUrl = $state<string | null>(null);
  let editableFilename = $state('');
  let customSystemPrompt = $state('');
  let isPromptExpanded = $state(false);
  let promptTextarea: HTMLTextAreaElement | undefined;

  // Derived states
  const hasTts = $derived(textToSpeech && textToSpeech.rewrittenText && textToSpeech.rewrittenText.length > 0);
  const canGenerate = $derived(url && content && content.text && content.text.length > 0);
  const hasEditableText = $derived(editableText.trim().length > 0);
  const canGenerateAudio = $derived(hasEditableText && !isGeneratingAudio);
  const hasAudio = $derived(currentAudioUrl || textToSpeechManager.audioUrl);

  // Sync editable text with stored TTS data
  $effect(() => {
    if (textToSpeech?.rewrittenText && !isEditingText) {
      editableText = textToSpeech.rewrittenText;
    }
  });

  // Generate filename when text is generated
  $effect(() => {
    if (hasEditableText && !editableFilename) {
      editableFilename = generateFilename();
    }
  });

  // Initialize custom system prompt with default
  $effect(() => {
    if (!customSystemPrompt) {
      customSystemPrompt = getDefaultSystemPrompt();
    }
  });

  // Get the default system prompt
  function getDefaultSystemPrompt(): string {
    return `You are a university lecturer preparing academic content for spoken delivery. Your task is to make MINIMAL changes to preserve the original author's voice and phrasing while making the text suitable for lecture-style presentation.

CRITICAL: PRESERVE THE ORIGINAL PHRASING AND LANGUAGE AS MUCH AS POSSIBLE. Only make changes that are absolutely necessary for speech conversion.

Your minimal editing should ONLY:
1. Remove or simplify citations that are hard to pronounce (e.g., "[1]", "(Smith et al., 2023)") - either remove them entirely or convert to natural speech like "according to Smith and colleagues"
2. Remove URLs, email addresses, and other hard-to-pronounce technical elements
3. Convert common abbreviations to full words ONLY when they would be unclear when spoken (e.g., "etc." to "and so on", "e.g." to "for example")
4. Fix obvious formatting artifacts from web scraping (extra spaces, broken words)
5. Convert bullet points or numbered lists to flowing text by adding minimal connecting words like "First," "Second," "Additionally," etc.
6. **HANDLE LONG NUMBER SEQUENCES**: When you encounter long lists of numbers, token IDs, coordinates, or similar data sequences, replace them with a brief summary and direct the listener to the original text. For example: "The token IDs are 33, 13969, 4123... and several others - please refer to the original document for the complete sequence."

DO NOT:
- Change the author's word choices, tone, or writing style
- Rewrite sentences for "better flow" unless they are genuinely broken
- Simplify technical language or jargon - keep the original terminology
- Add explanations or interpretations
- Break up long sentences unless they are genuinely problematic for speech
- Add transitions beyond simple list connectors
- Read out every number in long sequences (this makes audio tedious)

LECTURER APPROACH:
- Speak as if presenting to students in a lecture hall
- Maintain the academic tone and precision of the original
- When encountering complex data or long number sequences, guide students to reference the source material
- Use phrases like "as shown in the original text" or "refer to the document for complete details" when appropriate

IMPORTANT: Return ONLY the minimally edited content. Do not include any preamble, introduction, or explanation. Preserve the original text as much as possible - your job is cleanup for spoken delivery, not rewriting.

The goal is to create speech-ready text that sounds like the original author giving a university lecture, with appropriate handling of complex data sequences.`;
  }

  // Auto-resize textarea function
  function autoResizeTextarea(textarea: HTMLTextAreaElement) {
    if (!textarea) return;
    
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Set height to scrollHeight + padding to avoid any scrolling
    const newHeight = Math.max(200, textarea.scrollHeight + 10); // Minimum 200px + 10px padding
    textarea.style.height = newHeight + 'px';
  }

  // Handle textarea input for auto-resize
  function handlePromptInput(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    autoResizeTextarea(textarea);
  }

  // Auto-resize when prompt content changes or textarea becomes available
  $effect(() => {
    if (promptTextarea) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        if (promptTextarea) {
          autoResizeTextarea(promptTextarea);
        }
      });
    }
  });

  // Auto-resize when drawer is opened and textarea becomes visible
  $effect(() => {
    if (isPromptExpanded && promptTextarea) {
      // Small delay to ensure the drawer animation is complete
      setTimeout(() => {
        if (promptTextarea) {
          autoResizeTextarea(promptTextarea);
        }
      }, 100);
    }
  });

  // Handle text rewriting (Step 1)
  async function handleGenerateText() {
    if (!url || isGeneratingText) {
      return;
    }

    isGeneratingText = true;
    isEditingText = false;

    try {
      console.log('🔊 Step 1: Generating rewritten text for TTS...');
      
      const response = await chrome.runtime.sendMessage({
        action: 'generateTtsText',
        url: url,
        customSystemPrompt: customSystemPrompt.trim() || undefined
      });

      if (response.success && response.rewrittenText) {
        editableText = response.rewrittenText;
        console.log('✅ Text rewriting successful');
      } else {
        console.error('❌ Text rewriting failed:', response.error);
        // Could show error in UI here
      }
    } catch (error) {
      console.error('❌ Text rewriting error:', error);
    } finally {
      isGeneratingText = false;
    }
  }

  // Handle audio generation (Step 2)
  async function handleGenerateAudio() {
    if (!editableText.trim() || isGeneratingAudio) {
      return;
    }

    isGeneratingAudio = true;

    try {
      console.log('🔊 Step 2: Generating audio from edited text...');
      
      const response = await chrome.runtime.sendMessage({
        action: 'generateTtsAudio',
        text: editableText.trim(),
        voice: textToSpeechManager.selectedVoice
      });

      if (response.success) {
        console.log('✅ Audio generation successful');
        
        // Create URL from audio data if we received it (since background can't create URLs)
        if (response.audioData) {
          // Clean up any existing audio URL
          if (currentAudioUrl) {
            URL.revokeObjectURL(currentAudioUrl);
          }
          
          try {
            // Debug the received data
            console.log('🔧 Received audioData type:', typeof response.audioData);
            console.log('🔧 AudioData length:', response.audioData?.length);
            
            // Convert base64 string back to ArrayBuffer and then to Blob
            console.log('🔧 Converting base64 to Blob...');
            const audioType = response.audioType || 'audio/wav';
            
            if (typeof response.audioData === 'string') {
              // Convert base64 to binary string
              const binaryString = atob(response.audioData);
              console.log('🔧 Binary string length:', binaryString.length);
              
              // Convert binary string to Uint8Array
              const uint8Array = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                uint8Array[i] = binaryString.charCodeAt(i);
              }
              
              console.log('🔧 Uint8Array length:', uint8Array.length);
              const blob = new Blob([uint8Array], { type: audioType });
              console.log('🔧 Created blob size:', blob.size);
              
              // Create new URL from blob
              currentAudioUrl = URL.createObjectURL(blob);
              console.log('✅ Audio URL created and ready for playback');
            } else {
              throw new Error('Expected base64 string but received: ' + typeof response.audioData);
            }
          } catch (error) {
            console.error('❌ Failed to create audio URL:', error);
            console.log('Response audioData type:', typeof response.audioData);
            console.log('Response audioData sample:', response.audioData?.substring?.(0, 100) || 'not a string');
          }
        }
        
        // Save the final result to storage
        if (onRefresh) {
          onRefresh();
        }
      } else {
        console.error('❌ Audio generation failed:', response.error);
      }
    } catch (error) {
      console.error('❌ Audio generation error:', error);
    } finally {
      isGeneratingAudio = false;
    }
  }

  // Handle copying rewritten text
  async function handleCopyText() {
    const textToCopy = editableText || textToSpeech?.rewrittenText;
    if (!textToCopy) return;
    
    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  }

  // Handle voice selection
  function handleVoiceChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    textToSpeechManager.setSelectedVoice(target.value);
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

  // Format file size
  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Generate a clean filename from page metadata
  function generateFilename(): string {
    if (!content?.metadata) {
      return `tts-audio-${Date.now()}.wav`;
    }

    // Try different title sources in order of preference
    const title = content.metadata.title || 
                 content.metadata.ogTitle || 
                 content.metadata.twitterTitle ||
                 content.metadata.citations?.title ||
                 content.title ||
                 'untitled';

    // Clean the title for use as filename
    const cleanTitle = title
      .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/--+/g, '-') // Replace multiple hyphens with single
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .toLowerCase()
      .substring(0, 100); // Limit length

    // Add domain for context if available
    let domain = content.metadata.domain || 
                (url ? new URL(url).hostname.replace('www.', '') : '');
    
    // Clean up domain to avoid redundancy
    if (domain) {
      // Extract main domain name (e.g., "example.com" -> "example")
      const domainParts = domain.split('.');
      const mainDomain = domainParts.length > 1 ? domainParts[0] : domain;
      domain = mainDomain.toLowerCase();
    }
    
    const domainPart = domain ? `-${domain}` : '';
    
    return `${cleanTitle}${domainPart}-tts.wav`;
  }

  // Handle audio download
  function handleDownloadAudio() {
    const audioUrl = currentAudioUrl || textToSpeechManager.audioUrl;
    if (!audioUrl) return;

    const filename = editableFilename || generateFilename();
    
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Clean up audio when component is destroyed
  $effect(() => {
    return () => {
      textToSpeechManager.cleanupAudio();
      // Clean up our local audio URL
      if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
        currentAudioUrl = null;
      }
    };
  });
</script>

<ToggleDrawer
  title="AI Text-to-Speech"
  bind:isExpanded
>
  {#snippet children()}
    <!-- API Configuration -->
    <ApiSettings />

    <!-- Custom System Prompt Editor -->
    <div class="mb-4">
      <ToggleDrawer
        title="Custom System Prompt"
        subtitle="Edit the AI instructions for text rewriting"
        bind:isExpanded={isPromptExpanded}
      >
        {#snippet children()}
          <div class="space-y-3">
            <div class="text-sm text-gray-600">
              Customize how the AI rewrites your content for speech. The default prompt is optimized for academic content with a university lecturer approach.
            </div>
            
            <div>
              <label for="system-prompt" class="block text-sm font-medium text-gray-700 mb-2">
                System Prompt:
              </label>
              <textarea 
                id="system-prompt"
                bind:this={promptTextarea}
                bind:value={customSystemPrompt}
                oninput={handlePromptInput}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical text-sm font-mono"
                placeholder="Enter your custom system prompt here..."
                style="min-height: 200px;"
              ></textarea>
              <div class="text-xs text-gray-500 mt-1">
                This prompt will be used to instruct the AI on how to rewrite your content for text-to-speech conversion.
              </div>
            </div>

            <div class="flex gap-2">
              <button 
                onclick={() => customSystemPrompt = getDefaultSystemPrompt()}
                class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                title="Reset to default prompt"
              >
                Reset to Default
              </button>
              <div class="text-xs text-gray-500 flex items-center">
                Changes take effect on the next text generation
              </div>
            </div>
          </div>
        {/snippet}
      </ToggleDrawer>
    </div>

    <!-- About Section -->
    <div class="py-2">
      Convert page content to natural-sounding speech. The AI first rewrites the text to be speech-friendly by removing citations, converting lists to sentences, and improving flow, then generates high-quality audio.
    </div>

    <!-- Step 1: Generate Text Button -->
    <div class="mb-4">
      <button 
        onclick={handleGenerateText}
        class="w-full px-3 py-2 bg-blue-100 text-blue-900 rounded hover:bg-blue-200 transition-colors font-semibold flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!canGenerate || isGeneratingText}
        title="Generate speech-optimized text"
      >
        {#if isGeneratingText}
          <Icon icon="mdi:loading" class="animate-spin w-6 h-6" />
          Rewriting text for speech...
        {:else}
          <Icon icon="mdi:text-box-edit" class="w-6 h-6 text-blue-600" />
          <span class="font-semibold text-blue-600">Step 1: Generate Speech Text</span>
        {/if}
      </button>
    </div>

    <!-- Text Editor (Step 1.5) -->
    {#if hasEditableText}
      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <label for="editable-text" class="block text-sm font-medium text-gray-700">
            Review and Edit Speech Text:
          </label>
          <CopyButton 
            copyFn={handleCopyText}
            buttonClass="px-2 py-1 text-xs text-gray-600 hover:text-blue-600 border border-gray-300 rounded transition-colors flex items-center gap-1"
            iconClass="w-4 h-4"
            title="Copy text"
          >
            <span class="ml-1 text-xs">Copy</span>
          </CopyButton>
        </div>
        <textarea 
          id="editable-text"
          bind:value={editableText}
          oninput={() => isEditingText = true}
          class="w-full h-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
          placeholder="The rewritten text will appear here for you to review and edit..."
          disabled={isGeneratingText || isGeneratingAudio}
        ></textarea>
        <div class="text-xs text-gray-500 mt-1">
          {editableText.trim().split(/\s+/).length} words • Est. {Math.ceil(editableText.trim().split(/\s+/).length / 150)} minutes
        </div>
      </div>

      <!-- Voice Selection -->
      <div class="mb-4">
        <label for="voice-select" class="block text-sm font-medium text-gray-700 mb-2">
          Voice Selection:
        </label>
        <select 
          id="voice-select"
          onchange={handleVoiceChange}
          value={textToSpeechManager.selectedVoice}
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isGenerating || textToSpeechManager.isGenerating}
        >
          {#each textToSpeechManager.getAvailableVoices() as voice}
            <option value={voice}>{voice.replace('-PlayAI', '')}</option>
          {/each}
        </select>
      </div>

      <!-- Filename Input -->
      <div class="mb-4">
        <label for="filename-input" class="block text-sm font-medium text-gray-700 mb-2">
          Audio Filename:
        </label>
        <input 
          id="filename-input"
          type="text"
          bind:value={editableFilename}
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Enter filename for the audio file..."
          disabled={isGeneratingAudio}
        />
        <div class="text-xs text-gray-500 mt-1">
          This will be the filename when you download the audio file.
        </div>
      </div>

      <!-- Step 2: Generate Audio Button -->
      <div class="mb-4">
        <button 
          onclick={handleGenerateAudio}
          class="w-full px-3 py-2 bg-purple-100 text-purple-900 rounded hover:bg-purple-200 transition-colors font-semibold flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!canGenerateAudio}
          title="Generate audio from the edited text"
        >
          {#if isGeneratingAudio}
            <Icon icon="mdi:loading" class="animate-spin w-6 h-6" />
            Generating audio...
          {:else}
            <Icon icon="mdi:volume-high" class="w-6 h-6 text-purple-600" />
            <span class="font-semibold text-purple-600">Step 2: Generate Audio</span>
          {/if}
        </button>
      </div>
    {/if}

    <!-- Audio Player (show when we have current audio) -->
    {#if hasAudio}
      <div class="bg-white border border-gray-200 p-4 rounded mb-4">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-medium text-gray-700">🔊 Generated Audio</h4>
          <button 
            onclick={handleDownloadAudio}
            class="px-2 py-1 text-xs text-gray-600 hover:text-blue-600 border border-gray-300 rounded transition-colors flex items-center gap-1"
            title="Download audio file"
          >
            <Icon icon="mdi:download" class="w-4 h-4" />
            Download
          </button>
        </div>
        
        <!-- Simple audio player -->
        <audio 
          controls 
          class="w-full"
          src={currentAudioUrl || textToSpeechManager.audioUrl}
        >
          Your browser does not support the audio element.
        </audio>
        
        <div class="text-xs text-gray-500 mt-2">
          Audio generated successfully. Use the controls to play/pause or download the file.
        </div>
      </div>
    {/if}

    <!-- Content Display -->
    {#if textToSpeechManager.ttsError}
      <div class="bg-red-50 border border-red-200 p-3 rounded mb-4">
        <div class="text-red-600 flex items-center gap-2">
          <Icon icon="mdi:alert-circle" class="w-5 h-5" />
          <div>
            <div class="font-medium">TTS Error</div>
            <div class="text-sm opacity-75">{textToSpeechManager.ttsError}</div>
          </div>
        </div>
      </div>
    {/if}

    {#if hasTts}
      <!-- TTS Info -->
      <div class="bg-gray-50 border border-gray-200 p-3 rounded mb-4">
        <div class="text-sm text-gray-600 space-y-1">
          <div><strong>Voice:</strong> {textToSpeech?.voice?.replace('-PlayAI', '') || 'Unknown'}</div>
          <div><strong>Words:</strong> {textToSpeech?.wordCount?.toLocaleString() || 0}</div>
          {#if textToSpeech?.estimatedDuration}
            <div><strong>Est. Duration:</strong> {formatDuration(textToSpeech.estimatedDuration)}</div>
          {/if}
          <div><strong>Generated:</strong> {textToSpeech?.generatedAt ? new Date(textToSpeech.generatedAt).toLocaleString() : 'Unknown'}</div>
        </div>
      </div>
    {/if}
  {/snippet}
</ToggleDrawer>
