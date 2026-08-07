import path from "path";

import type {
  Cue,
  CueChunk,
  TranslateOption,
} from "./lib/types";
import { getLanguageIndex } from "./lib/lang";
import { translateAllChunks } from "./lib/translation-model";
import { checkFile } from "./lib/utils";
import {
  embedToVideo,
  getSrtContent,
  getVideoExt,
  listSubStreams,
  parseSub,
  parseToCue,
  SUPPORTED_CONTAINER
} from "./lib/media";

function splitToChunks(cues: Cue[], size: number) {
  const chunks: CueChunk[] = [];
  for (let i = 0; i < cues.length; i += size) {
    chunks.push(cues.slice(i, i + size));
  }
  return chunks;
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

  const containerMIME = Bun.file(inpath).type;

  if (!SUPPORTED_CONTAINER.includes(containerMIME)) {
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
  await Bun.file(subPath).delete();

  console.log("[video-caption-translator] Subtitle translation completed. Saving...");

  const subFormat: 'WebVTT' | 'SRT' = format == 'vtt' ? 'WebVTT' : 'SRT';
  const translated = parseSub(translatedCues, subFormat);

  if (path.extname(outpath).length < 1) {
    const ext = format == 'video' ? getVideoExt(containerMIME) : format;
    outpath = `${outpath}.${ext}`;
  }

  if (format == 'srt' || format == 'vtt') {
    await Bun.write(outpath, translated);
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