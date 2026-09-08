#!/usr/bin/env bun

import { Argument, program } from "commander";
import * as config from "./src/lib/config"
import path from "path";

const SOURCE = path.join(__dirname, "src/index.ts");
const OUTFILE = path.join(__dirname, "dist", config.APP_NAME);
const VERSION_RAW = config.APP_VERSION.slice(1, config.APP_VERSION.length)

const Platform = {
  WINDOWS: 'windows',
  MACOS: 'macos',
  LINUX: 'linux',
  LINUX_AMD64: 'linux-amd64',
  LINUX_ARM64: 'linux-arm64'
} as const

type PlatformValues = typeof Platform[keyof typeof Platform];

const genericConfig = {
  entrypoints: [SOURCE],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    VERSION: config.APP_VERSION
  },
  bytecode: true,
  sourcemap: true,
  minify: true,
} satisfies Bun.BuildConfig

async function build_unixes(target: Bun.Build.CompileTarget, outfile: string) {
  return await Bun.build({
    ...genericConfig,
    compile: {
      target,
      outfile
    },
  })
}

async function build_windows() {
   return await Bun.build({
    ...genericConfig,
    compile: {
      target: 'bun-windows-x64',
      outfile: OUTFILE + '-windows.exe',
      windows: {
        title: config.APP_NAME,
        description: "A command-based AI-powered tool for translating video subtitles.",
        version: VERSION_RAW,
        publisher: 'nomi-nonsz',
        icon: path.join(__dirname, 'src/public/icon.ico'),
      }
    },
  })
}

async function build(platform: PlatformValues) {
  let buildOutput: Bun.BuildOutput | null = null;
  switch (platform) {
    case Platform.LINUX || Platform.LINUX_AMD64:
      buildOutput = await build_unixes('bun-linux-x64', OUTFILE + '-linux-amd64');
      break;
    case Platform.LINUX_ARM64:
      buildOutput = await build_unixes('bun-linux-arm64', OUTFILE + '-linux-arm64');
      break;
    case Platform.MACOS:
      buildOutput = await build_unixes('bun-darwin-x64', OUTFILE + '-macos-x64');
      break;
    case Platform.WINDOWS:
      if (process.platform != 'win32')
        console.warn("Warning: You're not running on Windows. The build output may not have Windows-specific metadata.");
      buildOutput = await build_windows();
      break;
  }

  if (buildOutput)
    console.log(buildOutput);
  else
    console.log("No build outputs");
}

program
  .description(`${config.APP_NAME} build tools`)
  .addArgument(new Argument('<platform>', '').choices(Object.values(Platform)));
program.parse();

await build(program.args[0] as PlatformValues);