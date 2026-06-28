import { r2 } from "@/lib/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const storageKey = key.join("/");

  try {
    const result = await r2.send(
      new GetObjectCommand({
        Bucket: process.env.MINIO_BUCKET_NAME!,
        Key: storageKey,
      })
    );

    if (!result.Body) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const headers = new Headers();
    if (result.ContentType) headers.set("Content-Type", result.ContentType);
    if (result.ContentLength) headers.set("Content-Length", String(result.ContentLength));
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new Response(result.Body as ReadableStream, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
