import { NextResponse } from "next/server";
import { headers } from "next/headers";

type IpApiPayload = {
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  region_code?: string;
  country?: string;
  country_name?: string;
  ip?: string;
};

export const dynamic = "force-dynamic";

export async function GET() {
  const hdrs = headers();
  const forwardedFor = hdrs.get("x-forwarded-for");
  const realIp = hdrs.get("x-real-ip");
  const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "";

  const apiUrl = ip ? `https://ipapi.co/${ip}/json/` : "https://ipapi.co/json/";

  try {
    const res = await fetch(apiUrl, {
      cache: "no-store",
      headers: { "User-Agent": "juric-ip-proxy/1.0" },
    });

    if (!res.ok) {
      const errorBody = await res.text();
      return NextResponse.json(
        { error: `Lookup failed with ${res.status}`, details: errorBody.slice(0, 280) },
        { status: 502 }
      );
    }

    const body = (await res.json()) as IpApiPayload;

    if (typeof body.latitude !== "number" || typeof body.longitude !== "number") {
      return NextResponse.json(
        { error: "Latitude/longitude missing from provider response", raw: body },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        lat: body.latitude,
        lng: body.longitude,
        city: body.city || undefined,
        region: body.region || body.region_code || undefined,
        country: body.country_name || body.country || undefined,
        ip: body.ip || (ip || undefined),
        source: "ipapi.co",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "IP lookup failed", message }, { status: 500 });
  }
}
