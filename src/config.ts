import { confirm, input, password } from "@inquirer/prompts";
import { getKeyrings, KeyConfig, saveToKeyring } from "./lib/keys";

async function saveKeys(keys: Map<keyof KeyConfig, string>) {
  try {
    await saveToKeyring(keys);
  } catch {
    console.warn("failed to save api keys with keyring");
    await confirm({
      message: "save plain text instead?",
    });
  }
}

export async function startConfig() {
  const keys = new Map<keyof KeyConfig, string>();

  console.log("press enter to skip if you don't want to set specific config");

  const ollamaKey = await password({
    message: "Ollama API Key: ",
  });

  keys.set("ollama", ollamaKey);

  const openaiKey = await password({
    message: "OpenAI API Key: ",
  });

  keys.set("openai", openaiKey);

  const anthropicKey = await password({
    message: "Anthropic API Key: ",
  });

  keys.set("anthropic", anthropicKey);

  await saveKeys(keys);
  process.exit(0);
}
