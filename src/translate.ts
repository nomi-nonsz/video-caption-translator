import fs from "fs/promises";
import path from "path";
import { execa } from "execa";
import { fileTypeFromFile } from "file-type";
import { NodeList, parseSync, stringifySync } from "subtitle";

import type {
  Cue,
  CueChunk,
  CueShort,
  TranslateOption,
  TranslateParams
} from "./types";
import { getLanguageName, toThreeLetterCode } from "./lang";
import { translateChunk, translateChunkTest } from "./models";
import { checkFile } from "./utils";

const SUPPORTED_CONTAINER = [,
  'mkv',
  'mp4',
  'webm'
]

async function listSubStreams(path: string) {
  const proc = await execa('ffprobe', [
    '-v', 'error',
    '-select_streams', 's',
    '-show_entries', 'stream=index,codec_name,codec_long_name:stream_tags=language,title:stream_disposition',
    '-of', 'json',
    path
  ]);
  const output = JSON.parse(proc.stdout);
  return output.streams || [];
}

function getLanguageIndex(subs: any[]): number {
  const engSDH = subs.find((s) => s.tags.language == 'eng' && s.disposition.hearing_impaired);
  const engOnly = subs.find((s) => s.tags.language == 'eng');

  if (engSDH) return engSDH.index as number;
  if (engOnly) return engOnly.index as number;
  if (subs[0].index && typeof subs[0].index == 'number') return subs[0].index;

  return -1;
}

/**
 * 
 * @param inpath Video path
 * @param outpath Srt Path
 * @param streamIndex The stream index
 */
async function getSrtContent(inpath: string, outpath: string, streamIndex: number) {
  await execa("ffmpeg", ["-y", "-i", inpath, "-map", `0:${streamIndex}`, outpath]);
  const content = await fs.readFile(outpath, 'utf-8');
  return content;
}

function parseToCue(srt: string): Cue[] {
  const nodes = parseSync(srt);
  return nodes.filter(n => n.type == 'cue').map((n, i) => ({
    index: i,
    start: n.data.start,
    end: n.data.end,
    text: n.data.text
  }))
}

function parseSub(cues: Cue[], format: 'SRT' | 'WebVTT') {
  const nodes = cues.map(({ start, end, text }) => ({
    type: 'cue',
    data: { start, end, text }
  }));
  const srt = stringifySync(nodes as NodeList, { format });
  return srt;
}

async function embedToVideo(srt: string, lang: string, inpath: string, outpath: string) {
  const subPath = `/tmp/${crypto.randomUUID()}-${Date.now()}.srt`;
  
  await fs.writeFile(subPath, srt, { encoding: 'utf-8' });
  await execa("ffmpeg", ["-y",
    "-i", inpath,
    "-i", subPath,
    "-map", "0:v",
    "-map", "0:a",
    "-map", "1:0",
    "-c", "copy",
    "-c:s", "srt",
    "-c:v", "copy",
    "-c:a", "copy",
    "-metadata:s:s:0", `language=${toThreeLetterCode(lang)}`,
    "-metadata:s:s:0", `title="${getLanguageName(lang)} (Auto Translated)"`,
    outpath
  ]);

  await fs.rm(subPath);
}

/* The Idea:
  1. Chunk based on subtitle cues
  2. Group several cues (e.g., 20–50 cues) into a single batch. Subtitles already have a [index, start, end, text] structure.
  3. Maintain context across chunks (sliding window)
  4. Send the last few cues from the previous chunk as context (without asking for a new translation) so that pronouns and dialogue continuity remain consistent.
    Alternatively, save a brief summary (“running summary”) of the previous chunks and include it in the system prompt for each new chunk.
 */
function splitToChunks(cues: Cue[], size: number) {
  const chunks: CueChunk[] = [];
  for (let i = 0; i < cues.length; i += size) {
    chunks.push(cues.slice(i, i + size));
  }
  return chunks;
}
async function translateAllChunks(chunks: CueChunk[], model: string, options: TranslateParams) {
  let previousCues: CueShort[] = [];
  let results: Cue[] = [];
  let i = 1;
  try {
    const targetLang = getLanguageName(options.targetLang);

    for (const chunk of chunks) {
      console.log(`[video-caption-translator] [${Math.floor((i/chunks.length) * 100)}/100] Translating cue ${chunk[0]?.index}-${chunk[chunk.length-1]?.index}`);
      const translated = (await translateChunk(chunk, model, previousCues, { ...options, targetLang })) as Cue[];
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

export async function translate(inpath: string, outpath: string, option: TranslateOption) {
  const { chunkSize, params, format } = option;
  const subName = `${crypto.randomUUID()}-${Date.now()}`;
  const subPath = `/tmp/${subName}.srt`;

  console.log(`[video-caption-translator] Using model ${option.model}.`);

  if (!(await checkFile(inpath))) {
    console.error(`[video-caption-translator] Error: Cannot access ${inpath}. Either it's not accessable or it doesn't exist`);
    process.exit(1);
  }

  const containerType = await fileTypeFromFile(inpath);

  if (!SUPPORTED_CONTAINER.includes(containerType?.ext)) {
    console.error(`[video-caption-translator] Error: ${inpath} is not supported with available formats: mp4, mkv, webm`);
    process.exit(1);
  }

  console.log("[video-caption-translator] Obtaining available source language...");

  const subList = await listSubStreams(inpath);
  const streamIndex = getLanguageIndex(subList);

  if (streamIndex < 0) {
    console.error("[video-caption-translator] Failed to extract subtitle: no subtitles found");
    process.exit(1);
  }

  console.log("[video-caption-translator] Parsing to cue...");

  const srtContent = await getSrtContent(inpath, subPath, streamIndex);
  const cues = parseToCue(srtContent);
  const chunks = splitToChunks(cues, chunkSize);

  console.log("[video-caption-translator] Begin Translating...");

  // console.log(chunks.map(c => c.map(({ index, text }) => ({ index, text }))))

  const translatedCues = await translateAllChunks(chunks, option.model, params);
  await fs.rm(subPath);

  console.log("[video-caption-translator] Subtitle translation completed. Saving...");

  const subFormat: 'WebVTT' | 'SRT' = format == 'vtt' ? 'WebVTT' : 'SRT';
  const translated = parseSub(translatedCues, subFormat);

  if (path.extname(outpath).length < 1) {
    const ext = format == 'video' ? containerType!.ext : format;
    outpath = `${outpath}.${ext}`;
  }

  if (format == 'srt' || format == 'vtt') {
    await fs.writeFile(outpath, translated, { encoding: 'utf-8' });
  } else {
    await embedToVideo(translated, params.targetLang, inpath, outpath);
  }

  console.log(`[video-caption-translator] Saved at ${outpath}.`);
}

// translate("./sandbox/test-input.mkv", './sandbox/test-output.srt', {
//   format: 'srt',
//   chunkSize: 15,
//   model: 'gemma4:31b',
//   params: {
//     targetLang: 'id',
//     tone: 'neutral'
//   }
// });