import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SpeechService {
  readonly isEnabled = signal<boolean>(true);
  readonly isSupported = signal<boolean>(false);
  readonly availableVoices = signal<SpeechSynthesisVoice[]>([]);
  readonly selectedVoiceIndex = signal<number>(0);
  
  private synth: SpeechSynthesis | null = null;
  private defaultVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.isSupported.set(true);
      
      // Wait for voices to load
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices(): void {
    if (!this.synth) return;
    
    const voices = this.synth.getVoices();
    this.availableVoices.set(voices);
    
    // Prefer Spanish voice
    const spanishIndex = voices.findIndex(v => v.lang.startsWith('es'));
    const selectedIndex = spanishIndex >= 0 ? spanishIndex : 0;
    
    this.selectedVoiceIndex.set(selectedIndex);
    this.defaultVoice = voices[selectedIndex] || null;
    
    console.log('🔊 Voces disponibles:', voices.length);
    console.log('🔊 Voz seleccionada:', this.defaultVoice?.name, this.defaultVoice?.lang);
    
    // Log all available voices for debugging
    voices.forEach((voice, index) => {
      console.log(`  ${index}: ${voice.name} (${voice.lang})${voice.default ? ' [DEFAULT]' : ''}`);
    });
  }

  toggle(): void {
    this.isEnabled.update(v => !v);
    if (!this.isEnabled() && this.synth) {
      this.synth.cancel();
    }
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled.set(enabled);
    if (!enabled && this.synth) {
      this.synth.cancel();
    }
  }

  /**
   * Set the voice to use by index
   */
  setVoice(index: number): void {
    const voices = this.availableVoices();
    if (index >= 0 && index < voices.length) {
      this.selectedVoiceIndex.set(index);
      this.defaultVoice = voices[index];
      console.log('🔊 Voz cambiada a:', this.defaultVoice.name, this.defaultVoice.lang);
    }
  }

  /**
   * Get current voice info
   */
  getCurrentVoice(): { name: string; lang: string } | null {
    if (!this.defaultVoice) return null;
    return {
      name: this.defaultVoice.name,
      lang: this.defaultVoice.lang
    };
  }

  /**
   * Get special phrase for certain bingo numbers
   */
  private getSpecialPhrase(number: number): string {
    const specialPhrases: { [key: number]: string } = {
      11: 'chúpalo entonces',
      13: 'más me crece',
      22: 'par de patos',
      69: 'ay que rico'
    };
    
    return specialPhrases[number] || '';
  }

  /**
   * Announce a bingo ball with its letter
   * @param letter The BINGO letter (B, I, N, G, O)
   * @param number The ball number (1-75)
   */
  announceBall(letter: string, number: number): void {
    if (!this.isEnabled() || !this.synth || !this.isSupported()) {
      return;
    }

    // Cancel any ongoing speech
    this.synth.cancel();

    // Build text with special phrase if applicable
    let text = `${letter}, ${number}`;
    const specialPhrase = this.getSpecialPhrase(number);
    if (specialPhrase) {
      text += `, ${specialPhrase}`;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    if (this.defaultVoice) {
      utterance.voice = this.defaultVoice;
    }
    
    utterance.lang = 'es-ES';
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    console.log('🔊 Anunciando:', text);
    this.synth.speak(utterance);
  }

  /**
   * Test the speech synthesis
   */
  test(): void {
    this.announceBall('B', 7);
  }
}
