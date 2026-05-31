/**
 * Downscale images before Ollama vision to avoid VRAM crashes (GGML_ASSERT).
 * OpenFake images can be very large; llava often fails at full resolution.
 */
import sharp from "sharp";
import { EVAL_CONFIG } from "../config";

export async function prepareImageForOllama(
  imageBuffer: Buffer,
  maxSide = EVAL_CONFIG.ollamaMaxImageSide
): Promise<Buffer> {
  return sharp(imageBuffer)
    .rotate()
    .resize({
      width: maxSide,
      height: maxSide,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();
}
