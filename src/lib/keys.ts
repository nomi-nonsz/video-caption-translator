import path from 'path';
import fs from 'fs/promises'
import { confirm } from '@inquirer/prompts'

import keytar from "keytar";
import { APP_NAME, getDir } from './config';

const TIMEOUT = 15000;

export type KeyConfig = {
  ollama: string;
  openai: string;
  anthropic: string;
};

export const KEY_PROPS: (keyof KeyConfig)[] = [
  'ollama',
  'openai',
  'anthropic'
]

export async function saveToKeyring(keys: Map<keyof KeyConfig, string>) {
  for (const provider of keys.keys().toArray()) {
    const key = keys.get(provider);
    if (!key || (key && key.length < 1))
      continue
    const keyringPromise = keytar.setPassword(
      APP_NAME,
      `${provider}ApiKey`,
      keys.get(provider)!,
    );
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('error while saving keyring: timeout after 15s')), TIMEOUT));
    await Promise.race([keyringPromise, timeout]);
  }
}

export async function getKeyrings() {
  const keys = new Map();
  for (const provider of KEY_PROPS) {
    const key = await keytar.getPassword(APP_NAME, `${provider}ApiKey`);
    keys.set(provider, key ?? '');
  }
  return keys;
}

// genuinely hate keytar.getPassword
export async function isKeyExist(provider: keyof KeyConfig) {
  try {
    const key = await keytar.getPassword(APP_NAME, `${provider}ApiKey`);
    if (key != null)
      return true;
    else
      return false;
  } catch (e) {
    return false;
  }
}

export async function saveToJson(keys: Map<keyof KeyConfig, string>) {
  const configDir = getDir();
  const keyPath = path.join(configDir, '.keys.json');
  const json = JSON.stringify(Object.fromEntries(keys), null, 2);

  await fs.writeFile(keyPath, json, { encoding: 'utf-8', mode: '0o0644' });
}

export async function saveKeys(keys: Map<keyof KeyConfig, string>) {
  try {
    await saveToKeyring(keys);
  } catch {
    console.warn("failed to save api keys with keyring");
    const wantsSaveJson = await confirm({
      message: "save plain json format instead?",
    });
  }
}

export async function resetKeys() {
  try {
    for (const provider of KEY_PROPS) {
      await keytar.deletePassword(APP_NAME, `${provider}ApiKey`);
    }
    return true;
  } catch (e) { return false }
}