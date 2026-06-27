import { createPresignedGetUrl } from "@/lib/r2";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const storageKey = key.join("/");

  try {
    const signedUrl = await createPresignedGetUrl(storageKey);
    return NextResponse.redirect(signedUrl, { status: 302 });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
