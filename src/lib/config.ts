import path from 'path'
import os from 'os';
import fs from 'fs/promises';

export const APP_NAME = 'video-caption-translator';
export const APP_VERSION = 'v1.0.1';

export type ConfigType = {
  ollamaHost: string
}

const CONFIG_PROPS: (keyof ConfigType)[] = ['ollamaHost'];

export class ConfigMap<K, V> extends Map implements Map<K, V> {
  set(key: K, value: V): this {
    if (typeof value === 'string' && value.length > 1) {
      return super.set(key, value);
    }
    return this;
  }
}

export function getDir() {
  let dir = './';
  
  if (process.platform === 'win32') {
    dir = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), APP_NAME);
  } else if (process.platform === 'darwin') {
    dir = path.join(os.homedir(), 'Library', 'Application Support', APP_NAME);
  } else if (process.platform === 'linux') {
    dir = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), APP_NAME);
  }

  return dir;
}

export function getPath() {
  return path.join(getDir(), 'config.json');
}

export async function getConfig() {
  let config = {};
  const path = getPath();

  if (await fs.exists(path)) {
    const file = Bun.file(path);
    config = await file.json();
  }

  return config;
}

export async function updateConfig(config: Map<keyof ConfigType, string | string[]>) {
  const configDir = getDir();
  if (!(await fs.exists(configDir))) {
    await fs.mkdir(configDir, { recursive: true });
  }

  const configPath = getPath();
  const configOld = await getConfig();

  config.forEach((p ,v) => {
    if (typeof v === 'string' && v.length < 1) {
      config.delete(p as keyof ConfigType);
    }
  })

  const newConfig = { ...configOld, ...(Object.fromEntries(config)) }

  await Bun.file(configPath).write(JSON.stringify(newConfig, null, 2));
}

export async function resetConfig() {
  const path = getPath();
  if (await fs.exists(path)) {
    await Bun.file(path).write("{}");
  }
}