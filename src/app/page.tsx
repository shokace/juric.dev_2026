"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const GlobeScene = dynamic(() => import("@/components/GlobeScene"), { ssr: false });

export default function Home() {
  const [canRenderGlobe, setCanRenderGlobe] = useState(true);
  const [texturesPreloaded, setTexturesPreloaded] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollFrameRef = useRef<number | null>(null);

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

    const handleScroll = () => {
      if (scrollFrameRef.current !== null) return;
      scrollFrameRef.current = requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        const deadZone = Math.max(window.innerHeight * 0.12, 80); // keep initial view until user scrolls a bit
        const scrollRange = Math.max(window.innerHeight * 0.8, 1);
        const offsetY = Math.max(window.scrollY - deadZone, 0);
        const progress = Math.min(offsetY / scrollRange, 1);
        setScrollProgress((prev) => {
          // Skip tiny updates to avoid extra React work during fast scrolls
          if (Math.abs(prev - progress) < 0.003) return prev;
          return progress;
        });
      });
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    };
  }, []);

  return (
    <main className="bg-neutral-950">
      {/* Hero + Globe (single section) */}
      <section className="pt-40 pb-16 sm:px-12 sm:pt-48 sm:pb-20">
        <div className="mx-auto flex w-full flex-col gap-10">
          <div className="flex flex-col items-center px-6 text-center sm:px-0">
            <div className="text-6xl sm:text-7xl md:text-8xl font-semibold tracking-tight">
              Juric<span className="text-neutral-400">.</span>
            </div>
            <p className="max-w-2xl text-base text-neutral-300 sm:text-lg sm:mx-auto">
              Welcome, the globe with your two points, then the follow-up. No fades or
              sticky layers—just scroll.
            </p>
          </div>

          <div className="relative left-1/2 w-screen -translate-x-1/2 mt-24 sm:mt-28 sm:static sm:w-full sm:translate-x-0">
            {canRenderGlobe ? (
              <GlobeScene texturesReady={texturesPreloaded} zoomProgress={scrollProgress} />
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
