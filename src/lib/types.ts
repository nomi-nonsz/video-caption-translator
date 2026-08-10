import type { Cue as DefaultCue } from "subtitle";

export type Cue = { index: number } & DefaultCue
export type CueShort = {
  index: number,
  text: string
}
export type CueChunk = Cue[];

export type TranslateTone = 'formal' | 'informal' | 'casual' | 'neutral' | string;
export type SubtitleFormat = 'SRT' | 'WebVTT';
export type OutputFormat = 'video' | 'srt' | 'vtt';

export type TranslateParams = {
  sourceLang?: string,
  targetLang: string,
  tone: TranslateTone,
  domain?: string,
  temperature?: number,
  think?: boolean,
  contextSize?: number
}

export type TranslateOption = {
  format: OutputFormat,
  chunkSize: number,
  model: string,
  params: TranslateParams
}

export interface ModelConfig {
  openai?: {
    apiKey: string;
  };
  anthropic?: {
    apiKey: string;
  };
  ollama?: {
    host?: string | undefined;
    apiKey?: string | undefined;
  };
  scheme?: any;
}

export type Message = {
  role: 'assistant' | 'user' | 'system',
  content: string
};

export interface GenerateRequest {
  model: string;
  messages: Message[],
  system?: string;
  think?: boolean;
  options?: any;
}

export interface GenerateResponse {
  message: Message;
}