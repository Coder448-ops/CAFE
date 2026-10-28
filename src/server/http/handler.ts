import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { ApiError, badRequest, unauthorized } from "@/server/http/errors";
import { cookies } from "next/headers";
import { TABLE_DEVICE_COOKIE } from "@/server/auth/session";
import { resolveDeviceToken, touchDevice, type ResolvedDevice } from "@/server/services/tables";

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function jsonError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details ?? null } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message ?? "Ma'lumotlar noto'g'ri",
          details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      },
      { status: 400 },
    );
  }
  console.error("[api] unhandled error", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Serverda xatolik yuz berdi. Qayta urinib ko'ring." } },
    { status: 500 },
  );
}

type RouteContext = { params: Promise<Record<string, string>> };

/** Wraps a route handler so every failure becomes a structured JSON error. */
export function route<C extends RouteContext = RouteContext>(
  handler: (request: NextRequest, context: C) => Promise<Response> | Response,
) {
  return async (request: NextRequest, context: C): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (error) {
      return jsonError(error);
    }
  };
}

export async function parseBody<S extends ZodTypeAny>(
  request: NextRequest,
  schema: S,
): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw badRequest("So'rov tanasi JSON bo'lishi kerak");
  }
  return schema.parse(raw);
}

export function clientIp(request: NextRequest): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

export function numericParam(value: string | undefined, name = "id"): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw badRequest(`${name} noto'g'ri`);
  return parsed;
}

/** Invalidates Next's route cache for endpoints that read live state. */
export const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

// ------------------------------------------------------ customer device ----
export async function requireTableDevice(): Promise<ResolvedDevice> {
  const store = await cookies();
  const device = resolveDeviceToken(store.get(TABLE_DEVICE_COOKIE)?.value);
  if (!device) {
    throw unauthorized("Stol qurilmasi ulanmagan. Iltimos, QR kodni qayta skanerlang.");
  }
  if (!device.tableIsActive) throw unauthorized("Bu stol hozir xizmatda emas");
  touchDevice(device.deviceId);
  return device;
}

// --------------------------------------------------------- rate limiting ---
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * Minimal fixed-window limiter for login and pairing endpoints. In a
 * multi-instance deployment this belongs in Redis; documented in ARCHITECTURE.
 */
export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (existing.count >= limit) {
    throw new ApiError(429, "RATE_LIMITED", "Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring.");
  }
  existing.count += 1;
  if (buckets.size > 5000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }
}
