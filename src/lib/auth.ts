import crypto from "crypto";

type AdminSession = {
  role: "admin";
  exp: number; // ms since epoch
};

const SESSION_COOKIE_NAME = "petar_admin_session";
const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

const getSecret = () => {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Missing ADMIN_SESSION_SECRET");
  return secret;
};

const encode = (session: AdminSession, secret: string) => {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
};

const decode = (token: string, secret: string): AdminSession | null => {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
    if (session.role !== "admin") return null;
    if (!Number.isFinite(session.exp) || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
};

export const issueAdminToken = () => {
  const secret = getSecret();
  const session: AdminSession = {
    role: "admin",
    exp: Date.now() + SESSION_TTL_MS,
  };
  return encode(session, secret);
};

export const validateAdminToken = (token: string | undefined | null) => {
  if (!token) return false;
  try {
    const secret = getSecret();
    return decode(token, secret) !== null;
  } catch {
    return false;
  }
};

export const sessionCookieName = SESSION_COOKIE_NAME;
export const sessionMaxAgeSeconds = Math.floor(SESSION_TTL_MS / 1000);
