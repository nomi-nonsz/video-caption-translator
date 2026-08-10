import {
  Cue,
  CueChunk,
  CueShort,
  Message,
  TranslateParams
} from './types';
import { getLanguageName } from './lang';
import { buildMessages, SCHEMA, SYSTEM_PROMPT } from './prompt';
import Model from './model';
import { Ollama } from 'ollama';

const ollama = ollamaInit();

function ollamaInit() {
  if (process.env.OLLAMA_HOST || process.env.OLLAMA_API_KEY) {
    return new Ollama({
      host: process.env.OLLAMA_HOST || 'https://ollama.com',
      headers: { Authorization: 'Bearer ' + process.env.OLLAMA_API_KEY },
    })
  }
  return new Ollama();
}

const client = new Model({
  ollama: {
    host: process.env.OLLAMA_HOST,
    apiKey: process.env.OLLAMA_API_KEY,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? ''
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? ''
  },
  scheme: SCHEMA
});

export async function getModels() {
  const models = await client.list();
  return models;
}

export async function listModels() {
  const models = (await getModels());

  console.log("List models:");
  for (const model of models) {
    console.log(`- ${model}`);
  }
}

export async function translateChunkTest(chunk: CueChunk, model: string, previousCues: CueShort[], options: TranslateParams) {
  const messages = buildMessages({
    chunk,
    previousCues,
    targetLang: options.targetLang,
    tone: options.tone,
  });

  console.log(messages);
  
  await new Promise(resolve => setTimeout(resolve, 100));

  return chunk.map(c => ({ ...c, text: `[Translated] ${c.text}` }));
}

export async function translateChunk(chunk: CueChunk, model: string, previousCues: CueShort[], options: TranslateParams) {
  const messages: Message[] = buildMessages({
    chunk,
    previousCues,
    targetLang: options.targetLang,
    tone: options.tone,
  })

  const res = await client.generate({
    messages,
    model,
    options: {
      temperature: options.temperature,
    },
    system: SYSTEM_PROMPT,
    think: !!options.think
  })

  const cues = JSON.parse(res.message.content);

  console.log(cues);

  return (cues.cues ?? cues) || [];
}

export async function translateAllChunks(chunks: CueChunk[], model: string, options: TranslateParams) {
  const contextSize = Math.abs(options.contextSize ?? 4);
  let previousCues: CueShort[] = [];
  let results: Cue[] = [];
  let i = 1;
  try {
    const targetLang = getLanguageName(options.targetLang);

    for (const chunk of chunks) {
      console.log(`[video-caption-translator] [${Math.floor((i/chunks.length) * 100)}/100] Translating cue ${chunk[0]?.index}-${chunk[chunk.length-1]?.index}`);
      const translated = (await translateChunk(chunk, model, previousCues, { ...options, targetLang })) as Cue[];
      results = [...results, ...translated];
      previousCues = translated.slice(-contextSize).map((cue) => ({
        index: cue.index,
        text: cue.text
      }));
      i++;
    }
  } catch (err) {
    console.error(err);
    console.error("[video-caption-translator] Error: failed to translating the subtitle");
    process.exit(1);
  } finally {
    return results;
  }
}