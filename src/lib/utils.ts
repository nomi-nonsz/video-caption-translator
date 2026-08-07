import fs from 'fs/promises'

export async function checkFile(path: string) {
  try {
    await fs.access(path, fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}