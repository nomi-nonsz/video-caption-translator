import {
  Cue,
  CueChunk,
  CueShort,
  Message,
  TranslateParams
} from './types';

import Model from './model';
import { log } from './logger';
import { getLanguageName } from './lang';
import { buildMessages, SCHEMA, SYSTEM_PROMPT } from './prompt';
import chalk from 'chalk';

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
  google: {
    apiKey: process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? ''
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY ?? ''
  },
  xai: {
    apiKey: process.env.XAI_API_KEY ?? process.env.GROK_API_KEY ?? ''
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
  if (models.filter(m => m.includes('/') && (m.split('/')[0] != 'ollama' || m.split('/')[0] != 'xai')).length > 0) {
    console.log(chalk.yellow.inverse('\n ! ') + chalk.yellow(" Warning: Some of the models shown may not support text generation, please check the provider's official documentation."));
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
  try {
    const targetLang = getLanguageName(options.targetLang);

    // can't believe i had been using too much for of
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      log.info(`[${Math.floor((i/chunks.length) * 100)}/100] Translating cue ${chunk[0]?.index}-${chunk[chunk.length-1]?.index}`);
      const translated = (await translateChunk(chunk, model, previousCues, { ...options, targetLang })) as Cue[];
      results = [...results, ...translated];
      previousCues = translated.slice(-contextSize).map((cue) => ({
        index: cue.index,
        text: cue.text
      }));
    }
  } catch (err) {
    if (err instanceof Error) {
      log.error(err.message);
    }
    log.error("failed to translating the subtitle");
    process.exit(1);
  } finally {
    return results;
  }
}