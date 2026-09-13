# Rule: Strict User Authority, Zero Unprompted Changes & QuazCode CoWork Alignment

## Core Mandates

### 1. Zero Unprompted Architectural / Config Modifications (ممنوع التغيير من الدماغ)
- You MUST NEVER change existing working models, configurations, API keys, platform nodes, or environment parameters based on personal assumptions.
- If a value looks unfamiliar or differs from default expectations (e.g., model name `gemini-3.5-flash-lite`), you MUST cross-reference project documentation (e.g., `CATALOGS_PLAN.md`, `ARCHITECTURE.md`) and ask the user or present it in a plan before touching it.
- Never modify any core component outside the explicit scope requested by the user.

### 2. Mandatory Consultation with QuazCode CoWork Team
- Before planning or applying any significant change, refactor, or automation fix:
  - Engage the appropriate QuazCode CoWork agents (e.g., `general-manager` for validation and preventing side-effects, `backend-architect` for system design, `automation-manager` for browser/node flows).
  - Review and align with established team roles and guidelines.
  - Adhere strictly to the project's architectural standards and conventions.

### 3. Pinned System Constants & Invariants
- **AI Model**: The official, pinned AI model for text generation and autonomous assistance is strictly **`gemini-3.5-flash-lite`**. Do NOT alter, upgrade, or downgrade this model name unless explicitly instructed by the user.
- **Execution Isolation**: Node executions (Facebook, Instagram) must remain strictly isolated. Changes to one platform must never mutate or regress another.
