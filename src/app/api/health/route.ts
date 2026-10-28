import { NextResponse } from "next/server";
import { getDb } from "@/server/db/client";
import { route } from "@/server/http/handler";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const row = getDb().prepare("SELECT 1 AS ok").get() as { ok: number };
  return NextResponse.json({ status: "ok", database: row.ok === 1 ? "up" : "down", time: new Date().toISOString() });
});
