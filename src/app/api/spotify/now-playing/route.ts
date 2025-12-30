import { NextResponse } from "next/server";

type SpotifyCurrentlyPlaying = {
  is_playing: boolean;
  progress_ms: number | null;
  item: {
    name: string;
    duration_ms: number;
    external_urls?: { spotify?: string };
    album?: {
      name?: string;
      images?: { url: string; width: number; height: number }[];
    };
    artists?: { name?: string }[];
  } | null;
};

type PlaybackPayload = {
  isPlaying: boolean;
  track?: string;
  artists?: string;
  album?: string;
  albumImageUrl?: string;
  trackUrl?: string;
  durationMs?: number;
  progressMs?: number;
  lastUpdated: string;
  source: "spotify";
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const NOW_PLAYING_URL = "https://api.spotify.com/v1/me/player/currently-playing";
const TOKEN_EXPIRY_BUFFER_MS = 60_000; // refresh a minute before Spotify expires the token
const PLAYBACK_CACHE_MS = 8_000;

const tokenCache: { accessToken: string | null; expiresAt: number } = {
  accessToken: null,
  expiresAt: 0,
};

const playbackCache: { payload: PlaybackPayload | null; fetchedAt: number } = {
  payload: null,
  fetchedAt: 0,
};

const getEnv = () => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing one of SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN");
  }

  return { clientId, clientSecret, refreshToken };
};

const fetchAccessToken = async () => {
  const { clientId, clientSecret, refreshToken } = getEnv();

  if (tokenCache.accessToken && tokenCache.expiresAt > Date.now() + TOKEN_EXPIRY_BUFFER_MS) {
    return tokenCache.accessToken;
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to refresh Spotify token: ${res.status} ${errorBody.slice(0, 200)}`);
  }

  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token || typeof body.expires_in !== "number") {
    throw new Error("Unexpected token response from Spotify");
  }

  tokenCache.accessToken = body.access_token;
  tokenCache.expiresAt = Date.now() + body.expires_in * 1000;
  return tokenCache.accessToken;
};

const pickAlbumImage = (images: { url: string; width: number; height: number }[] | undefined) => {
  if (!images || images.length === 0) return undefined;
  // Prefer a mid-sized square image to keep payload light.
  const sorted = [...images].sort((a, b) => (a.width || 0) - (b.width || 0));
  const targetWidth = 320;
  let best = sorted[0];
  for (const img of sorted) {
    if (Math.abs((img.width || targetWidth) - targetWidth) < Math.abs((best.width || targetWidth) - targetWidth)) {
      best = img;
    }
  }
  return best.url;
};

const fetchNowPlaying = async (retry = true): Promise<PlaybackPayload> => {
  const accessToken = await fetchAccessToken();

  const res = await fetch(NOW_PLAYING_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (res.status === 204) {
    return {
      isPlaying: false,
      lastUpdated: new Date().toISOString(),
      source: "spotify",
    };
  }

  if (res.status === 401 && retry) {
    // Token likely expired before buffer; clear cache and retry once.
    tokenCache.accessToken = null;
    tokenCache.expiresAt = 0;
    return fetchNowPlaying(false);
  }

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Spotify now-playing failed: ${res.status} ${errorBody.slice(0, 200)}`);
  }

  const body = (await res.json()) as SpotifyCurrentlyPlaying;
  const item = body.item;

  if (!item) {
    return {
      isPlaying: false,
      lastUpdated: new Date().toISOString(),
      source: "spotify",
    };
  }

  const artists = item.artists?.map((a) => a.name).filter(Boolean).join(", ");
  const payload: PlaybackPayload = {
    isPlaying: Boolean(body.is_playing),
    track: item.name,
    artists: artists || undefined,
    album: item.album?.name || undefined,
    albumImageUrl: pickAlbumImage(item.album?.images),
    trackUrl: item.external_urls?.spotify,
    durationMs: item.duration_ms,
    progressMs: body.progress_ms ?? undefined,
    lastUpdated: new Date().toISOString(),
    source: "spotify",
  };

  return payload;
};

export async function GET() {
  try {
    if (playbackCache.payload && Date.now() - playbackCache.fetchedAt < PLAYBACK_CACHE_MS) {
      return NextResponse.json(playbackCache.payload, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const payload = await fetchNowPlaying();
    playbackCache.payload = payload;
    playbackCache.fetchedAt = Date.now();

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
