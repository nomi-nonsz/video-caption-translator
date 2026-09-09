import {
  CueChunk,
  CueShort,
  Message,
  TranslateParams
} from "./types";
import { load } from "./utils";

// @ts-ignore
import prompt from "../prompt/translator.md" with { type: "file" }
// @ts-ignore
import schema from "../schema/cues.json" with { type: "file" }

export const SYSTEM_PROMPT = load(prompt);
export const SCHEMA = JSON.parse(load(schema as unknown as string));

type BuildPromptOptions = {
  previousCues: CueShort[],
  chunk: CueChunk
} & TranslateParams

export function buildMessages(options: BuildPromptOptions) {
  const messages: Message[] = [];
  const prompt = [
    // options.sourceLang ? options.sourceLang : '',
    `target_language: ${options.targetLang}`,
    `tone: ${options.tone}`,
    'Translate this cue array:',
    JSON.stringify(options.chunk)
  ].join("\n");

  if (options.previousCues) {
    messages.push({
      role: 'user',
      content: "previous cues:\n" + JSON.stringify(options.previousCues)
    })
  }

  messages.push({
    role: 'user',
    content: prompt
  })
  
  return messages;
}