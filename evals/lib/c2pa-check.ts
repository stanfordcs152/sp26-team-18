/**
 * C2PA check for the eval CLI (tsx). Uses dynamic import() so Node resolves
 * @trustnxt/c2pa-ts ESM subpath exports (tsx CJS resolution fails on ./asset).
 */
import "reflect-metadata";

export type C2paStatus = "verified" | "missing" | "invalid" | "no_image";

export interface C2paCheckResult {
  status: C2paStatus;
  metadata: {
    manifestCount?: number;
    activeManifestLabel?: string | null;
    statusEntries?: { code: string; explanation?: string }[];
    error?: string;
  } | null;
}

export async function checkC2pa(bytes: Uint8Array): Promise<C2paCheckResult> {
  const { createAsset } = await import("@trustnxt/c2pa-ts/asset");
  const { SuperBox } = await import("@trustnxt/c2pa-ts/jumbf");
  const { ManifestStore } = await import("@trustnxt/c2pa-ts/manifest");

  let asset;
  try {
    asset = await createAsset(bytes);
  } catch (err) {
    return {
      status: "no_image",
      metadata: { error: err instanceof Error ? err.message : String(err) },
    };
  }

  let jumbf: Uint8Array | undefined;
  try {
    jumbf = await asset.getManifestJUMBF();
  } catch (err) {
    return {
      status: "invalid",
      metadata: { error: err instanceof Error ? err.message : String(err) },
    };
  }

  if (!jumbf) {
    return { status: "missing", metadata: null };
  }

  try {
    const superBox = SuperBox.fromBuffer(jumbf);
    const manifestStore = ManifestStore.read(superBox);
    const result = await manifestStore.validate(asset);
    const active = manifestStore.getActiveManifest();
    const statusEntries = result.statusEntries.map((e) => ({
      code: String(e.code),
      explanation: e.explanation,
    }));
    return {
      status: result.isValid ? "verified" : "invalid",
      metadata: {
        manifestCount: manifestStore.manifests.length,
        activeManifestLabel: active?.label ?? null,
        statusEntries,
      },
    };
  } catch (err) {
    return {
      status: "invalid",
      metadata: { error: err instanceof Error ? err.message : String(err) },
    };
  }
}
