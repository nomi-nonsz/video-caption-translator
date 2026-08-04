import { execa } from "execa";
import fs from "fs/promises";
import { exit } from "process";
import { parseSync } from "subtitle";
import { getLanguageName } from "./lang";
import { Cue, CueChunk, CueShort } from "./types";
import { translateChunk } from "./models";

const CHUNK_SIZE = 15;
const PATH = "/mnt/smb/downloads/THE\ AMAZING\ DIGITAL\ CIRCUS\ S01E06：\ They\ All\ Get\ Guns\ \[mOvhHim78YA\].mkv";

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

/* The Idea:
  1. Chunk based on subtitle cues
  2. Group several cues (e.g., 20–50 cues) into a single batch. Subtitles already have a [index, start, end, text] structure.
  3. Maintain context across chunks (sliding window)
  4. Send the last few cues from the previous chunk as context (without asking for a new translation) so that pronouns and dialogue continuity remain consistent.
    Alternatively, save a brief summary (“running summary”) of the previous chunks and include it in the system prompt for each new chunk.
 */
function splitToChunks(cues: Cue[]) {
  const chunks: CueChunk[] = [];
  for (let i = 0; i < cues.length; i += CHUNK_SIZE) {
    chunks.push(cues.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}
async function translateAllChunks(chunks: CueChunk[], targetLang: string) {
  let previousCues: CueShort[] = [];
  let results: Cue[] = [];
  let i = 1;
  targetLang = getLanguageName(targetLang);

  for (const chunk of chunks) {
    console.log(`[video-caption-translator] [${Math.floor((i/chunks.length) * 100)}/100] Translating cue ${chunk[0]?.index}-${chunk[chunk.length-1]?.index}`);
    const translated = translateChunk(chunk, targetLang, previousCues);
    results = [...results, ...translated];
    previousCues = translated.slice(-4).map(cue => ({
      index: cue.index,
      text: cue.text
    }));
    i++;
  }

  return results;
}

export async function translate(path: string, lang: string) {
  const subName = `${crypto.randomUUID()}-${Date.now()}`;
  const subPath = `/tmp/${subName}.srt`;

  console.log("[video-caption-translator] Obtaining available source language...");

  const subList = await listSubStreams(path);
  const streamIndex = getLanguageIndex(subList);

  if (streamIndex < 0) {
    console.error("[video-caption-translator] Failed to extract subtitle: no subtitles found");
    exit(1);
  }

  console.log("[video-caption-translator] Parsing to cue...");

  const srtContent = await getSrtContent(path, subPath, streamIndex);
  const cues = parseToCue(srtContent);
  const chunks = splitToChunks(cues);

  await fs.rm(subPath);

  // console.log(splitIntoChunks(cues).map(c => c.filter(cue => cue.index < 50)));
  // console.log("length: ", cues.length);

  console.log("[video-caption-translator] Begin Translating...");

  const translatedCues = await translateAllChunks(chunks, lang);

  console.log("[video-caption-translator] Subtitle translation completed.");

  console.log(translatedCues);
}

translate(PATH, 'en');