import { auth } from "@/lib/auth";
import { r2 } from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import sharp from "sharp";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 30 * 1024 * 1024;

// Panoramen werden fürs Web neu kodiert, wenn sie eine dieser Grenzen reißen.
// 8192px reicht für scharfe Darstellung im Viewer, Qualität 80 ist visuell
// praktisch verlustfrei — aus 15–20 MB Originalen werden typisch 3–5 MB.
const MAX_WIDTH = 8192;
const RECOMPRESS_THRESHOLD = 6 * 1024 * 1024;
const JPEG_QUALITY = 80;
// 30-MB-Uploads sind auth-geschützt; großzügiges Limit statt Default (268 MP)
const MAX_INPUT_PIXELS = 512 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const sceneId = formData.get("sceneId") as string | null;

  if (!file || !sceneId) {
    return NextResponse.json({ error: "Fehlende Parameter" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Dateityp nicht erlaubt. Nur JPG, PNG, WebP." },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Datei zu groß. Maximum: 30 MB." },
      { status: 400 }
    );
  }

  let buffer = Buffer.from(await file.arrayBuffer());
  let contentType = file.type;
  let ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  let width: number | null = null;
  let height: number | null = null;

  try {
    const image = sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).rotate();
    const meta = await image.metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;

    const needsRecompress =
      (meta.width ?? 0) > MAX_WIDTH ||
      file.type !== "image/jpeg" ||
      file.size > RECOMPRESS_THRESHOLD;

    if (needsRecompress) {
      buffer = Buffer.from(
        await image
          .resize({ width: MAX_WIDTH, withoutEnlargement: true })
          // XMP-/GPano-Daten erhalten — PSV braucht sie für Teilpanoramen
          .keepMetadata()
          .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
          .toBuffer()
      );
      const outMeta = await sharp(buffer).metadata();
      width = outMeta.width ?? width;
      height = outMeta.height ?? height;
      contentType = "image/jpeg";
      ext = "jpg";
    }
  } catch {
    // Bild nicht dekodierbar (z. B. exotisches Format) → Original speichern
  }

  const key = `panoramas/${session.user.id}/${sceneId}/${nanoid()}.${ext}`;

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.MINIO_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.length,
    })
  );

  return NextResponse.json({
    key,
    url: `/api/media/${key}`,
    width,
    height,
    fileSize: buffer.length,
  });
}
