import { db } from "@/lib/db";
import { analyticsEvents } from "@/lib/db/schema";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { tourId, sceneId, hotspotId, eventType, sessionId } = await req.json();

  if (!tourId || !eventType) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const ua = req.headers.get("user-agent") ?? "";
  const deviceType = /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop";

  await db.insert(analyticsEvents).values({
    tourId,
    sceneId: sceneId ?? null,
    hotspotId: hotspotId ?? null,
    eventType,
    sessionId: sessionId ?? null,
    deviceType,
    referrer: req.headers.get("referer") ?? null,
  });

  return NextResponse.json({ ok: true });
}
