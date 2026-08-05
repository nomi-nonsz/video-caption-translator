import type { Cue as DefaultCue } from "subtitle";

export type Cue = { index: number } & DefaultCue
export type CueShort = {
  index: number,
  text: string
}
export type CueChunk = Cue[];

export type TranslateTone = 'formal' | 'informal' | 'casual' | 'neutral';

export type TranslateParams = {
  sourceLang?: string,
  targetLang: string,
  tone: TranslateTone,
  domain?: string
}

export type SubtitleFormat = 'SRT' | 'WebVTT';
export type OutputFormat = 'video' | 'srt' | 'vtt';