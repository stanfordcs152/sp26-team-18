import {
  RekognitionClient,
  RecognizeCelebritiesCommand,
} from "@aws-sdk/client-rekognition";

const client = new RekognitionClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const REKOGNITION_MAX_BYTES = 5 * 1024 * 1024;

export async function detectCelebrities(imageBuffer: Buffer) {
  if (imageBuffer.length > REKOGNITION_MAX_BYTES) {
    console.warn(
      `Skipping Rekognition: image is ${(imageBuffer.length / 1024 / 1024).toFixed(1)}MB (max 5MB)`
    );
    return [];
  }

  try {
    const command = new RecognizeCelebritiesCommand({
      Image: {
        Bytes: imageBuffer,
      },
    });

    const response = await client.send(command);

    return (
      response.CelebrityFaces?.map((face) => ({
        name: face.Name,
        confidence: face.MatchConfidence,
      })) || []
    );
  } catch (error) {
    console.error("AWS REKOGNITION ERROR:", error);

    return [];
  }
}