import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";

const BUILDINGS_PATH = "/home/filip/magocracy/src/server/config/buildingDefs/buildings.json";
const UNITS_PATH = "/home/filip/magocracy/src/server/config/buildingDefs/units.json";
const ICONS_DIR = "/home/filip/magocracy/public/assets/game_icons";

async function run() {
  const buildings = JSON.parse(await Bun.file(BUILDINGS_PATH).text());
  const units = JSON.parse(await Bun.file(UNITS_PATH).text());

  const referencedIcons = new Set<string>();

  for (const b of buildings) {
    if (b.assetPath && b.assetPath.startsWith("game_icons/")) {
      referencedIcons.add(b.assetPath.replace("game_icons/", ""));
    }
  }

  for (const u of units) {
    if (u.assetPath && u.assetPath.startsWith("game_icons/")) {
      referencedIcons.add(u.assetPath.replace("game_icons/", ""));
    }
  }

  console.log(`Referenced icons: ${referencedIcons.size}`);

  const files = await readdir(ICONS_DIR);
  let removedCount = 0;

  for (const file of files) {
    if (file.endsWith(".svg") && !referencedIcons.has(file)) {
      console.log(`Deleting unused icon: ${file}`);
      await unlink(join(ICONS_DIR, file));
      removedCount++;
    }
  }

  console.log(`Total removed: ${removedCount}`);
}

run().catch(console.error);
