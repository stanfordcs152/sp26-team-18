import { access } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GroundTruthLabel, ManifestRow } from "./types";

export async function loadManifest(
  manifestPath: string,
  expectedLabel: GroundTruthLabel
): Promise<ManifestRow[]> {
  const raw = await readFile(manifestPath, "utf8");
  const rows: ManifestRow[] = [];

  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    let parsed: ManifestRow;
    try {
      parsed = JSON.parse(trimmed) as ManifestRow;
    } catch {
      throw new Error(`Invalid JSON on line ${index + 1} of ${manifestPath}`);
    }

    if (!parsed.id || !parsed.path || !parsed.label) {
      throw new Error(
        `${manifestPath}:${index + 1} missing required field (id, path, label)`
      );
    }

    if (parsed.label !== expectedLabel) {
      throw new Error(
        `${manifestPath}:${index + 1} label "${parsed.label}" !== expected "${expectedLabel}"`
      );
    }

    rows.push(parsed);
  }

  return rows;
}

export function resolveImagePath(
  repoRoot: string,
  manifestPath: string,
  imagePath: string
) {
  if (path.isAbsolute(imagePath)) return imagePath;
  return path.resolve(repoRoot, path.dirname(manifestPath), imagePath);
}

export async function validateManifests(
  repoRoot: string,
  allowManifest: string,
  unallowManifest: string
) {
  const allow = await loadManifest(allowManifest, "allow");
  const unallow = await loadManifest(unallowManifest, "unallow");
  const errors: string[] = [];

  for (const row of [...allow, ...unallow]) {
    const manifestPath = row.label === "allow" ? allowManifest : unallowManifest;
    const abs = resolveImagePath(repoRoot, manifestPath, row.path);
    try {
      await access(abs);
    } catch {
      errors.push(`${row.id}: file not found at ${abs}`);
    }
  }

  return { allow, unallow, errors };
}
