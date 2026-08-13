import chalk from "chalk";
import { APP_NAME } from "./config";

class Logger {
  private prefix = `[${chalk.bold.green(APP_NAME)}]`

  public constructor() {
  }

  public info(message: string, ...args: unknown[]) {
    console.log(`${chalk.blue('!')} ${this.prefix} ${message}`, ...args);
  }

  public error(message: string, ...args: unknown[]) {
    const msg = chalk.red.bold('ERROR: ') + chalk.red(message);
    console.error(chalk.reset(`${this.prefix} ${msg}`), ...args);
  }

  public errorRaw(...args: unknown[]) {
    console.error(chalk.reset(`${this.prefix} ${chalk.red.bold('ERROR: ')}\n`), ...args);
  }
}

export const log = new Logger();