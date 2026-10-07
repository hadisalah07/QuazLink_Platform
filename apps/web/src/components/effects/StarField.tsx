"use client";

import { useEffect, useRef } from "react";

interface StarFieldProps {
  interactive?: boolean;
  particleCount?: number;
  maxDistance?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  baseAlpha: number;
}

export function StarField({
  interactive = true,
  particleCount,
  maxDistance = 145,
}: StarFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let dpr = 1;

    // Fixed viewport sizing with capped DPR to eliminate GPU fill-rate spikes
    const updateSize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    updateSize();

    // Calibrated density: ~50-60 nodes on 1080p desktop, ~25 on mobile
    const count =
      particleCount ??
      Math.min(
        Math.max(Math.floor((width * height) / 24000), 24),
        68
      );

    const particles: Particle[] = [];
    const nodeColors = ["#22D3EE", "#818CF8", "#A78BFA", "#38BDF8"];

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: Math.random() * 1.4 + 1.1, // 1.1px to 2.5px
        color: nodeColors[i % nodeColors.length],
        baseAlpha: Math.random() * 0.35 + 0.35,
      });
    }

    const mouse = {
      x: -1000,
      y: -1000,
      active: false,
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
      mouse.active = false;
    };

    if (interactive) {
      window.addEventListener("mousemove", handleMouseMove, { passive: true });
      window.addEventListener("mouseleave", handleMouseLeave, { passive: true });
    }

    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        updateSize();
      }, 100);
    };

    window.addEventListener("resize", handleResize, { passive: true });

    let isDocumentVisible = !document.hidden;
    const handleVisibilityChange = () => {
      isDocumentVisible = !document.hidden;
      if (isDocumentVisible) {
        lastTime = performance.now();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    let lastTime = performance.now();
    const maxDistSq = maxDistance * maxDistance;
    const mouseDistSq = 160 * 160;

    const render = (now: number) => {
      if (!isDocumentVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      // Delta-time smoothing to guarantee fluid motion even under CPU hiccups
      const elapsed = (now - lastTime) / 1000;
      const dt = Math.min(elapsed, 0.1);
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      const len = particles.length;

      // 1. Position update & wrap-around
      for (let i = 0; i < len; i++) {
        const p = particles[i];

        p.x += p.vx * (dt * 60);
        p.y += p.vy * (dt * 60);

        if (p.x < -15) p.x = width + 15;
        else if (p.x > width + 15) p.x = -15;
        if (p.y < -15) p.y = height + 15;
        else if (p.y > height + 15) p.y = -15;

        // Draw particle dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.baseAlpha;
        ctx.fill();

        // 2. Connect to neighbouring particles (fast distance-squared check)
        for (let j = i + 1; j < len; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < maxDistSq) {
            const ratio = 1 - distSq / maxDistSq;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = "#8B5CF6";
            ctx.globalAlpha = ratio * 0.22;
            ctx.lineWidth = 0.9;
            ctx.stroke();
          }
        }

        // 3. Connect to mouse cursor smoothly (never pauses or halts particles)
        if (interactive && mouse.active) {
          const mdx = p.x - mouse.x;
          const mdy = p.y - mouse.y;
          const mDistSq = mdx * mdx + mdy * mdy;

          if (mDistSq < mouseDistSq) {
            const mRatio = 1 - mDistSq / mouseDistSq;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = "#22D3EE";
            ctx.globalAlpha = mRatio * 0.45;
            ctx.lineWidth = 1.1;
            ctx.stroke();
          }
        }
      }

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (interactive) {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseleave", handleMouseLeave);
      }
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearTimeout(resizeTimeout);
    };
  }, [interactive, maxDistance, particleCount]);

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
      style={{
        transform: "translateZ(0)",
        willChange: "transform",
      }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full pointer-events-none"
      />
    </div>
  );
}
