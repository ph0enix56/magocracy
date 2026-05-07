import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const UI_DIR = "/home/filip/magocracy/src/game/ui";

async function getFiles(dir: string): Promise<string[]> {
  const dirents = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(dirents.map((dirent) => {
    const res = join(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  }));
  return Array.prototype.concat(...files);
}

async function run() {
  const allFiles = await getFiles(UI_DIR);
  const svelteFiles = allFiles.filter(f => f.endsWith(".svelte"));

  const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
  const results = new Map<string, string>();

  for (const file of svelteFiles) {
    const content = await readFile(file, "utf8");
    const matches = content.match(emojiRegex);
    if (matches) {
      for (const match of matches) {
        const codePoints = Array.from(match).map(c => c.codePointAt(0)!.toString(16).toUpperCase()).join("-");
        results.set(match, codePoints);
      }
    }
  }

  for (const [emoji, code] of results) {
    console.log(`${emoji}: U+${code}`);
  }
}

run().catch(console.error);
