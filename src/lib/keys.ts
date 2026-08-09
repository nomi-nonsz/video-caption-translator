import { confirm, password } from '@inquirer/prompts';
import keytar from "keytar";
import { APP_NAME, getConfig, getPath } from './config';

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

export async function saveToJson(keys: Map<keyof KeyConfig, string>) {
  const configPath = getPath();
  const config = await getConfig();
  const newConfig = {
    ...config,
    keys: Object.fromEntries(keys)
  };

  await Bun.file(configPath).write(JSON.stringify(newConfig, null, 2));
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
  for (const provider of KEY_PROPS) {
    await keytar.deletePassword(APP_NAME, `${provider}ApiKey`);
  }
}