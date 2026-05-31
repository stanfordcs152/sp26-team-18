import {
  RekognitionClient,
  RecognizeCelebritiesCommand,
} from "@aws-sdk/client-rekognition";

// Lazily constructed so importing this module (e.g. during `next build` page
// data collection) doesn't require AWS credentials at module load. The client
// is only needed at request time.
let client: RekognitionClient | null = null;
function getClient(): RekognitionClient {
  if (!client) {
    client = new RekognitionClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

export async function detectCelebrities(imageBuffer: Buffer) {
  try {
    const command = new RecognizeCelebritiesCommand({
      Image: {
        Bytes: imageBuffer,
      },
    });

    const response = await getClient().send(command);

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