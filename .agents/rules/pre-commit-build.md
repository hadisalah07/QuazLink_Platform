# Rule: Pre-Commit Build Verification

When modifying TypeScript code—especially in a monorepo, Next.js, or Node environment—you MUST verify that the code compiles successfully before running `git commit` or deploying to production environments like Coolify.

## Why?
Type inference issues or private/public access modifier mistakes may look correct visually but will cause CI/CD pipelines or Docker builds to fail.

## Instructions
1. Run `npm run build` or `tsc` locally in the modified workspace (e.g., `cd apps/api && npm run build`).
2. Fix any compilation errors.
3. Only commit and push after a clean build.
