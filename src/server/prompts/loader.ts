import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type LoadedPrompt = {
  name: string;
  version: string;
  text: string;
  path: string;
};

const versionPattern =
  /(?:<!--\s*version:\s*([^>]+?)\s*-->|^version:\s*(.+)$)/im;

function promptPath(promptName: string) {
  const safeName = promptName.replace(/[^a-z0-9-]/gi, "");
  return path.join(process.cwd(), "prompts", `${safeName}.md`);
}

export async function loadPrompt(promptName: string): Promise<LoadedPrompt> {
  const filePath = promptPath(promptName);
  const text = await readFile(filePath, "utf8");
  const explicitVersion = text.match(versionPattern)?.[1]?.trim();
  const version =
    explicitVersion ??
    createHash("sha256").update(text).digest("hex").slice(0, 12);

  return {
    name: promptName,
    version,
    text,
    path: filePath,
  };
}
