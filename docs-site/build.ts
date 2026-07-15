// Imports frontend/isohub/src/pages/Docs/content.{en,pt}.ts directly and emits
// docs-site/assets/data.json. Run with `npx tsx build.ts`. Section titles +
// subtitles come from the frontend i18n files so the docs site shows the same
// labels as the React app.
//
// Why a separate JSON: the docs site is plain HTML/CSS/JS and cannot import
// TypeScript modules at runtime. Building once at deploy time keeps the
// runtime dependency-free.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cpSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync, readFileSync } from "node:fs";

// @ts-expect-error - tsx resolves these TS modules at runtime.
import { DOCS_EN } from "../frontend/isohub/src/pages/Docs/content.en.ts";
// @ts-expect-error - tsx resolves these TS modules at runtime.
import { DOCS_PT } from "../frontend/isohub/src/pages/Docs/content.pt.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const i18nDir = resolve(repoRoot, "frontend/isohub/src/i18n/locales");
const outDir = resolve(__dirname, "assets");
const screenshotsSrc = resolve(repoRoot, "frontend/isohub/public/screenshots");
const screenshotsDst = resolve(__dirname, "screenshots");

interface CardI18n { title?: string; description?: string }
interface DocsI18n {
  title?: string;
  subtitle?: string;
  cards?: Record<string, CardI18n>;
  apiDocs?: { title?: string; subtitle?: string };
}
interface I18nRoot { docs?: DocsI18n }

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function pickTitle(i18n: I18nRoot, key: string): { title: string; subtitle: string } {
  if (key === "apiDocs") {
    return {
      title: i18n.docs?.apiDocs?.title ?? "API Reference",
      subtitle: i18n.docs?.apiDocs?.subtitle ?? "",
    };
  }
  const card = i18n.docs?.cards?.[key];
  return {
    title: card?.title ?? key,
    subtitle: card?.description ?? "",
  };
}

function buildBundle(docs: Record<string, { id?: string; blocks?: unknown[] }>, i18n: I18nRoot) {
  const out: Record<string, unknown> = {};
  for (const [key, section] of Object.entries(docs)) {
    const { title, subtitle } = pickTitle(i18n, key);
    out[key] = {
      id: section.id ?? key,
      title,
      subtitle,
      blocks: section.blocks ?? [],
    };
  }
  return out;
}

const enI18n = readJson<I18nRoot>(resolve(i18nDir, "en.json"));
const ptI18n = readJson<I18nRoot>(resolve(i18nDir, "pt-BR.json"));

const data = {
  en: buildBundle(DOCS_EN, enI18n),
  pt: buildBundle(DOCS_PT, ptI18n),
};

mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "data.json");
writeFileSync(outPath, JSON.stringify(data));

const enKeys = Object.keys(data.en);
const ptKeys = Object.keys(data.pt);
const blocksEn = enKeys.reduce((n, k) => n + ((data.en as Record<string, { blocks?: unknown[] }>)[k].blocks?.length ?? 0), 0);
const blocksPt = ptKeys.reduce((n, k) => n + ((data.pt as Record<string, { blocks?: unknown[] }>)[k].blocks?.length ?? 0), 0);
console.log(`[docs-build] wrote ${outPath}`);
console.log(`[docs-build] en: ${enKeys.length} sections / ${blocksEn} blocks`);
console.log(`[docs-build] pt: ${ptKeys.length} sections / ${blocksPt} blocks`);

// Screenshots are authored in the Vite app's public/ folder so they ship
// with the app as-is. The docs site is a separate static bundle — mirror
// the whole tree into docs-site/screenshots/ on every build so the /screenshots/*
// paths inside content.{pt,en}.ts resolve here too. The destination is
// wiped first so files removed upstream disappear from the docs bundle
// as well; recursive cpSync preserves the iso20022/ subfolder.
function countFiles(dir: string): number {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, entry.name);
    if (entry.isDirectory()) n += countFiles(p);
    else if (entry.isFile()) n += 1;
  }
  return n;
}

try {
  statSync(screenshotsSrc);
  rmSync(screenshotsDst, { recursive: true, force: true });
  cpSync(screenshotsSrc, screenshotsDst, { recursive: true });
  const copied = countFiles(screenshotsDst);
  console.log(`[docs-build] copied ${copied} screenshot file(s) → ${screenshotsDst}`);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.warn(`[docs-build] screenshots source not found or unreadable — skipping (${msg})`);
}
