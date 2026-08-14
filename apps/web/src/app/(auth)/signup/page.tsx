"use client";

import * as React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/effects/GlassCard";
import { fadeIn } from "@/lib/motion";
import { ArrowRight } from "lucide-react";
import { signup } from "@/lib/api";

const inputClass =
  "w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-quaz-cyan)] transition-all";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await signup({ email, password, name: name || undefined });
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Sign up failed");
      setPending(false);
    }
  }

  return (
    <motion.div initial="initial" animate="animate" variants={fadeIn}>
      <GlassCard className="flex flex-col p-8 space-y-6">
        <div className="flex flex-col space-y-2 text-center mb-4">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Create your account
          </h1>
          <p className="text-sm text-gray-400">
            Join QuazLink and start automating your social channels.
          </p>
        </div>

        <form className="flex flex-col space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-gray-300">
              Name <span className="text-gray-500">(optional)</span>
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              className={inputClass}
            />
          </div>

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
              placeholder="you@company.com"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-gray-300">
              Password <span className="text-gray-500">(min. 8 characters)</span>
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
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
            <span>{pending ? "Creating account…" : "Create account"}</span>
            {!pending && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--color-quaz-cyan)] hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </GlassCard>
    </motion.div>
  );
}
