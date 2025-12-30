"use client";

import { useEffect, useMemo, useState } from "react";

type NowPlayingResponse = {
  isPlaying: boolean;
  track?: string;
  artists?: string;
  album?: string;
  albumImageUrl?: string;
  trackUrl?: string;
  durationMs?: number;
  progressMs?: number;
  lastUpdated?: string;
  source?: string;
  error?: string;
};

const formatMs = (ms: number | undefined) => {
  if (typeof ms !== "number" || Number.isNaN(ms)) return "0:00";
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const formatUpdatedAgo = (lastUpdated?: string) => {
  if (!lastUpdated) return "just now";
  const diffMs = Math.max(0, Date.now() - new Date(lastUpdated).getTime());
  if (diffMs < 30_000) return "just now";
  if (diffMs < 90_000) return "1 minute ago";
  const minutes = Math.round(diffMs / 60_000);
  return `${minutes} minutes ago`;
};

export function NowPlaying() {
  const [data, setData] = useState<NowPlayingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const pullNowPlaying = async () => {
      try {
        const res = await fetch("/api/spotify/now-playing", { cache: "no-store" });
        const body = (await res.json()) as NowPlayingResponse;

        if (!res.ok) {
          throw new Error(body.error || `Request failed with ${res.status}`);
        }

        if (!cancelled) {
          setData(body);
          setError(null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (!cancelled) {
          setError(message);
        }
      }
    };

    pullNowPlaying();
    const interval = setInterval(pullNowPlaying, 8_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const derivedProgressMs = useMemo(() => {
    if (!data?.isPlaying) return data?.progressMs ?? 0;
    const lastUpdated = data.lastUpdated ? new Date(data.lastUpdated).getTime() : Date.now();
    const elapsed = Date.now() - lastUpdated;
    const base = data.progressMs ?? 0;
    const duration = data.durationMs ?? base;
    return Math.min(duration, base + elapsed);
  }, [data]);

  const progressPercent =
    data?.durationMs && data.durationMs > 0
      ? Math.min(100, (derivedProgressMs / data.durationMs) * 100)
      : 0;

  const playingState = data?.isPlaying ? "Live from Spotify" : "Offline";
  const subtitle =
    data?.artists && data.album
      ? `${data.artists} • ${data.album}`
      : data?.artists || data?.album || "Waiting for playback";

  return (
    <div className="mx-auto w-full max-w-4xl rounded-2xl border border-white/10 bg-white/5 px-5 py-4 sm:px-7 sm:py-6">
      <div className="flex items-center gap-4 sm:gap-6">
        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5 sm:h-24 sm:w-24">
          {data?.albumImageUrl ? (
            <img
              src={data.albumImageUrl}
              alt={data.album ? `${data.album} cover` : "Album art"}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-white/40">
              No art
            </div>
          )}
          <div className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/80">
            {playingState}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <div className="text-[11px] uppercase tracking-[0.32em] text-white/50">
              Currently listening
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {data?.track ? (
                  <a
                    href={data.trackUrl || undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="line-clamp-1 text-lg font-semibold text-white transition hover:text-emerald-200 sm:text-xl"
                  >
                    {data.track}
                  </a>
                ) : (
                  <div className="text-lg font-semibold text-white sm:text-xl">
                    Not playing
                  </div>
                )}
                <div className="line-clamp-1 text-sm text-white/60">{subtitle}</div>
              </div>
              <div className="text-right text-xs text-white/50">
                {data?.lastUpdated ? `Updated ${formatUpdatedAgo(data.lastUpdated)}` : "—"}
              </div>
            </div>
          </div>

          <div>
            <div className="h-1.5 w-full rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-300 transition-[width] duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-white/50">
              <span>{formatMs(derivedProgressMs)}</span>
              <span>{formatMs(data?.durationMs)}</span>
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-200/80">Playback lookup failed: {error}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NowPlaying;
