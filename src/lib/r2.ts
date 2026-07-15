import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

export const r2 = new S3Client({
  region: "us-east-1",
  endpoint: process.env.MINIO_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY_ID!,
    secretAccessKey: process.env.MINIO_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

export async function deleteObject(key: string): Promise<void> {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: process.env.MINIO_BUCKET_NAME!,
      Key: key,
    })
  );
}

export function getMediaProxyUrl(key: string): string {
  return `/api/media/${key}`;
}
