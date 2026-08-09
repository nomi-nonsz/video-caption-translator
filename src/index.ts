#!/usr/bin/env bun

import { Command } from 'commander';
import { input, password } from '@inquirer/prompts';

import { APP_NAME, APP_VERSION, ConfigMap, ConfigType, getConfig, resetConfig, updateConfig } from './lib/config';
import { AVAILABLE_LANG, listSubs } from './lib/lang';
import { translate } from './translate';
import { getModels, listModels } from './lib/translation-model';
import { isKeyExist, KeyConfig, resetKeys, saveKeys } from './lib/keys';

const validOutputFormats = ['video', 'srt', 'vtt'];

const program = new Command();

program
  .description(`${APP_NAME}: Translate video caption to any language with AI!`)
  .version(APP_VERSION)
  .option("-l, --lang <language>", "pick the target language to translate", "en")
  .option("-t, --type <type>", "output type. 'video', 'srt', 'vtt'", "video")
  .option("-o, --output <path>", "output of translated caption")
  .option('-s, --size <size>', "chunk size per cue", "15")
  .option('-m, --model <model>', "specify LLM model for translating. if no model is specify, the first model will be used.")
  .option("--tone <tone>", "pick the tone for translate", "neutral")
  .option("--source-lang <language>", "pick the source language, default: auto-detected")
  .option("--list-subs", "iist all available subtitles")
  .option("--list-models", "iist available ollama models")
  .argument('[file]', 'input video. supported format: mkv, mp4, vtt')
  .action(async (file, options) => {
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

    if (!AVAILABLE_LANG.includes(options.lang)) {
      console.error(`error: invalid target language '${options.lang}'. use --listsub to see the available languages`);
      process.exit(1);
    }

    if (options.sourceLang && !AVAILABLE_LANG.includes(options.sourceLang)) {
      console.error(`error: invalid source language '${options.sourceLang}'. use listsub to see the available languages`);
      process.exit(1);
    }

    if (!validOutputFormats.includes(options.type)) {
      console.error(`error: invalid output type '${options.type}'. use 'video', 'srt', or 'vtt'`);
      process.exit(1);
    }

    if (isNaN(Number(options.size))) {
      console.error("error: chunk size must be a number!");
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

    await translate(file, options.output, {
      format: options.type,
      chunkSize: Number(options.size),
      model: options.model,
      params: {
        sourceLang: options.sourceLang,
        targetLang: options.lang,
        tone: options.tone
      }
    });
  })

program
  .command("config")
  .description("setup configuration")
  .option("--reset", "reset configuration")
  .action(async (_, options) => {
    const keys = new ConfigMap<keyof KeyConfig, string>();
    const config = new ConfigMap<keyof ConfigType, string>();

    if (options.parent.args.find((a: string) => a == "--reset")) {
      await resetConfig();
      await resetKeys();
      console.log("config resetted");
      process.exit(0);
    }

    async function promptKey(message: string, provider: keyof KeyConfig) {
      const isSet = await isKeyExist(provider);
      const key = await password({
        message: [message, isSet ? ' (✔): ' : ': '].join('')
      });
      keys.set(provider, key);
    }

    console.log("press enter to skip if you don't want to set specific config");

    const ollamaHost = await input({
      message: "Ollama base url (default: http://localhost:11434 or https://ollama.com)"
    })

    config.set('ollamaHost', ollamaHost);

    await promptKey("Ollama API Key", 'ollama');
    await promptKey("OpenAI API Key", 'openai');
    await promptKey("Anthropic API Key", 'anthropic');

    await updateConfig(config);
    await saveKeys(keys);

    console.log("config saved!");

    process.exit(0);
  })

program.parse();