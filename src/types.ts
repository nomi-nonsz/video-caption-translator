import type { Cue as DefaultCue } from "subtitle";

export type Cue = { index: number } & DefaultCue
export type CueShort = {
  index: number,
  text: string
}
export type CueChunk = Cue[];

export type TranslateParams = {
  sourceLang?: string,
  targetLang: string,
  tone: string,
  domain?: string
}