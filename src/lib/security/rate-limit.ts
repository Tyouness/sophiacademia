import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

function ensureRedis() {
  if (!redis && process.env.NODE_ENV === "production") {
    throw new Error("Missing Upstash Redis configuration.");
  }
  return redis;
}

const loginLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "10 m"),
      analytics: true,
    })
  : null;

const sensitiveLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "10 m"),
      analytics: true,
    })
  : null;

export async function rateLimitLogin(key: string) {
  ensureRedis();
  if (!loginLimiter) {
    return { success: true, remaining: 0, limit: 0, reset: 0 };
  }
  return loginLimiter.limit(key);
}

export async function rateLimitSensitive(key: string) {
  ensureRedis();
  if (!sensitiveLimiter) {
    return { success: true, remaining: 0, limit: 0, reset: 0 };
  }
  return sensitiveLimiter.limit(key);
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
