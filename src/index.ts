#!/usr/bin/env node

import { Command, Option } from 'commander';
import { AVAILABLE_LANG, listSubs } from './lib/lang';
import { translate } from './translate';
import { getModels, listModels } from './lib/translation-model';

const validOutputFormats = ['video', 'srt', 'vtt'];

const program = new Command();

const optionParser = {
  lang(v: string) {
    if (!AVAILABLE_LANG.includes(v)) {
      console.error(`error: invalid target language '${v}'. use --listsub to see the available languages`);
      process.exit(1);
    }
    return v;
  },
  sourceLang(v: string) {
    if (v && !AVAILABLE_LANG.includes(v)) {
      console.error(`error: invalid source language '${v}'. use --listsub to see the available languages`);
      process.exit(1);
    }
  },
  number(name: string, v: string) {
    const parsed = Number.parseInt(v);
    if (Number.isNaN(parsed)) {
      console.error(`error: ${name} must be a number!`);
      process.exit(1);
    }
    return v;
  },
  float(name: string, v: string) {
    const parsed = Number.parseFloat(v);
    if (Number.isNaN(parsed)) {
      console.error(`error: ${name} must be a floating number!`);
      process.exit(1);
    }
    return v;
  },
  size: (v: string) => optionParser.number('chunk size', v),
  contextSize: (v: string) => optionParser.number('context size', v),
  temperature: (v: string) => optionParser.float('temperature', v)
}

program
  .description('video-caption-translator: Translate video caption to any language with AI!')
  .version('1.0.1')
  .option("-l, --lang <language>", "pick the target language to translate", optionParser.lang, "en")
  .addOption(new Option("-t, --type <type>", "output type").choices(validOutputFormats).default('video'))
  .option("-o, --output <path>", "output of translated subtitles")
  .optionsGroup('Translating options:')
  .option('-m, --model <model>', "specify model for translating (example: -m anthropic/claude-opus-4-8). if no model is cpecified, the first model will be used.")
  .option('-s, --size <number>', "number of cues in a chunk", optionParser.size, "15")
  .option("--think", "enhance higher thinking and model reasoning, translation process will take longer")
  .option("--temperature <float>", "control the response randomness (default: 0.3)", optionParser.temperature)
  .option("--tone <tone>", "pick the tone for translate", "neutral")
  .option("--context-size <number>", "how many cues were previously used as context", optionParser.contextSize, "4")
  .option("--source-lang <language>", "pick the source language, default: auto-detected", optionParser.sourceLang)
  .optionsGroup('Listings:')
  .option("--list-subs", "list all available subtitles")
  .option("--list-models", "list available ollama models")
  .argument('[file]', 'input video. supported format: mkv, mp4, vtt')
  .action(async (file, options) => {
    options.size = Number.parseInt(options.size);
    options.contextSize = Number.parseInt(options.contextSize);

    if (!file) {
      if (options.listSubs) {
        listSubs();
        return;
      }
      
      if (options.listModels) {
        await listModels();
        return;
      }

      console.error("error: missing required argument 'file'");
      process.exit(1);
    }

    if (!options.output) {
      console.error("error: required option '-o, --output <path>' not specified");
      process.exit(1);
    }

    if (!options.model) {
      console.warn("warning: no model specified, selecting the first model...");
      const models = await getModels();
      if (models.length < 1) {
        console.error("error: no models are available.");
        process.exit(1);
      }
      options.model = (models.length > 0 ? models[0] : '');
    }

    if (options.size < options.contextSize) {
      console.error("error: the context size must be higher than the chunk size");
      process.exit(1);
    }

    await translate(file, options.output, {
      format: options.type,
      chunkSize: options.size,
      model: options.model,
      params: {
        contextSize: options.contextSize,
        sourceLang: options.sourceLang,
        targetLang: options.lang,
        tone: options.tone,
        ...(options.temperature ? {temperature: Number.parseFloat(options.temperature)} : {}),
        think: options.think
      }
    });
  })

program.parse();