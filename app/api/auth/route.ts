// app/api/admin/route.ts
import { NextRequest } from "next/server";
import crypto from "crypto";

const SLUG_KEY = "admin_access_slug";
const EXPIRE_HOURS = 24;

function generateSlug() {
  return crypto.randomBytes(6).toString("hex").toUpperCase(); // 12 chars: 9xK2mPqR7vL3
}

function getStoredSlug() {
  const stored = process.env[SLUG_KEY];
  if (!stored) return null;
  const [slug, timestamp] = stored.split("|");
  const age = Date.now() - parseInt(timestamp);
  if (age > EXPIRE_HOURS * 60 * 60 * 1000) return null;
  return slug;
}

export async function GET() {
  let slug = getStoredSlug();
  if (!slug) {
    slug = generateSlug();
    process.env[SLUG_KEY] = `${slug}|${Date.now()}`;
  }
  return Response.json({ slug });
}