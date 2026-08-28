# AI Builder API connection diagnosis

## Verified request path

The **Generate Complete Programme Plan** action in `client/src/pages/AIAcademicBuilder.tsx` calls the tRPC mutation `trpc.aiBuilder.createPlan.useMutation`. The server registers the procedure in `server/routers/aiBuilder.ts` as `createPlan`, mounted through Express at `/api/trpc` by `server/app.ts` and exposed to Vercel by `api/index.ts`.

## Backend provider path

The `createPlan` procedure inserts a private `ai_academic_builder_jobs` row, then calls `invokeLLM` from `server/_core/llm.ts` with model `gpt-5-mini` and a strict JSON schema. The shared helper does **not** call the user-configured OpenAI or Gemini endpoints. It calls `BUILT_IN_FORGE_API_URL` with `BUILT_IN_FORGE_API_KEY`. Its `assertApiKey` checks that Forge key but reports the misleading text `OPENAI_API_KEY is not configured`. On upstream non-2xx responses it throws a raw `Error` containing `response.text()`. There is no custom tRPC error formatter in `server/_core/trpc.ts`.

The page itself only displays `result.message` from the typed tRPC error. Therefore the browser message `Unexpected token 'A', "A server e"... is not valid JSON` is a transport/client parsing symptom: a production function or proxy returned a plain-text response beginning with `A server e...` where the tRPC client expected JSON. Local unauthenticated probing of `/api/trpc/aiBuilder.createPlan?batch=1` returned a JSON tRPC envelope with HTTP 401, proving the local Express route can emit JSON for this early failure.

## Vercel evidence

The available Vercel account exposes one hobby team, `expoxtechinc's projects`, with linked `ONLINE-UNIVERSITY` projects but no project named `nova-me` or `nova-me-six`. Looking up the slug `nova-me` returned Vercel 404. Fetching `https://nova-me-six.vercel.app/` through the available Vercel URL probe returned `Unable to create shareable URL`, and production runtime logs could not be queried without an accessible project ID. This means the reported production deployment is not currently accessible through the configured Vercel account; the exact production function log cannot be honestly claimed until the correct Vercel project scope is available.

## Repair requirements

The server must normalize provider configuration errors, upstream failures, malformed structured output, and unknown exceptions into safe tRPC errors with clear messages: `AI provider is not configured.`, `AI provider request failed.`, or `AI returned invalid structured data.` No provider secret may be sent to browser code. The transport/client should also tolerate non-JSON bodies and show a safe fallback message instead of surfacing a JSON parse exception.

## Production browser check

On 2026-08-28, the browser successfully loaded `https://nova-me-six.vercel.app/` and `/signin`; the production landing page and NIU sign-in page are reachable. The browser session is not authenticated. The sign-in page offers Google authentication and secure email-link registration, and explicitly states that new accounts begin as students while staff access requires separate NIU approval. No administrator session or production Vercel project logs were available in the current session, so the production Generate Complete Programme Plan action could not yet be submitted without an owner-controlled authentication step.

## Exact provider results and repair verification

The independent Digital Marketing provider smoke test confirmed that the injected `OPENAI_API_KEY` is present but the upstream OpenAI endpoint returns HTTP 429 `insufficient_quota` with the message that no credits remain. The injected `GEMINI_API_KEY` is present; an old hardcoded `gemini-2.5-flash` request returns HTTP 404 because that model is no longer available to new users, while live model discovery selected `gemini-3-flash-preview` and returned valid JSON.

After the repair, the exact Digital Marketing blueprint contract ran through OpenAI first, then the configured Gemini fallback, and returned a real structured result: provider `gemini`, model `gemini-3-flash-preview`, programme title `Intermediate Digital Marketing Certificate`, three courses, two research-plan items, and a missing-information array. No database records were created by this smoke test.

The local Express parser-failure probe now returns HTTP 400 with `Content-Type: application/json` and body `{"success":false,"error":"NIU server request failed."}`. Full build, TypeScript validation, and the AI Builder regression suite pass. Production Vercel browser pages are reachable, but the current browser session is unauthenticated and the configured Vercel connector cannot access the reported deployment project logs.
