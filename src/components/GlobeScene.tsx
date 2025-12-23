"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GlobeMethods } from "react-globe.gl";
import { haversineKm } from "@/lib/geo";

type Point = { lat: number; lng: number; label: string };

type GlobeSceneProps = {
  texturesReady?: boolean;
  zoomProgress?: number;
};

type MaybeWebGPUGlobal = typeof globalThis & {
  GPUShaderStage?: { VERTEX: number; FRAGMENT: number; COMPUTE: number };
  GPUBufferUsage?: {
    MAP_READ: number;
    MAP_WRITE: number;
    COPY_SRC: number;
    COPY_DST: number;
    INDEX: number;
    VERTEX: number;
    UNIFORM: number;
    STORAGE: number;
    INDIRECT: number;
    QUERY_RESOLVE: number;
  };
};

const Globe = dynamic(async () => {
  if (typeof globalThis !== "undefined") {
    const g = globalThis as MaybeWebGPUGlobal;
    g.GPUShaderStage ??= { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 };
    g.GPUBufferUsage ??= {
      MAP_READ: 1,
      MAP_WRITE: 2,
      COPY_SRC: 4,
      COPY_DST: 8,
      INDEX: 16,
      VERTEX: 32,
      UNIFORM: 64,
      STORAGE: 128,
      INDIRECT: 256,
      QUERY_RESOLVE: 512,
    };
  }
  return import("react-globe.gl");
}, { ssr: false });

const BASE_POINT_OF_VIEW = { lat: 20, lng: 0 };
const FAR_ALTITUDE = 1.2;
const CLOSE_ALTITUDE = 0.6;

export default function GlobeScene({ texturesReady = true, zoomProgress = 0 }: GlobeSceneProps) {
  const globeRef = useRef<GlobeMethods | null>(null);
  const lastAltitudeRef = useRef<number | null>(null);
  const [devicePixelRatio] = useState(() =>
    typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 1.5) : 1.5
  );

  const me: Point = useMemo(
    () => ({ lat: 45.815, lng: 15.9819, label: "Petar (general area)" }),
    []
  );
  const viewer: Point = useMemo(
    () => ({ lat: 37.7749, lng: -122.4194, label: "Viewer (placeholder)" }),
    []
  );

  const distanceKm = useMemo(() => {
    return Math.round(
      haversineKm({ lat: me.lat, lng: me.lng }, { lat: viewer.lat, lng: viewer.lng })
    );
  }, [me, viewer]);

  const points = useMemo(() => [me, viewer], [me, viewer]);
  const arcs = useMemo(
    () => [{ startLat: viewer.lat, startLng: viewer.lng, endLat: me.lat, endLng: me.lng }],
    [viewer, me]
  );

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;

    const controls = g.controls();
    controls.enabled = false;
    controls.enableRotate = false;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0;

    g.pointOfView({ ...BASE_POINT_OF_VIEW, altitude: FAR_ALTITUDE }, 0);
    const rendererDom = g.renderer().domElement;
    rendererDom.style.pointerEvents = "none";
    rendererDom.style.touchAction = "none";
  }, []);

  const applyBasePointOfView = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    lastAltitudeRef.current = FAR_ALTITUDE;
    g.pointOfView({ ...BASE_POINT_OF_VIEW, altitude: FAR_ALTITUDE }, 0);
  }, []);

  useEffect(() => {
    // Re-assert baseline when textures change or on first mount. Use RAF + timeout to
    // survive internal three.js ready timing.
    const raf = requestAnimationFrame(applyBasePointOfView);
    const timeout = setTimeout(applyBasePointOfView, 120);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
  }, [applyBasePointOfView, texturesReady]);

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;

    const clampedProgress = Math.min(Math.max(zoomProgress, 0), 1);
    const targetAltitude =
      FAR_ALTITUDE - (FAR_ALTITUDE - CLOSE_ALTITUDE) * clampedProgress;

    if (
      lastAltitudeRef.current !== null &&
      Math.abs(lastAltitudeRef.current - targetAltitude) < 0.0005
    ) {
      return;
    }

    lastAltitudeRef.current = targetAltitude;
    g.pointOfView({ ...BASE_POINT_OF_VIEW, altitude: targetAltitude }, 0);
  }, [zoomProgress]);

  return (
    <div className="relative h-full w-full bg-neutral-950">
      <Globe
        className="h-full w-full pointer-events-none"
        ref={globeRef}
        onGlobeReady={applyBasePointOfView}
        globeImageUrl="https://unpkg.com/three-globe/example/img/earth-dark.jpg"
        backgroundColor="rgba(0,0,0,0)"
        showAtmosphere
        atmosphereAltitude={0.18}
        bumpImageUrl={texturesReady ? "https://unpkg.com/three-globe/example/img/earth-topology.png" : undefined}
        rendererConfig={{ antialias: false, powerPreference: "low-power" }}
        devicePixelRatio={devicePixelRatio}
        enablePointerInteraction={false}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => "rgba(255,255,255,0.9)"}
        pointRadius={0.3}
        pointAltitude={0.02}
        arcsData={arcs}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor={() => ["rgba(255,255,255,0.15)", "rgba(94, 234, 180, 0.85)"]}
        arcAltitude={0.22}
        arcStroke={0.7}
        arcDashLength={0.5}
        arcDashGap={2.2}
        arcDashAnimateTime={1600}
      />

      {/* Interaction blocker to keep globe fixed while allowing vertical scroll */}
      <div
        className="absolute inset-0 z-10"
        style={{ pointerEvents: "auto", touchAction: "pan-y" }}
      />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-7 right-7 top-7 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">Distance</div>
            <div className="mt-1 text-3xl font-semibold tracking-tight text-white">
              {distanceKm.toLocaleString()} km
            </div>
            <div className="mt-1 text-sm text-white/60">Two points. One moment.</div>
          </div>
          <div className="hidden gap-2 sm:flex text-xs text-white/60">
            <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-white" />
              Petar
            </span>
            <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              You
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
