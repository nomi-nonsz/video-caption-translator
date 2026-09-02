import path from 'path';
import os from 'os'
import fsp from 'fs/promises'
import fs from 'fs'

import { APP_NAME } from './config';
import { state } from '../state';

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

export function cleanup() {
  for (const f of Array.from(state.tmpFiles)) {
    if (fs.existsSync(f))
      fs.unlinkSync(f);
  }
}

export async function checkFile(path: string) {
  try {
    await fsp.access(path, fsp.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}