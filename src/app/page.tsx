"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const GlobeScene = dynamic(() => import("@/components/GlobeScene"), { ssr: false });

export default function Home() {
  const [canRenderGlobe, setCanRenderGlobe] = useState(true);
  const [texturesPreloaded, setTexturesPreloaded] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      setCanRenderGlobe(Boolean(gl));
    });

    // Preload textures up front for a smoother first render
    const imgs = [
      "https://unpkg.com/three-globe/example/img/earth-dark.jpg",
      "https://unpkg.com/three-globe/example/img/earth-topology.png",
    ];
    Promise.all(
      imgs.map(
        (src) =>
          new Promise((resolve) => {
            const i = new Image();
            i.onload = resolve;
            i.onerror = resolve;
            i.src = src;
          })
      )
    ).finally(() => setTexturesPreloaded(true));

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <main className="bg-neutral-950">
      {/* Hero + Globe (single section) */}
      <section className="py-16 sm:px-12 sm:py-20">
        <div className="mx-auto flex w-full flex-col gap-10">
          <div className="flex flex-col px-6 sm:px-0">
            <div className="text-xs uppercase tracking-[0.2em] text-emerald-300/70">Scroll story</div>
            <div className="text-6xl sm:text-7xl md:text-8xl font-semibold tracking-tight">
              Juric<span className="text-neutral-400">.</span>
            </div>
            <p className="max-w-2xl text-base sm:text-lg text-neutral-300">
              Welcome, the globe with your two points, then the follow-up. No fades or
              sticky layers—just scroll.
            </p>
          </div>

          <div className="relative left-1/2 w-screen -translate-x-1/2 sm:static sm:w-full sm:translate-x-0">
            {canRenderGlobe ? (
              <GlobeScene texturesReady={texturesPreloaded} />
            ) : (
              <div className="">
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
