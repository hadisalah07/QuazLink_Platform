"use client";

import * as React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/effects/GlassCard";
import { fadeIn } from "@/lib/motion";
import { ArrowRight } from "lucide-react";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login({ email, password });
      // Refresh so server components (layout /me) pick up the new session.
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Login failed");
      setPending(false);
    }
  }

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={fadeIn}
    >
      <GlassCard className="flex flex-col p-8 space-y-6">
        <div className="flex flex-col space-y-2 text-center mb-4">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Welcome Back
          </h1>
          <p className="text-sm text-gray-400">
            Connect your nodes and automate your world.
          </p>
        </div>

        <form className="flex flex-col space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-gray-300">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@quazlink.com"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-quaz-cyan)] transition-all"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-gray-300">
                Password
              </label>
              <a href="#" className="text-xs text-[var(--color-quaz-cyan)] hover:underline">
                Forgot password?
              </a>
            </div>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-quaz-cyan)] transition-all"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 mt-2 rounded-xl bg-white text-black font-semibold hover:bg-gray-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span>{pending ? "Signing In…" : "Sign In"}</span>
            {!pending && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[var(--color-quaz-bg)] px-2 text-gray-500 rounded-full">Or continue with</span>
          </div>
        </div>

        <button
          type="button"
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          <span>GitHub</span>
        </button>

        <p className="text-center text-sm text-gray-400 mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[var(--color-quaz-cyan)] hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </GlassCard>
    </motion.div>
  );
}
