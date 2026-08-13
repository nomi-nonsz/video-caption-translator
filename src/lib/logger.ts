import chalk from "chalk";
import { APP_NAME } from "./config";

class Logger {
  private prefix = `[${chalk.bold.green(APP_NAME)}]`;
  private prefixRaw = `[${APP_NAME}]`;
  private prefixTabs = "";

  public constructor() {
    this.prefixTabs = `! ${this.prefixRaw}`.split('').fill(' ').join('');
  }

  private getPrefixTab(message: string) {
    return message.split('\n').map((w, i) => i > 0 ? `${this.prefixTabs} ${w}` : w).join('\n');
  }

  public info(message: string, ...args: unknown[]) {
    message = this.getPrefixTab(message);
    console.log(`${chalk.blue('!')} ${this.prefix} ${message}`, ...args);
  }

  public error(message: string, ...args: unknown[]) {
    message = this.getPrefixTab(message);
    const msg = chalk.red.bold('ERROR: ') + chalk.red(message);
    console.error('! ' + chalk.reset(`${this.prefix} ${msg}`), ...args);
  }

  public errorRaw(...args: unknown[]) {
    console.error(chalk.reset(`${this.prefix} ${chalk.red.bold('ERROR: ')}\n`), ...args);
  }
}

export const log = new Logger();