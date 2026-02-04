# Magocracy

Magocracy je real-time webová strategická hra, vytvářená jako semestrální projekt na NI-VGA a následně jako diplomová práce.

## Dokumentace

Game design document: [zde](docs/DESIGN.md)

Technický design: [zde](docs/TECHNICAL.md)

Implementační plán: [zde](docs/ROADMAP.md)

Závěrečná zpráva: [zde](docs/REPORT.md)

## Lokální spuštění

Projekt funguje jako webová aplikace a obsahuje standardně formátovaný `package.json`.
Skripty jsou připraveny pro module bundler [Bun](https://bun.sh/).

Po jeho instalaci tak stačí v terminálu spustit `bun install` pro stažení balíčků a `bun run dev` pro spuštění lokálního webserveru, případně `bun run build` pro vytvoření bundle vhodné pro umístění na vlastní webser.

Případně by mělo být možné použít klasicky Node.js + npm, spustit `npm install` a poté spustit přímo `npx vite`/`npx vite build`, nebo upravit `package.json`, aby skripty nevolaly Bun, ale přímo Vite.
