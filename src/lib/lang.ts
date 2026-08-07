import iso6391 from 'iso-639-1';
import { iso6393To1 } from 'iso-639-3';

export const AVAILABLE_LANG = [
  'en', // English
  'ar', // Arabic
  'zh', // Chinese
  'nl', // Dutch
  'fi', // Finnish
  'fr', // French
  'de', // German
  'hi', // Hindi
  'hu', // Hungarian
  'id', // Indonesian
  'ja', // Japanese
  'ko', // Korean
  'pl', // Polish
  'pt', // Portuguese
  'ru', // Russian
  'es', // Spanish
  'th', // Thai
  'tr', // Turkish
  'uk', // Ukrainian
  'ur', // Urdu
  'vi', // Vietnamese
];

export function listSubs() {
  console.log("Available Language:");
  AVAILABLE_LANG.forEach((lang) => {
    console.log(`- '${lang}'\t${iso6391.getName(lang) + (lang == 'en' ? ' (Default)' : '')}`);
  });
}

export function getLanguageName(code: string) {
  const name = iso6391.getName(code);
  return name.length > 1 ? name : 'English';
}

export function toThreeLetterCode(twoLetterCode: string) {
  const entry = Object.entries(iso6393To1).find(
    ([, code1]) => code1 === twoLetterCode
  );
  return entry?.[0] || twoLetterCode.slice(0, 2) + iso6391.getName(twoLetterCode)[2]?.toLocaleLowerCase();
}

export function getLanguageIndex(subs: any[]): number {
  const engSDH = subs.find((s) => s.tags.language == 'eng' && s.disposition.hearing_impaired);
  const engOnly = subs.find((s) => s.tags.language == 'eng');

  if (engSDH) return engSDH.index as number;
  if (engOnly) return engOnly.index as number;
  if (subs[0].index && typeof subs[0].index == 'number') return subs[0].index;

  return -1;
}