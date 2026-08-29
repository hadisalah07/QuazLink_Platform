# Next.js App Router Navigation Rule

## Context
In Next.js App Router (v13+), the client-side router heavily caches Server Component payloads.

## Rule
When performing post-authentication redirects or any navigation where you must guarantee that the server re-evaluates the layout (e.g., after setting a session cookie on the client), **DO NOT** use:
```typescript
router.push("/dashboard");
router.refresh();
```
This pattern is known to cause race conditions, infinite redirect loops, and "Throttling navigation" browser crashes.

**INSTEAD, ALWAYS USE:**
```typescript
window.location.href = "/dashboard";
```

Using a hard browser redirect completely bypasses the Next.js client router cache, ensuring a fresh Server Component request and preventing corrupted cache states.
