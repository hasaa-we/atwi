
export enum AppStatus {
  IDLE = 'IDLE',
  PROCESSING_VIDEO = 'PROCESSING_VIDEO', // Converting file
  ANALYZING = 'ANALYZING', // ASR + Translate
  READY_TO_DUB = 'READY_TO_DUB', // Editing phase
  SYNTHESIZING = 'SYNTHESIZING', // TTS Generation
  EXPORTING = 'EXPORTING', // Recording final output
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface DubSegment {
  id: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  originalText: string;
  translatedText: string;
  isSynthesizing?: boolean;
  audioUrl?: string; // Blob URL of the generated TTS
  speakerLabel: string; // "Speaker 1", "Speaker 2"
}

export interface LanguageOption {
  code: string;
  name: string;
  flag: string;
  dialects?: string[]; // List of available dialects
}

export const LANGUAGES: LanguageOption[] = [
  { 
    code: 'ar', 
    name: 'Arabic', 
    flag: '🇸🇦',
    dialects: [
      'Modern Standard Arabic', 
      'Egyptian (Masri)', 
      'Levantine (Syrian/Lebanese)', 
      'Gulf (Khaleeji)', 
      'Maghrebi (Moroccan/Tunisian)',
      'Iraqi'
    ]
  },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
];

export interface TTSVoice {
  name: string;
  gender: 'Male' | 'Female';
  id: string; // Gemini voice name
}

export const VOICES: TTSVoice[] = [
  { name: 'Kore', gender: 'Female', id: 'Kore' },
  { name: 'Puck', gender: 'Male', id: 'Puck' },
  { name: 'Fenrir', gender: 'Male', id: 'Fenrir' },
  { name: 'Charon', gender: 'Male', id: 'Charon' },
  { name: 'Zephyr', gender: 'Female', id: 'Zephyr' },
];

export interface SpeakerMap {
  [speakerLabel: string]: string; // Maps "Speaker 1" -> "Kore"
}

export interface DubbingStyleOption {
  id: string;
  name: string;
  description: string;
}

export const DUBBING_STYLES: DubbingStyleOption[] = [
  { id: 'Natural', name: 'Natural / Conversational', description: 'Balanced pacing with natural pauses (ellipses) and breathing room.' },
  { id: 'Dramatic', name: 'Dramatic / Emotive', description: 'High intensity, punchy sentences, and emphatic stress using exclamation marks.' },
  { id: 'Formal', name: 'Formal / Documentary', description: 'Steady, authoritative pacing. clear enunciation, no slang.' },
  { id: 'Energetic', name: 'Energetic / Fast', description: 'Upbeat, faster pacing, concise wording for action sequences.' },
];
