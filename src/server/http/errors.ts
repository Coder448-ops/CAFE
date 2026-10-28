/** Domain error with an HTTP status and a user-facing Uzbek message. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message = "Ma'lumotlar noto'g'ri", details?: unknown) =>
  new ApiError(400, "BAD_REQUEST", message, details);

export const unauthorized = (message = "Avval tizimga kiring") =>
  new ApiError(401, "UNAUTHORIZED", message);

export const forbidden = (message = "Bu amal uchun ruxsat yo'q") =>
  new ApiError(403, "FORBIDDEN", message);

export const notFound = (message = "Ma'lumot topilmadi") => new ApiError(404, "NOT_FOUND", message);

export const conflict = (message = "Amalni bajarib bo'lmadi", details?: unknown) =>
  new ApiError(409, "CONFLICT", message, details);

export const unprocessable = (message = "Amalni bajarib bo'lmadi", details?: unknown) =>
  new ApiError(422, "UNPROCESSABLE", message, details);
