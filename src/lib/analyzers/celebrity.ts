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

export async function detectCelebrities(imageBuffer: Buffer) {
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