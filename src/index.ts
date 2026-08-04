import { Command } from 'commander';
import { exit } from 'process';
import { listAvailableSubs } from './lang';

const program = new Command();

program
  .option('--source-lang <language>', 'Pick the target language to translate, default: english (en)')
  .option('-l, --lang <language>', 'Pick the target language to translate, default: english (en)', 'en')
  .argument('[file]')
  .option('--list-sub', 'List available subtitles')
  .action((file, options) => {
    if (options.listSub) {
      listAvailableSubs();
      return
    }

    if (file) {
      console.log("Value");
      return;
    }

    console.error("error: missing required argument 'file'");
    exit(1);
  })

program.parse();