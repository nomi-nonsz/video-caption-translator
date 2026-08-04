import { Ollama } from 'ollama'

import 'dotenv/config';
import { Cue, CueChunk, CueShort } from './types';

const SYSTEM_PROMPT = `You are a professional subtitle translation engine.
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
- tone: "formal" | "informal" | "casual" | "neutral" (default: natural/neutral)
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
empty.
`;

async function test() {
  const ollama = new Ollama({
    host: 'https://ollama.com',
    headers: { Authorization: 'Bearer ' + process.env.OLLAMA_API_KEY },
  })
  
  const response = await ollama.generate({
    model: 'gpt-oss:120b',
    prompt: "Write one sentence about unicorn",
    stream: false,
    think: false
  })
  
  console.log(response);
}

export function translateChunk(chunk: CueChunk, targetLang: string, previousCues: CueShort[]) {
  const prompt = [
    `target_language: ${targetLang}`,
    // `domain: `
    'tone: neutral',
    previousCues.length > 0 ? `Previous translated cues:\n${JSON.stringify(previousCues)}` : '',
    'Translate this cue array:',
    JSON.stringify(chunk)
  ].join("\n");

  // console.log(prompt);

  return [...chunk];
}