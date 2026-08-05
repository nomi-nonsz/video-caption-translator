import { Command } from 'commander';
import { AVAILABLE_LANG, listAvailableSubs } from './lang';
import { translate } from './translate';

const validOutputFormats = ['video', 'srt', 'vtt'] as const;

const program = new Command();

program
  .description('video-caption-translator: Translate video caption to any language with AI!')
  .version('0.8.0')
  .option("-l, --lang <language>", "pick the target language to translate", "en")
  .option("-t, --type <type>", "output type. 'video', 'srt', 'vtt'", "video")
  .option("-o, --output <path>", "output of translated caption")
  .option('-s, --size <size>', "chunk size per cue", "15")
  .option("--tone <tone>", "pick the tone for translate", "neutral")
  .option("--source-lang <language>", "pick the source language, default: auto-detected")
  .argument('<file>', 'input video. supported format: mkv, mp4, vtt')
  .action(async (file, options) => {
    if (!options.output) {
      console.error("error: required option '-o, --output <path>' not specified");
      process.exit(1);
    }

    if (!AVAILABLE_LANG.includes(options.lang)) {
      console.error(`error: invalid target language '${options.lang}'. use listsub to see the available languages`);
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
      console.error("error: chunk size must be a number");
      process.exit(1);
    }

    await translate(file, options.output, options.type, Number(options.size), {
      sourceLang: options.sourceLang,
      targetLang: options.lang,
      tone: options.tone,
    });
  })

program.command('listsub')
  .description('iist all available subtitles')
  .action(() => {
    listAvailableSubs();
  })

program.parse();