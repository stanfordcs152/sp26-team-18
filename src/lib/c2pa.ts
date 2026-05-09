// Server-only C2PA helper. The @trustnxt/c2pa-ts library and its dependency
// @peculiar/x509 rely on `reflect-metadata`, so we polyfill it here. This
// module must NEVER be imported from a client component.
import "reflect-metadata"

import { createAsset } from "@trustnxt/c2pa-ts/asset"
import { SuperBox } from "@trustnxt/c2pa-ts/jumbf"
import { ManifestStore } from "@trustnxt/c2pa-ts/manifest"

export type C2paStatus = "verified" | "missing" | "invalid" | "no_image"

export interface C2paCheckResult {
  status: C2paStatus
  // Light-weight metadata blob to persist alongside the post. Kept small and
  // serializable so it round-trips through Supabase jsonb cleanly.
  metadata: {
    manifestCount?: number
    activeManifestLabel?: string | null
    statusEntries?: { code: string; explanation?: string }[]
    error?: string
  } | null
}

/**
 * Run a Content Credentials (C2PA) check on the given image bytes.
 *
 * Returns one of:
 * - `verified`: a manifest was found and its signature/bindings validated
 * - `invalid`:  a manifest was found but failed validation
 * - `missing`:  the asset format is supported but contains no manifest
 * - `no_image`: the bytes don't look like a supported image format
 */
export async function checkC2pa(bytes: Uint8Array): Promise<C2paCheckResult> {
  let asset
  try {
    asset = await createAsset(bytes)
  } catch (err) {
    return {
      status: "no_image",
      metadata: { error: err instanceof Error ? err.message : String(err) },
    }
  }

  let jumbf: Uint8Array | undefined
  try {
    jumbf = await asset.getManifestJUMBF()
  } catch (err) {
    return {
      status: "invalid",
      metadata: { error: err instanceof Error ? err.message : String(err) },
    }
  }

  if (!jumbf) {
    return { status: "missing", metadata: null }
  }

  let manifestStore: ManifestStore
  try {
    const superBox = SuperBox.fromBuffer(jumbf)
    manifestStore = ManifestStore.read(superBox)
  } catch (err) {
    return {
      status: "invalid",
      metadata: { error: err instanceof Error ? err.message : String(err) },
    }
  }

  try {
    const result = await manifestStore.validate(asset)
    const active = manifestStore.getActiveManifest()
    const statusEntries = result.statusEntries.map((e) => ({
      code: String(e.code),
      explanation: e.explanation,
    }))
    return {
      status: result.isValid ? "verified" : "invalid",
      metadata: {
        manifestCount: manifestStore.manifests.length,
        activeManifestLabel: active?.label ?? null,
        statusEntries,
      },
    }
  } catch (err) {
    return {
      status: "invalid",
      metadata: { error: err instanceof Error ? err.message : String(err) },
    }
  }
}
