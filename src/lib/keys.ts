import keytar from "keytar";

const SERVICE_NAME = "captiondwn";
const TIMEOUT = 15000;

export type KeyConfig = {
  ollama: string;
  openai: string;
  anthropic: string;
};

export async function saveToKeyring(keys: Map<keyof KeyConfig, string>) {
  for (const provider of keys.keys().toArray()) {
    const keyringPromise = keytar.setPassword(
      SERVICE_NAME,
      `${provider}ApiKey`,
      keys.get(provider)!,
    );
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('error to save keyring: timeout after 15s')), TIMEOUT));
    await Promise.race([keyringPromise, timeout]);
  }
}

export async function getKeyrings() {
  const keys = new Map();
  for (const provider of ['ollama', 'openai', 'anthropic']) {
    const key = await keytar.getPassword(SERVICE_NAME, `${provider}ApiKey`);
    keys.set(provider, key ?? '');
  }
  return keys;
}