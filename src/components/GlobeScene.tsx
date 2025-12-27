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

const DEFAULT_POINT_OF_VIEW = { lat: 20, lng: 0 };
const FAR_ALTITUDE = 4.6;
const CLOSE_ALTITUDE = 1.1;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

const wrapLng = (lng: number) => {
  const wrapped = ((lng + 180) % 360) - 180;
  return wrapped < -180 ? wrapped + 360 : wrapped;
};

const angularDistance = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLat = lat2 - lat1;
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
};

const cartesianFromLatLng = ({ lat, lng }: { lat: number; lng: number }) => {
  const phi = toRad(lat);
  const theta = toRad(lng);
  const x = Math.cos(phi) * Math.cos(theta);
  const y = Math.cos(phi) * Math.sin(theta);
  const z = Math.sin(phi);
  return { x, y, z };
};

const latLngFromCartesian = ({ x, y, z }: { x: number; y: number; z: number }) => {
  const hyp = Math.sqrt(x * x + y * y);
  return {
    lat: toDeg(Math.atan2(z, hyp)),
    lng: wrapLng(toDeg(Math.atan2(y, x))),
  };
};

const viewForPoints = (points: Point[]) => {
  if (points.length === 0) {
    return { ...DEFAULT_POINT_OF_VIEW, farAltitude: FAR_ALTITUDE };
  }

  if (points.length === 1) {
    return { lat: points[0].lat, lng: points[0].lng, farAltitude: CLOSE_ALTITUDE + 0.1 };
  }

  const sum = points.reduce(
    (acc, point) => {
      const c = cartesianFromLatLng(point);
      acc.x += c.x;
      acc.y += c.y;
      acc.z += c.z;
      return acc;
    },
    { x: 0, y: 0, z: 0 }
  );

  const magnitude = Math.sqrt(sum.x * sum.x + sum.y * sum.y + sum.z * sum.z);
  const center =
    magnitude === 0
      ? DEFAULT_POINT_OF_VIEW
      : latLngFromCartesian({ x: sum.x / magnitude, y: sum.y / magnitude, z: sum.z / magnitude });

  const maxAngularSpread = points.reduce((max, point) => {
    const angle = angularDistance(center, point);
    return Math.max(max, angle);
  }, 0);

  // Keep the camera far enough back to see the widest-spread point while avoiding over-zooming.
  const spreadRatio = Math.min(maxAngularSpread / (Math.PI / 2), 1);
  const farAltitude =
    CLOSE_ALTITUDE +
    (FAR_ALTITUDE - CLOSE_ALTITUDE) * (0.35 + 0.65 * spreadRatio);

  return {
    ...center,
    farAltitude: Math.min(Math.max(farAltitude, CLOSE_ALTITUDE), FAR_ALTITUDE),
  };
};

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

  const basePointOfView = useMemo(() => viewForPoints(points), [points]);
  const closeAltitude = useMemo(
    () => Math.max(CLOSE_ALTITUDE, basePointOfView.farAltitude - 1.35),
    [basePointOfView.farAltitude]
  );

  useEffect(() => {
    lastAltitudeRef.current = null;
  }, [basePointOfView.lat, basePointOfView.lng, basePointOfView.farAltitude]);

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

    g.pointOfView(
      { lat: basePointOfView.lat, lng: basePointOfView.lng, altitude: basePointOfView.farAltitude },
      0
    );
    const rendererDom = g.renderer().domElement;
    rendererDom.style.pointerEvents = "none";
    rendererDom.style.touchAction = "none";
  }, [basePointOfView.lat, basePointOfView.lng, basePointOfView.farAltitude]);

  const applyBasePointOfView = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    lastAltitudeRef.current = basePointOfView.farAltitude;
    g.pointOfView(
      { lat: basePointOfView.lat, lng: basePointOfView.lng, altitude: basePointOfView.farAltitude },
      0
    );
  }, [basePointOfView]);

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
      basePointOfView.farAltitude -
      (basePointOfView.farAltitude - closeAltitude) * clampedProgress;

    if (
      lastAltitudeRef.current !== null &&
      Math.abs(lastAltitudeRef.current - targetAltitude) < 0.0005
    ) {
      return;
    }

    lastAltitudeRef.current = targetAltitude;
    g.pointOfView(
      { lat: basePointOfView.lat, lng: basePointOfView.lng, altitude: targetAltitude },
      0
    );
  }, [zoomProgress, basePointOfView, closeAltitude]);

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
