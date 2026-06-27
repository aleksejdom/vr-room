import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const r2 = new S3Client({
  region: "us-east-1",
  endpoint: process.env.MINIO_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY_ID!,
    secretAccessKey: process.env.MINIO_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

export async function createPresignedUploadUrl(
  key: string,
  contentType: string,
  contentLength: number
): Promise<string> {
  return getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: process.env.MINIO_BUCKET_NAME!,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    { expiresIn: 300 }
  );
}

export async function deleteObject(key: string): Promise<void> {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: process.env.MINIO_BUCKET_NAME!,
      Key: key,
    })
  );
}

export function getPublicUrl(key: string): string {
  return `${process.env.NEXT_PUBLIC_MINIO_PUBLIC_URL}/${key}`;
}

export async function createPresignedGetUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: process.env.MINIO_BUCKET_NAME!,
      Key: key,
    }),
    { expiresIn }
  );
}

export function getMediaProxyUrl(key: string): string {
  return `/api/media/${key}`;
}
