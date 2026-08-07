import { Ollama } from 'ollama'

import 'dotenv/config';
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
  scheme: SCHEMA
});

export async function getModels() {
  const res = await ollama.list();
  return res.models;
}

export async function listModels() {
  const models = (await getModels()).sort((a, b) => a.name.localeCompare(b.name));

  console.log("List models:");
  for (const model of models) {
    console.log(`- ${model.name}`);
  }
}

export async function translateChunkTest(chunk: CueChunk, model: string, previousCues: CueShort[], options: TranslateParams) {
  const prompt = [
    `target_language: ${options.targetLang}`,
    // `domain: `
    `tone: ${options.tone}`,
    previousCues.length > 0 ? `Previous translated cues:\n${JSON.stringify(previousCues)}` : '',
    'Translate this cue array:',
    JSON.stringify(chunk)
  ].join("\n");

  console.log(prompt);
  
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
      temperature: 0.3
    },
    system: SYSTEM_PROMPT,
    think: false
  })

  // console.log(res);
  console.log(JSON.parse(res?.message.content || ''));

  return JSON.parse(res.response) || [];
}

export async function translateAllChunks(chunks: CueChunk[], model: string, options: TranslateParams) {
  let previousCues: CueShort[] = [];
  let results: Cue[] = [];
  let i = 1;
  try {
    const targetLang = getLanguageName(options.targetLang);

    for (const chunk of chunks) {
      console.log(`[video-caption-translator] [${Math.floor((i/chunks.length) * 100)}/100] Translating cue ${chunk[0]?.index}-${chunk[chunk.length-1]?.index}`);
      const translated = (await translateChunkTest(chunk, model, previousCues, { ...options, targetLang })) as Cue[];
      results = [...results, ...translated];
      previousCues = translated.slice(-4).map((cue) => ({
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