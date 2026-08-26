# Vercel Deployment Guide

## Source repository

The NIU application is prepared for the public GitHub repository `expoxtechinc/NOVA-ME`. The repository was verified empty before the initial release push, so its default branch will become the deployment source after the first commit.

## Browser and search branding

NIU uses a burgundy, gold, paper, and ink palette with a circular NIU seal. The production browser icon and discovery metadata are aligned to that established public identity. Public discovery copy remains limited to structured certificate learning, measurable progress, and privacy-preserving credential verification; it makes no unsupported degree, accreditation, recognition, partnership, or faculty claims.

## Vercel environment configuration

The Git-connected Vercel project must define its existing runtime settings in Vercel rather than committing secrets. At minimum, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for browser Supabase access. Set the existing server-side OAuth, cookie, data, and storage variables only from their current secure sources: `VITE_APP_ID`, `JWT_SECRET`, `DATABASE_URL`, `OAUTH_SERVER_URL`, `OWNER_OPEN_ID`, `BUILT_IN_FORGE_API_URL`, and `BUILT_IN_FORGE_API_KEY`.

> Do not copy secrets into the repository. Environment variables must be configured in the Vercel project settings for both Preview and Production as appropriate.
