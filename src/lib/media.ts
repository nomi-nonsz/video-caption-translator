import { execa } from "execa";
import { Cue } from "./types";
import { type NodeList, parseSync, stringifySync } from "subtitle";
import { getLanguageName, toThreeLetterCode } from "./lang";

export const SUPPORTED_CONTAINER = [,
  'video/x-matroska', // mkv
  'video/mp4', // mp4
  'video/webm' // webm
]

export const EXT_CONTAINER = {
  'video/x-matroska': 'mkv',
  'video/mp4': 'mp4',
  'video/webm': 'webm'
}

export function getVideoExt(mime: string) {
  return Object.entries(EXT_CONTAINER).find(a => a[0] == mime)?.[1];
}

export async function listSubStreams(path: string) {
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

/**
 * 
 * @param inpath Video path
 * @param outpath Srt Path
 * @param streamIndex The stream index
 */
export async function getSrtContent(inpath: string, outpath: string, streamIndex: number) {
  await execa("ffmpeg", ["-y", "-i", inpath, "-map", `0:${streamIndex}`, outpath]);
  const content = await Bun.file(outpath).text();
  return content;
}

export function parseToCue(srt: string): Cue[] {
  const nodes = parseSync(srt);
  return nodes.filter(n => n.type == 'cue').map((n, i) => ({
    index: i,
    start: n.data.start,
    end: n.data.end,
    text: n.data.text
  }))
}

export function parseSub(cues: Cue[], format: 'SRT' | 'WebVTT') {
  const nodes = cues.map(({ start, end, text }) => ({
    type: 'cue',
    data: { start, end, text }
  }));
  const srt = stringifySync(nodes as NodeList, { format });
  return srt;
}

export async function embedToVideo(srt: string, lang: string, inpath: string, outpath: string) {
  const subPath = `/tmp/${crypto.randomUUID()}-${Date.now()}.srt`;
  
  await Bun.write(subPath, srt);
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

  await Bun.file(subPath).delete();
}