import type { TabData } from '../../types/tabData';
import { backgroundDataController } from '../index';
import { TextToSpeechService } from '../../lib/services/textToSpeechService.svelte';

/**
 * Handle text rewriting for TTS (Step 1)
 */
export async function handleTtsTextGeneration(
  url: string,
  sendResponse?: (response: any) => void
) {
  try {
    console.log('🔊 Starting TTS text generation for URL:', url);

    // First, load the tab data for this URL
    const tabData = await backgroundDataController.loadData(url);
    if (!tabData) {
      console.error('❌ No tab data found for URL:', url);
      const errorResponse = { 
        success: false, 
        error: 'No content data found for this URL. Please extract content first.' 
      };
      if (sendResponse) sendResponse(errorResponse);
      return errorResponse;
    }

    // Use the TextToSpeechService to rewrite text only
    const rewriteResult = await TextToSpeechService.rewriteTextForTTS(
      tabData.content.text, 
      tabData.content.title
    );
    
    if (rewriteResult.success && rewriteResult.rewrittenText) {
      console.log('✅ TTS text rewriting completed successfully');
      const successResponse = { 
        success: true, 
        rewrittenText: rewriteResult.rewrittenText
      };
      if (sendResponse) sendResponse(successResponse);
      return successResponse;
    } else {
      console.error('❌ TTS text rewriting failed:', rewriteResult.error);
      const errorResponse = { 
        success: false, 
        error: rewriteResult.error || 'Failed to rewrite text for TTS' 
      };
      if (sendResponse) sendResponse(errorResponse);
      return errorResponse;
    }

  } catch (error) {
    console.error('❌ Error in TTS text generation process:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorResponse = { success: false, error: errorMessage };
    if (sendResponse) sendResponse(errorResponse);
    return errorResponse;
  }
}

/**
 * Handle audio generation from text (Step 2)
 */
export async function handleTtsAudioGeneration(
  text: string,
  voice: string,
  sendResponse?: (response: any) => void
) {
  try {
    console.log('🔊 Starting TTS audio generation, text length:', text.length);

    // Use the TextToSpeechService to generate audio only
    const audioResult = await TextToSpeechService.generateAudio(text, voice);
    
    if (audioResult.success && audioResult.audioBlob) {
      console.log('✅ TTS audio generation completed successfully');
      
      // Convert blob to base64 for Chrome messaging (ArrayBuffer doesn't serialize properly)
      const arrayBuffer = await audioResult.audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Convert to base64 in chunks to avoid stack overflow
      let binaryString = '';
      const chunkSize = 8192; // Process in 8KB chunks
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        binaryString += String.fromCharCode(...chunk);
      }
      const base64String = btoa(binaryString);
      
      console.log('🔧 Converted audio to base64, length:', base64String.length);
      
      const successResponse = { 
        success: true, 
        audioData: base64String,
        audioType: 'audio/wav'
        // Note: Sending base64 string instead of ArrayBuffer since Chrome messaging serializes data
      };
      if (sendResponse) sendResponse(successResponse);
      return successResponse;
    } else {
      console.error('❌ TTS audio generation failed:', audioResult.error);
      const errorResponse = { 
        success: false, 
        error: audioResult.error || 'Failed to generate audio' 
      };
      if (sendResponse) sendResponse(errorResponse);
      return errorResponse;
    }

  } catch (error) {
    console.error('❌ Error in TTS audio generation process:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorResponse = { success: false, error: errorMessage };
    if (sendResponse) sendResponse(errorResponse);
    return errorResponse;
  }
}

/**
 * Handle text-to-speech generation request for a specific URL (Legacy - full pipeline)
 */
export async function handleTextToSpeechGeneration(
  url: string, 
  voice?: string,
  sendResponse?: (response: any) => void
) {
  try {
    console.log('🔊 Starting TTS generation for URL:', url);

    // First, load the tab data for this URL
    const tabData = await backgroundDataController.loadData(url);
    if (!tabData) {
      console.error('❌ No tab data found for URL:', url);
      const errorResponse = { 
        success: false, 
        error: 'No content data found for this URL. Please extract content first.' 
      };
      if (sendResponse) sendResponse(errorResponse);
      return errorResponse;
    }

    // Log current TTS status before update
    console.log('🔊 Current TTS status:', tabData.processing?.textToSpeech);
    
    // Update processing status to indicate we're generating
    await backgroundDataController.saveData(url, {
      processing: { 
        textToSpeech: { isGenerating: true, error: null }
      }
    }); 

    // Use the TextToSpeechService to generate TTS
    const ttsResult = await TextToSpeechService.generateTextToSpeech(tabData, { voice });
    
    if (ttsResult.success && ttsResult.textToSpeech) {
      // Update with successful TTS (but don't store the audio blob/URL in Chrome storage)
      const ttsDataForStorage = {
        ...ttsResult.textToSpeech,
        audioUrl: null // Don't store the blob URL in Chrome storage
      };
      
      const saveResult = await backgroundDataController.saveData(url, {
        analysis: { 
          textToSpeech: ttsDataForStorage
        },
        processing: { 
          textToSpeech: { isGenerating: false, error: null }
        }
      });
      
      console.log('🔊 Save result:', saveResult);
      
      // Verify the save by loading the data again
      const verifyData = await backgroundDataController.loadData(url, true); // Force refresh
      console.log('🔊 Verified TTS after save:', verifyData?.analysis?.textToSpeech?.id);

      console.log('✅ TTS generation completed successfully');
      
      // Convert blob to base64 for Chrome messaging (ArrayBuffer doesn't serialize properly)
      let base64String = null;
      if (ttsResult.audioBlob) {
        const arrayBuffer = await ttsResult.audioBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Convert to base64 in chunks to avoid stack overflow
        let binaryString = '';
        const chunkSize = 8192; // Process in 8KB chunks
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.slice(i, i + chunkSize);
          binaryString += String.fromCharCode(...chunk);
        }
        base64String = btoa(binaryString);
        console.log('🔧 Converted audio to base64, length:', base64String.length);
      }
      
      const successResponse = { 
        success: true, 
        textToSpeech: ttsResult.textToSpeech,
        audioData: base64String,
        audioType: 'audio/wav'
        // Note: Sending base64 string instead of ArrayBuffer since Chrome messaging serializes data
      };
      if (sendResponse) sendResponse(successResponse);
      return successResponse;
    } else {
      // Update processing status to error
      await backgroundDataController.saveData(url, {
        processing: { 
          textToSpeech: { isGenerating: false, error: ttsResult.error || 'Unknown error' }
        }
      });
      
      console.error('❌ TTS generation failed:', ttsResult.error);
      const errorResponse = { 
        success: false, 
        error: ttsResult.error || 'Failed to generate text-to-speech' 
      };
      if (sendResponse) sendResponse(errorResponse);
      return errorResponse;
    }

  } catch (error) {
    console.error('❌ Error in TTS generation process:', error);
    
    // Update processing status to error
    try {
      await backgroundDataController.saveData(url, {
        processing: { 
          textToSpeech: { isGenerating: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      });
    } catch (saveError) {
      console.error('❌ Failed to update TTS processing status:', saveError);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorResponse = { success: false, error: errorMessage };
    if (sendResponse) sendResponse(errorResponse);
    return errorResponse;
  }
}

/**
 * Get TTS status for a URL
 */
export async function getTtsStatus(url: string): Promise<{ 
  textToSpeech: any | null; 
  isGenerating: boolean; 
  error: string | null 
}> {
  try {
    const tabData = await backgroundDataController.loadData(url);
    return {
      textToSpeech: tabData?.analysis?.textToSpeech || null,
      isGenerating: tabData?.processing?.textToSpeech?.isGenerating || false,
      error: tabData?.processing?.textToSpeech?.error || null
    };
  } catch (error) {
    console.error('❌ Error getting TTS status:', error);
    return { 
      textToSpeech: null, 
      isGenerating: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
} 