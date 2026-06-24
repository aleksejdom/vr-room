import { auth } from "@/lib/auth";
import { createPresignedUploadUrl, getPublicUrl } from "@/lib/r2";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 30 * 1024 * 1024; // 30 MB

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileName, fileType, fileSize, sceneId } = await req.json();

  if (!ALLOWED_TYPES.includes(fileType)) {
    return NextResponse.json(
      { error: "Dateityp nicht erlaubt. Nur JPG, PNG, WebP." },
      { status: 400 }
    );
  }

  if (fileSize > MAX_SIZE) {
    return NextResponse.json(
      { error: "Datei zu groß. Maximum: 30 MB." },
      { status: 400 }
    );
  }

  const ext = fileName.split(".").pop() ?? "jpg";
  const key = `panoramas/${session.user.id}/${sceneId}/${nanoid()}.${ext}`;

  const presignedUrl = await createPresignedUploadUrl(key, fileType, fileSize);
  const publicUrl = getPublicUrl(key);

  return NextResponse.json({ presignedUrl, key, publicUrl });
}
