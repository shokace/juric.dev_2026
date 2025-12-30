import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  issueAdminToken,
  sessionCookieName,
  sessionMaxAgeSeconds,
  validateAdminToken,
} from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const getPassword = () => process.env.ADMIN_PASSWORD || null;

export async function GET(req: NextRequest) {
  const existing = req.cookies.get(sessionCookieName)?.value;
  const authenticated = validateAdminToken(existing);
  return NextResponse.json({ authenticated });
}

export async function POST(req: NextRequest) {
  let password: string | undefined;
  try {
    ({ password } = (await req.json()) as { password?: string });
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const requiredPassword = getPassword();
  if (!requiredPassword) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD is not set." },
      { status: 500 }
    );
  }

  if (!password || password !== requiredPassword) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = issueAdminToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: sessionCookieName,
    value: token,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds,
  });
  return res;
}
