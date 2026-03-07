import crypto from "crypto";

export type StudentSessionPayload = {
  sid: number; // students.id (db id)
  student_number: string; // students.student_id
  mustSetPassword?: boolean;
  exp: number; // unix seconds
};

function base64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function unbase64url(input: string) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64").toString("utf8");
}

function secret(): string {
  const s = process.env.STUDENT_SESSION_SECRET || process.env.NEXTAUTH_SECRET || "";
  if (!s && process.env.NODE_ENV === "production") {
    throw new Error("Missing STUDENT_SESSION_SECRET");
  }
  return s || "dev-student-session-secret";
}

export function signStudentSession(payload: StudentSessionPayload): string {
  const body = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyStudentSession(token: string | null | undefined): StudentSessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const parsed = JSON.parse(unbase64url(body)) as StudentSessionPayload;
    if (!parsed || typeof parsed.sid !== "number" || typeof parsed.exp !== "number") return null;
    const now = Math.floor(Date.now() / 1000);
    if (parsed.exp <= now) return null;
    return parsed;
  } catch {
    return null;
  }
}

