import type { TtsStatus } from '../../types/ttsStatus';
import type { TtsState } from '../../types/ttsState';
import { TextToSpeechService } from '../services/textToSpeechService.svelte';

class TextToSpeechManager {
  private state = $state<TtsState>({
    isGenerating: false,
    ttsStatus: 'idle',
    ttsError: null,
    selectedVoice: 'Arista-PlayAI' // Default voice
  });

  // Current audio state (not persisted)
  private audioState = $state<{
    audioUrl: string | null;
    audioElement: HTMLAudioElement | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
  }>({
    audioUrl: null,
    audioElement: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0
  });

  // Bound event handler references for proper cleanup
  private audioHandlers: {
    loadedmetadata?: () => void;
    timeupdate?: () => void;
    ended?: () => void;
    play?: () => void;
    pause?: () => void;
  } = {};

  // Getters for reactive state
  get isGenerating() {
    return this.state.isGenerating;
  }

  get ttsStatus() {
    return this.state.ttsStatus;
  }

  get ttsError() {
    return this.state.ttsError;
  }

  get selectedVoice() {
    return this.state.selectedVoice;
  }

  get audioUrl() {
    return this.audioState.audioUrl;
  }

  get isPlaying() {
    return this.audioState.isPlaying;
  }

  get currentTime() {
    return this.audioState.currentTime;
  }

  get duration() {
    return this.audioState.duration;
  }

  // Set selected voice
  setSelectedVoice(voice: string) {
    this.state.selectedVoice = voice;
  }

  // Generate TTS functionality with optional refresh callback
  async handleGenerateTts(url: string | null, onSuccess?: () => void) {
    if (!url || this.state.isGenerating) {
      return;
    }

    this.state.isGenerating = true;
    this.state.ttsStatus = 'rewriting';
    this.state.ttsError = null;
    
    // Clean up any existing audio
    this.cleanupAudio();

    try {
      console.log('🔊 Starting TTS generation for:', url);
      console.log('🔊 Using voice:', this.state.selectedVoice);
      
      const response = await chrome.runtime.sendMessage({
        action: 'generateTextToSpeech',
        url: url,
        voice: this.state.selectedVoice
      });

      if (response.success) {
        console.log('✅ TTS generation successful');
        this.state.ttsStatus = 'success';
        this.state.ttsError = null;
        
        // Set up audio if we received it (create URL from base64 data)
        if (response.audioData && typeof response.audioData === 'string') {
          // Clean up any existing audio URL
          this.cleanupAudio();
          
          // Convert base64 to Blob and create URL
          const audioType = response.audioType || 'audio/wav';
          const binaryString = atob(response.audioData);
          const uint8Array = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            uint8Array[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([uint8Array], { type: audioType });
          const audioUrl = URL.createObjectURL(blob);
          this.audioState.audioUrl = audioUrl;
          this.setupAudioElement(audioUrl);
        }
        
        // Call the success callback to refresh the panel
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 100); // Small delay to ensure background processing is complete
        }
        
        // Reset status after 3 seconds
        setTimeout(() => {
          this.state.ttsStatus = 'idle';
        }, 3000);
      } else {
        console.error('❌ TTS generation failed:', response.error);
        this.state.ttsStatus = 'error';
        this.state.ttsError = response.error;
        
        // Reset status after 5 seconds
        setTimeout(() => {
          this.state.ttsStatus = 'idle';
          this.state.ttsError = null;
        }, 5000);
      }
    } catch (error) {
      console.error('❌ TTS generation error:', error);
      this.state.ttsStatus = 'error';
      this.state.ttsError = error instanceof Error ? error.message : 'Unknown error';
      
      // Reset status after 5 seconds
      setTimeout(() => {
        this.state.ttsStatus = 'idle';
        this.state.ttsError = null;
      }, 5000);
    } finally {
      this.state.isGenerating = false;
    }
  }

  // Set up audio element for playback
  private setupAudioElement(audioUrl: string) {
    // Clean up old handlers first
    this.removeAudioHandlers();

    this.audioState.audioElement = new Audio(audioUrl);
    const audio = this.audioState.audioElement;

    // Create bound handler references so we can remove them later
    this.audioHandlers.loadedmetadata = () => {
      this.audioState.duration = audio.duration;
    };
    this.audioHandlers.timeupdate = () => {
      this.audioState.currentTime = audio.currentTime;
    };
    this.audioHandlers.ended = () => {
      this.audioState.isPlaying = false;
      this.audioState.currentTime = 0;
    };
    this.audioHandlers.play = () => {
      this.audioState.isPlaying = true;
    };
    this.audioHandlers.pause = () => {
      this.audioState.isPlaying = false;
    };

    audio.addEventListener('loadedmetadata', this.audioHandlers.loadedmetadata);
    audio.addEventListener('timeupdate', this.audioHandlers.timeupdate);
    audio.addEventListener('ended', this.audioHandlers.ended);
    audio.addEventListener('play', this.audioHandlers.play);
    audio.addEventListener('pause', this.audioHandlers.pause);
  }

  // Remove audio event handlers using the stored references
  private removeAudioHandlers() {
    const audio = this.audioState.audioElement;
    if (!audio) return;

    if (this.audioHandlers.loadedmetadata) audio.removeEventListener('loadedmetadata', this.audioHandlers.loadedmetadata);
    if (this.audioHandlers.timeupdate) audio.removeEventListener('timeupdate', this.audioHandlers.timeupdate);
    if (this.audioHandlers.ended) audio.removeEventListener('ended', this.audioHandlers.ended);
    if (this.audioHandlers.play) audio.removeEventListener('play', this.audioHandlers.play);
    if (this.audioHandlers.pause) audio.removeEventListener('pause', this.audioHandlers.pause);

    this.audioHandlers = {};
  }

  // Play/pause audio
  async togglePlayback() {
    if (!this.audioState.audioElement) return;
    
    if (this.audioState.isPlaying) {
      this.audioState.audioElement.pause();
    } else {
      try {
        await this.audioState.audioElement.play();
      } catch (error) {
        console.error('❌ Audio playback failed:', error);
        this.state.ttsError = 'Audio playback failed';
      }
    }
  }

  // Seek to specific time
  seekTo(time: number) {
    if (this.audioState.audioElement) {
      this.audioState.audioElement.currentTime = time;
    }
  }

  // Clean up audio resources
  cleanupAudio() {
    if (this.audioState.audioElement) {
      this.audioState.audioElement.pause();
      this.removeAudioHandlers();
      this.audioState.audioElement = null;
    }
    
    if (this.audioState.audioUrl) {
      TextToSpeechService.cleanupAudioUrl(this.audioState.audioUrl);
      this.audioState.audioUrl = null;
    }
    
    this.audioState.isPlaying = false;
    this.audioState.currentTime = 0;
    this.audioState.duration = 0;
  }

  // Get CSS classes for TTS button based on status
  getTtsButtonClass() {
    if (this.state.ttsStatus === 'success') {
      return 'px-6 py-1 rounded text-md text-white bg-green-600 border border-green-600 hover:bg-green-700 flex items-center gap-1';
    } else if (this.state.ttsStatus === 'error') {
      return 'px-6 py-1 rounded text-md text-white bg-red-600 border border-red-600 hover:bg-red-700 flex items-center gap-1';
    } else if (this.state.ttsStatus === 'rewriting' || this.state.ttsStatus === 'generating-audio') {
      return 'px-6 py-1 rounded text-md text-white bg-blue-600 border border-blue-600 hover:bg-blue-700 flex items-center gap-1';
    }
    return 'px-6 py-1 rounded text-md text-white bg-gray-800 border border-gray-800 hover:bg-gray-900 flex items-center gap-1';
  }

  // Get available voices
  getAvailableVoices() {
    return TextToSpeechService.getAvailableVoices();
  }

  // Format time for display
  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Reset TTS state
  reset() {
    this.cleanupAudio();
    this.state.isGenerating = false;
    this.state.ttsStatus = 'idle';
    this.state.ttsError = null;
  }
}

// Export singleton instance
export const textToSpeechManager = new TextToSpeechManager(); 