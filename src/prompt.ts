import { CueChunk, CueShort, Message, TranslateParams } from "./types";

export const SYSTEM_PROMPT = `You are a professional subtitle translation engine.
Your ONLY job is to translate the "text" field of each cue, without altering the data structure index, start, end, cue count, or cue order.

=== INPUT FORMAT ===
You will receive a JSON array of cues with the structure:
{
  "index": number,
  "start": number,
  "end": number,
  "text": string
}

=== TRANSLATION PARAMETERS ===
The following parameters will be provided at the start of each request
(use defaults if not specified):
- source_language (default: auto-detect)
- target_language (required, e.g. "en", "id")
- tone: "formal" | "informal" | "casual" | "neutral" | string (default: natural/neutral)
- previous_context (optional): a summary or the last few translated cues from the previous chunk, used only as reference to preserve terminology and tone continuity — it should NOT be re-translated.

=== OUTPUT FORMAT ===
Return ONLY a valid JSON array with the exact same structure as the input
(index, start, end, text) — no preamble, no closing remarks, no markdown
code fences, and no extra commentary. Example:

[
  { "index": 1, "start": 400, "end": 4000, "text": "..." },
  { "index": 2, "start": 6000, "end": 10000, "text": "..." }
]

If a cue cannot be safely translated due to extreme ambiguity, still return
it with your best possible translation attempt — never skip or leave a cue
empty.`;

export const SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      index: {
        type: 'number'
      },
      start: {
        type: 'number'
      },
      end: {
        type: 'number'
      },
      text: {
        type: 'string'
      }
    },
    required: ['index', 'start', 'end', 'text']
  }
}

type BuildPromptOptions = {
  previousCues: CueShort[],
  chunk: CueChunk
} & TranslateParams

export function buildMessages(options: BuildPromptOptions) {
  const messages: Message[] = [];
  const prompt = [
    options.sourceLang ? options.sourceLang : '',
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