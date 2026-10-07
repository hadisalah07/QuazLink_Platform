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
}

export function StarField({
  interactive = true,
  particleCount,
  maxDistance = 140,
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

    // Fast, lightweight viewport sizing with 1.0 DPR for 0ms fill-rate overhead
    const updateSize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    updateSize();

    // Optimal particle density: 36 nodes on desktop, 20 on mobile
    const count =
      particleCount ??
      (width > 768 ? 38 : 20);

    const particles: Particle[] = [];
    const colors = ["#22D3EE", "#818CF8", "#A78BFA", "#38BDF8"];

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 1.2 + 1.2,
        color: colors[i % colors.length],
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

    let resizeTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateSize, 150);
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
    const mouseDistSq = 150 * 150;

    const render = (now: number) => {
      if (!isDocumentVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      // Delta-time smoothing
      const elapsed = (now - lastTime) / 1000;
      const dt = Math.min(elapsed, 0.1);
      lastTime = now;
      const speedMultiplier = dt * 60;

      ctx.clearRect(0, 0, width, height);

      const len = particles.length;

      // 1. Move particles
      for (let i = 0; i < len; i++) {
        const p = particles[i];
        p.x += p.vx * speedMultiplier;
        p.y += p.vy * speedMultiplier;

        if (p.x < -10) p.x = width + 10;
        else if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        else if (p.y > height + 10) p.y = -10;
      }

      // 2. Batch Draw Constellation Lines (SINGLE draw call)
      ctx.beginPath();
      for (let i = 0; i < len; i++) {
        const p = particles[i];
        for (let j = i + 1; j < len; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          if (dx * dx + dy * dy < maxDistSq) {
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
          }
        }
      }
      ctx.strokeStyle = "rgba(139, 92, 246, 0.16)";
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // 3. Batch Draw Mouse Interaction Lines (SINGLE draw call)
      if (interactive && mouse.active) {
        ctx.beginPath();
        for (let i = 0; i < len; i++) {
          const p = particles[i];
          const mdx = p.x - mouse.x;
          const mdy = p.y - mouse.y;
          if (mdx * mdx + mdy * mdy < mouseDistSq) {
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
          }
        }
        ctx.strokeStyle = "rgba(34, 211, 238, 0.35)";
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }

      // 4. Draw Particle Dots
      for (let i = 0; i < len; i++) {
        const p = particles[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.55;
        ctx.fill();
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
      clearTimeout(resizeTimer);
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
