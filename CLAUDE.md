# Poof V3 Template

React 19 + Vite 6 + TypeScript frontend (src/), Hono backend on Cloudflare Workers (partyserver/).
API status codes: 200, 400, 401, 404, 500 only.

## Quick Reference

- **Theme**: Edit `src/theme.ts` (colors, font, radius).
- **Routes**: Register in `partyserver/src/routes/index.ts` + add to `routeSpec[]`.
- **Packages**: Use MCP tools (`add_package`, `remove_package`), not package.json or bash.
- **Build**: `bun run build:full`
- **Toasts**: Sonner — `toast.success()`, `toast.error()`
- **Icons**: Lucide React
- **Validation**: Zod — use `safeParse()` and access `result.error.issues` (NOT `.errors`)
- **Imports**: Always use `@/` paths
- **Page shell**: Wrap pages in `PageLayout` from `@/components/poof-ui` (handles nav, wallet, footer, container)

## File Structure

```
src/
├── components/
│   ├── HomePage.tsx            # Main landing page
│   ├── effects/                # Visual effects (AuroraBackground, Particles, etc.)
│   ├── poof-ui/                # Layout components (PageLayout, HeroSection, etc.)
│   └── ui/                     # shadcn/ui primitives
├── hooks/                      # Custom hooks (useRealtimeData, useDflowMarkets, etc.)
├── lib/
│   ├── config.ts               # PARTYSERVER_URL, env helpers
│   ├── constants.ts            # App constants
│   └── themes.ts               # Theme utilities
├── theme.ts                    # Theme config (colors, font, radius)
├── App.tsx                     # Router + route definitions
├── main.tsx                    # Entry point
├── styles/base.css             # Base styles
└── poof-styling.css            # Platform styles (never edit)
partyserver/
├── scripts/
│   └── generate-api-spec.ts    # Generates generated/api-spec.json from routeSpec
├── generated/                  # Build output (api-spec.json) — git-ignored
└── src/
    ├── index.ts                # Hono app setup, middleware stack
    ├── constants.ts            # App constants (e.g. PROJECT_VAULT_ADDRESS)
    ├── routes/
    │   ├── index.ts            # Route registration + routeSpec[] (add routes here)
    │   ├── oauth-callback.ts   # OAuth callback handler (disabled by default)
    │   └── social-links.ts     # Social link CRUD (disabled by default)
    └── lib/
        ├── poof-auth.ts        # validatePoofAuth(c) / validatePoofAuth(c, true)
        ├── cors-helpers.ts     # CORS (auto-configured, no per-route setup)
        ├── api-response.ts     # sendSuccess, ApiErrors, requestIdMiddleware
        ├── config.ts           # Tarobase/Cognito config
        ├── request-logger.ts   # Request logging
        ├── poof-oauth.ts       # OAuth JWT verification
        └── x402-middleware.ts   # Payment enforcement (@x402/hono)
```

## Frontend

### Styling & Theming

Edit `src/theme.ts` to change the look:

```typescript
export const themeConfig = {
  colors: {
    primary: '#6366f1',     // Main accent
    background: '#0a0a0a',  // Page background
    card: '#141414',        // Card/surface background
    text: '#ffffff',        // Primary text
    muted: '#a1a1aa',       // Secondary text
    border: '#27272a',      // Borders
    accent: '#818cf8',      // Secondary accent
  },
  font: {
    family: 'Inter, system-ui, sans-serif',
    mono: 'JetBrains Mono, monospace',
  },
  radius: '0.75rem',
};
```

### Component Catalog

Use shadcn/ui primitives from `@/components/ui/*` — they auto-apply the theme. Available: Button, Card, Input, Dialog, Select, Tabs, Table, Badge, Avatar, Tooltip, Sheet, Separator, ScrollArea, etc.

**Effects** from `@/components/effects/*`: AuroraBackground, Particles, MagicCard, ShootingStars, TypewriterEffect, SparklesText, GradientText, AnimatedGridPattern, Meteors, etc.

**Poof UI** from `@/components/poof-ui/*`: PageLayout, HeroSection, FeatureCard, MetricGrid.

When a component doesn't exist in the catalog, create it in its own file under `src/components/`.

### Routing

```typescript
// src/App.tsx
<Route path="/" element={<HomePage />} />
<Route path="/dashboard" element={<Dashboard />} />
```

Navigate: `import { useNavigate } from 'react-router-dom'`

---

## Backend

Hono-based API server running on Cloudflare Workers.

### How It Works

The backend is a Hono app exported as a Cloudflare Worker. `index.ts` sets up middleware (CORS, auth, logging, x402) and delegates to `routes/index.ts`.

### Adding Routes

All routes are registered in `partyserver/src/routes/index.ts`. Two steps:

1. Register the Hono handler
2. Add an entry to the `routeSpec[]` array (for API spec generation — the platform displays available routes from this)

```typescript
// In routeSpec array:
{ method: 'GET', path: '/api/items', description: 'List items', auth: false },
{ method: 'POST', path: '/api/items', description: 'Create item', auth: true },

// Route handlers:
app.get('/api/items', (c) => sendSuccess(c, { items: [] }));

app.post('/api/items', async (c) => {
  const { walletAddress } = await validatePoofAuth(c);
  const body = await c.req.json();
  return sendSuccess(c, { created: true });
});

// Admin-only:
app.delete('/api/admin/reset', async (c) => {
  const { walletAddress } = await validatePoofAuth(c, true);
  return sendSuccess(c, { reset: true });
});
```

The build step runs `bun run generate-spec` which reads `routeSpec` and writes `generated/api-spec.json`. The platform reads this after deploy to show available routes.

### Authentication

Import `validatePoofAuth` from `./lib/poof-auth.js` at the start of any protected route:

```typescript
// Normal user authentication
const { walletAddress } = await validatePoofAuth(c);

// Admin-only authentication
const { walletAddress } = await validatePoofAuth(c, true);
```

- Reads `Authorization: Bearer <token>` and `X-Wallet-Address` headers
- Verifies Cognito JWT (JWKS cached 1hr in Cloudflare Cache)
- Admin routes call Session API verify-admin endpoint
- Throws `AuthenticationError` (401) on failure

### Response Format

All responses: `{ success, data/error, timestamp, requestId }`

```typescript
import { sendSuccess, ApiErrors } from '../lib/api-response.js';

sendSuccess(c, { items: [] });                    // 200
ApiErrors.badRequest(c, 'Invalid input');          // 400
ApiErrors.unauthorized(c, 'Not logged in');        // 401
ApiErrors.notFound(c, 'Item not found');           // 404
ApiErrors.internal(c, 'Something broke');          // 500
```

### CORS

Auto-configured globally — no per-route setup needed for the common cases.

**How it works:** The platform builds the allowed-origin list at deploy time from the project's domain list (`<slug>-preview.poof.new`, `<slug>.poof.new`, custom domains added in Cloud → Domains, etc.) and injects it into `wrangler.toml` as `CORS_DEV_DOMAINS` (preview/draft) and `CORS_PROD_DOMAINS` (live + mainnet-preview). `partyserver/src/lib/cors-helpers.ts` reads those env vars at runtime. Match is **exact** (no wildcards), with a special case for any localhost port in dev.

**To add an origin the platform won't auto-generate** (a custom staging URL, an external partner site you don't own as a custom domain, etc.):

1. Preferred: have the user add the domain in Cloud → Domains. The next deploy picks it up via `CORS_PROD_DOMAINS`. No code changes.
2. Code escape hatch: edit `partyserver/src/lib/cors-helpers.ts` directly. The file is editable. Add origins inside `initializeCORS()` (e.g. push to the `domains` list before calling `generateCORSConfig`), or hardcode them in the returned config. Don't widen to `*` with credentials — keep it to specific origins. The cached config initializes lazily on the first request, so changes take effect on the next deploy.

`wrangler.toml` itself is generated at deploy time and your edits to it will not persist — always go through `cors-helpers.ts` for code-side changes.

### Database (@pooflabs/server)

```typescript
import { get, set, createWalletClient } from '@pooflabs/server';

const user = await get('users/abc123');
await set('users/abc123', { name: 'Alice', score: 100 });
```

For multi-wallet operations: `const vault = await createWalletClient({ keypair: process.env.VAULT_KEY! });` — see backend-sdk.md reference.

Tarobase is initialized per-request in index.ts middleware.

### AI (`aiRun`)

Use `aiRun` from `./lib/poof-ai.js` for every chat completion call — do NOT bind `AI` directly in wrangler.toml, call raw provider URLs, import `openai`/`@anthropic-ai/sdk`/etc., or import `@cloudflare/voice`. `aiRun` routes through Poof's proxy → Cloudflare AI Gateway's unified `/compat/chat/completions` endpoint so usage is attributed to this project, charged at exact Cloudflare cost × 1.05, converted at `$15 = 50 credits`, and blocked by DENY_KV if the project is over its limit.

Multi-provider via the model name — same helper, same return shape, no provider keys needed (Cloudflare bills the platform via Unified Billing). **Default to `anthropic/claude-sonnet-4-6` when the user hasn't named a model** — it's the best general-purpose pick. Don't reach for Workers AI Llama unless the user explicitly asks for "cheap" or "Cloudflare-hosted".

```typescript
import { aiRun, AiBlockedError } from '../lib/poof-ai.js';

// Default — Anthropic Sonnet (powerful, reliable, well-supported)
const result = await aiRun(c.env, 'anthropic/claude-sonnet-4-6', {
  messages: [{ role: 'user', content: userInput }],
});
const text = result.choices[0].message.content;

// Other providers — same shape, just swap the model string:
//   anthropic/claude-haiku-4-5         (cheaper / faster Anthropic)
//   anthropic/claude-opus-4-7          (hardest reasoning)
//   openai/gpt-5.2                     (OpenAI flagship)
//   google-ai-studio/gemini-2.5-flash  (very cheap Google)
//   @cf/meta/llama-3.3-70b-instruct-fp8-fast  (Cloudflare-hosted Llama)
```

All return the same OpenAI Chat Completions shape: `result.choices[0].message.content` for the text, `result.choices[0].message.tool_calls` for tool calls.

If the user names a specific model you don't recognize, **trust them and use it as-is**. The gateway routes by `provider/` prefix and returns a helpful 404 if the model doesn't exist — surface that back to the user rather than refusing upfront. Your training cutoff is older than the model catalogue.

Cost / streaming / blocked handling:

```typescript
// Non-streaming call with exact cost returned to your app
const { result, usage } = await aiRun(
  c.env, 'openai/gpt-4o-mini', { messages },
  { includeUsage: true },
);
console.log(result.choices[0].message.content, usage.costCredits);

// Streaming. With includeUsage, the stream ends with:
// event: poof-ai-usage
// data: {"billableUsd":0.0012,"costCredits":0.004,...}
const stream = await aiRun(c.env, 'openai/gpt-4o-mini', { messages }, {
  stream: true, includeUsage: true,
});
return new Response(stream as ReadableStream, { headers: { 'content-type': 'text/event-stream' } });

// Blocked-project handling
try {
  await aiRun(c.env, model, { messages });
} catch (e) {
  if (e instanceof AiBlockedError) return ApiErrors.badRequest(c, 'AI usage limit reached');
  throw e;
}
```

Attribution is handled by the platform's dispatch outbound worker — the script identity is sealed by Cloudflare at dispatch time, not derived from anything in this worker's code or headers. Do NOT try to shortcut the helper by fetching `poof-ai.internal` directly with custom headers; the proxy ignores caller-supplied identity.

Cloudflare Workers AI non-chat models (embeddings `@cf/baai/...`, image `@cf/black-forest-labs/...`, STT `@cf/openai/whisper-*`, TTS `@cf/deepgram/...` / `@cf/myshell-ai/...`, etc.) work through `aiRun` too — type the generic to match the model's native shape (`{data, shape}` for embeddings, `ArrayBuffer` for image/audio). Third-party embeddings / image / audio (OpenAI text-embedding, DALL-E, Anthropic vision, etc.) are NOT wired yet — for those, use Cloudflare-hosted equivalents.

Realtime voice and stateful provider APIs (Assistants, Files, etc.) are NOT supported — tell the user rather than reaching for `env.AI` or third-party SDKs.

See `.claude/skills/workers-ai/SKILL.md` for full provider list, model picking guidance, tool calling, and option allowlist.

### AI Agents — sessions, tool loops, structured outputs, default web+browser tools

If the user asks for an "agent" — or any agent-shaped workflow (multi-turn sessions, tool loops, structured outputs, web research, scraping, form filling, browser automation, webhook-triggered async LLM work) — read `.claude/skills/building-agents/SKILL.md`. The skill's first section is a decision tree for AI agent vs. plain `aiRun`; use it instead of guessing.

Every agent gets a built-in tool surface for free: `web_search` (Tavily-backed), `web_fetch` / `web_extract` / `web_screenshot` (Cloudflare Browser Run), and a stateful `browse_*` family (Stagehand) for filling forms, clicking through multi-page flows, working behind login. The agent file doesn't import or wire them — the platform auto-connects every agent to `https://poof-mcp.internal/mcp` at `init()`. Costs are flat per-call ($0.003–$0.05) and bill via the same UsageCounter as AI credits.

AI agents and `aiRun` coexist in the same app and bill through the same proxy. Don't run `bunx flue build` — the template uses the framework's library API via `src/lib/poof-flue-runtime.ts`. There's no agent-owned filesystem; use Tarobase via tools when the agent needs memory across sessions (or the built-in `browse_*` session state when the state is "a browser tab").

### OKX onchainos agentic wallet (opt-in, narrow trigger)

**ONLY when the user explicitly names the OKX product surface** — exact terms "OKX", "onchainos", "onchain os", "OKX agentic wallet", "OKX wallet skill" — read and follow `.claude/skills/okx-agentic-wallet/SKILL.md`. It gives a Flue agent a sandboxed `onchainos` CLI for login / balance / send / sign / swap / Gas Station / x402 micropayments and is wired in by adding `"wallet": true` to the agent's entry in `partyserver/poof-agents.json`.

**Do NOT trigger this on generic terms like "wallet", "wallet auth", "wallet connect", "Solana wallet", "send tokens", "swap", "balance", "crypto", or "DeFi"** — those refer to Poof's built-in Solana wallet auth (`useAuth()` / `validatePoofAuth()`) or normal on-chain ops, and are covered by the `authenticating` / `solana-development` / `using-poof-cloud` skills. The OKX agentic wallet is a separate, agent-only custody model — never reach for it unless the user actually said "OKX" or "onchainos".

### x402 Payments

To require payment for a route, add to the `paidRoutes` object in `partyserver/src/lib/x402-middleware.ts`:

```typescript
'POST /api/create': {
  accepts: {
    scheme: 'exact',
    network,
    payTo: PROJECT_VAULT_ADDRESS,
    price: { asset: 'USDC', amount: '150000' }, // $0.15
  },
},
```

### OAuth (Social Login)

**IMPORTANT: When a user asks for OAuth, social login, or connecting social accounts (Twitter, Google, Discord, GitHub), you MUST read and follow `.claude/skills/oauth/SKILL.md` before making any changes.** The template includes a complete pre-built OAuth implementation that just needs to be enabled — do NOT build OAuth from scratch.

---

### Calling Backend from Frontend

```typescript
// Public requests
import { api } from '@/lib/api-client';
const items = await api.get('/api/items');

// Authenticated requests
import { createAuthenticatedApiClient } from '@/lib/api-client';
const authApi = createAuthenticatedApiClient(token, walletAddress);
await authApi.post('/api/items', { name: 'New item' });
```

Available routes are listed in `partyserver/src/routes/index.ts` in the `routeSpec[]` array.

---

## Perpetual Futures (Phoenix)

When users ask about **perps, leveraged trading, long/short positions, or Phoenix Exchange**: use `@PhoenixPerpsPlugin`. See `.claude/skills/generating-policies/reference/plugins/PhoenixPerpsPlugin.md` and the example at `.claude/skills/generating-policies/reference/examples/phoenix-perps-trading.md`.

**US-jurisdiction gating — the default is frontend-only. Do NOT spin up a partyserver backend just to host a geo gate.**

**Frontend (the default path for most Phoenix apps).** Wire `useGeoBlocked('phoenix')` from `@/hooks/use-geo-blocked` on any page that triggers a Phoenix action — show a banner and disable the trade button when `blocked === true`. Read-only queries (positions, PnL, dashboards) stay rendered. The hook hits Tarobase's centralized `/geo` (no partyserver route needed). Poof Cloud also auto-rejects Phoenix txs from restricted IPs at the cloud layer for any frontend-signed tx — that's the safety net behind the UI gate. Together these two are sufficient for a normal frontend-signed Phoenix app; **no backend wiring is required**.

```tsx
const { blocked, loading } = useGeoBlocked('phoenix');
if (blocked) return <Banner variant="warning">Phoenix Perps trading is not available in your jurisdiction (US).</Banner>;
```

**Backend gate — ONLY when the app actually adds a partyserver route that signs a Phoenix tx on the user's behalf** (server vault, relay, queued job triggered by the route, strategy bot, admin-mediated Phoenix action). The cloud-layer auto-reject only sees the *original* request's IP; once your route is the one signing/relaying/queueing, the user's `cf-ipcountry` is gone and nothing catches them. In that specific case — and only in that case — make `assertProgramAllowed(c, 'phoenix')` from `partyserver/src/lib/geo-gate.js` the **first line** of each such route. Apply it only to routes that mutate Phoenix state on the user's behalf; read-only routes (positions, PnL) are exempt. Throws `HTTPException(451)` with `error_code: 'GEO_RESTRICTED_PHOENIX'`. Default restricted set `['US']`, override via `GEO_RESTRICTED_PHOENIX_COUNTRIES` env var (e.g. `"US,UK,CN"`). Non-browser callers (heartbeats, queues, webhooks, server-to-server) and Poofnet / local dev carry no `cf-ipcountry` and bypass the gate by design.

```ts
import { assertProgramAllowed } from '../lib/geo-gate.js';

// Only because *this* route signs the Phoenix tx for the user.
// A frontend-signed Phoenix app would not have this route at all.
app.post('/api/phoenix/place-long', async (c) => {
  assertProgramAllowed(c, 'phoenix');
  // ...sign + send the Phoenix tx
});
```

Don't add `@user.country` policy rules; geo posture lives entirely in `useGeoBlocked` on the frontend and `geo-gate.ts` on the backend (if and only if there's a Phoenix-signing route). 451 is the one and only exception to the "5 status codes only" rule.

---

## Prediction Markets (Kalshi / DFlow)

When users ask about **Kalshi, tokenized prediction markets, or prediction market trading**: use **DFlow** (`@DflowPlugin`). DFlow provides tokenized Kalshi market trading — market creation, liquidity, and settlement are external. To fetch markets, use the pre-built hooks `useDflowMarkets()` / `useDflowMarket(mint)` from `src/hooks/use-dflow-markets.tsx` — do NOT create custom API routes or backend endpoints for fetching DFlow markets.

**CRITICAL: DFlow orders require KYC verification via dFlow Proof. Always implement the full KYC flow (check status, sign message, redirect, handle return). See `DflowPlugin.md` KYC section.** Filter markets by `status`: use `'active'` for trading pages, `'finalized'` for settlement/redemption.

For **custom/self-hosted prediction markets** (your own questions, AMM/LMSR pricing): use `@PredictionMarketPlugin`. See `.claude/skills/generating-policies/reference/examples/prediction-market.md`.

---

### Scheduled Tasks (Cron Jobs / Heartbeat)

**IMPORTANT: When a user asks for cron jobs, scheduled tasks, recurring tasks, background jobs, queues, or automations — STOP. Do NOT write any code yet. You MUST present the relevant options and ask the user to choose before proceeding:**

> "For scheduled/background work, you have three options:
>
> 1. **Poof Heartbeat (recommended)** — Built into the platform. Tasks run directly in your worker with full database access. No external services or API keys needed. Managed from the Heartbeat tab in Cloud settings.
>
> 2. **Poof Queues** — Built into the platform for asynchronous consumers, retries, delayed messages, and dead letter queues. Managed from the Queues tab in Cloud settings.
>
> 3. **Third-party cron service** — An external service calls your API endpoint on a schedule. Options include cron-job.org (free), cronhooks.io, or FastCron. You'd create a backend endpoint and store the service's API key in your secrets.
>
> Which would you prefer?"

After the user chooses:
- **Heartbeat** → Read and follow `.claude/skills/scheduled-tasks/SKILL.md`. Do NOT create test/trigger API routes — the Heartbeat UI has a built-in Run button.
- **Async Queues** → Read and follow `.claude/skills/async-queues/SKILL.md`. Use `enqueueQueue()` to send jobs; it returns a job id/status that callers can ignore or expose for status tracking. Register consumers in `src/queues/index.ts`. Protect any public job status routes with app auth/ownership checks.
- **Third-party** → Create a backend API endpoint with API key auth, guide the user to set up the external service pointing at their endpoint

---

## Rules

- **CRITICAL: `useAuth()` returns EXACTLY `{ login, logout, user, loading }` — nothing else.** No `isLoggedIn`, `token`, `walletAddress`, `getIdToken`, or any other property. Check `user` for login state (`if (user)`), use `user.address` for wallet address. `getIdToken()` is a separate standalone import: `import { getIdToken } from '@pooflabs/web'`.
- Only 5 HTTP status codes: 200, 400, 401, 404, 500
- Register all routes in `partyserver/src/routes/index.ts`
- Always add entries to `routeSpec[]` when adding routes (needed for API spec display)
- `partyserver/src/lib/` files are template infrastructure — do not edit, except `x402-middleware.ts` (edit the `paidRoutes` object to add paid routes) and `cors-helpers.ts` (edit `initializeCORS()` to add CORS origins the platform won't auto-generate)
- Don't remove the Tarobase initialization middleware in index.ts
- Use `constants.ts` for app-level constants (e.g. `PROJECT_VAULT_ADDRESS`)
- **When reading from 2+ collections in one endpoint, ALWAYS use `getMany()` from db-client — never `Promise.all` with individual get functions**
