import { Command } from 'commander';
import { listAvailableSubs } from './lang';

const program = new Command();

program
  .description('video-caption-translator: Translate video caption to any language with AI!')
  .version('0.8.0')
  .option("-l, --lang <language>", "pick the target language to translate", "en")
  .option("-t, --type <type>", "output type. 'video', 'srt', 'vtt'", "video")
  .option("-o, --output <path>", "output of translated caption")
  .option("--tone <tone>", "pick the tone for translate", "neutral")
  .option("--source-lang <language>", "pick the source language, default: auto-detected")
  .argument('<file>', 'input video. supported format: mkv, mp4, vtt')
  .action((file, options) => {
    if (!options.output) {
      console.error("error: required option '-o, --output <path>' not specified");
      process.exit(1);
    }
  })

program.command('listsub')
  .description('iist all available subtitles')
  .action(() => {
    listAvailableSubs();
  })

program.parse();