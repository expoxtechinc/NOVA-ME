# Vercel Deployment Guide

## Source repository

The NIU application is prepared for the public GitHub repository `expoxtechinc/NOVA-ME`. The repository was verified empty before the initial release push, so its default branch will become the deployment source after the first commit.

## Browser and search branding

NIU uses a burgundy, gold, paper, and ink palette with a circular NIU seal. The production browser icon and discovery metadata are aligned to that established public identity. Public discovery copy remains limited to structured certificate learning, measurable progress, and privacy-preserving credential verification; it makes no unsupported degree, accreditation, recognition, partnership, or faculty claims.

## Vercel environment configuration

The Git-connected Vercel project must define its existing runtime settings in Vercel rather than committing secrets. NIU now includes a fixed fallback for its Supabase project URL and **publishable** browser key, so the deployed Google sign-in entry can initialize even before Vercel variables are added. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel as the preferred override for future key rotation. Set the existing server-side OAuth, cookie, data, and storage variables only from their current secure sources: `VITE_APP_ID`, `JWT_SECRET`, `DATABASE_URL`, `OAUTH_SERVER_URL`, `OWNER_OPEN_ID`, `BUILT_IN_FORGE_API_URL`, and `BUILT_IN_FORGE_API_KEY`.

> Do not copy secrets into the repository. Environment variables must be configured in the Vercel project settings for both Preview and Production as appropriate.

## Manual deployment procedure

1. Sign in to [Vercel](https://vercel.com), select the **expoxtechinc's projects** team, then choose **Add New → Project**.
2. Select **Import Git Repository**, locate `expoxtechinc/NOVA-ME`, and grant the Vercel GitHub integration access to that repository if Vercel asks for permission.
3. Keep the repository root as `./`. The committed `vercel.json` supplies the install command, build command, serverless function entry, and application rewrite, so no manual framework override is required.
4. In **Environment Variables**, add the existing values from their secure source. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for both Preview and Production. Add the existing server/OAuth/storage variables used by NIU—`VITE_APP_ID`, `JWT_SECRET`, `DATABASE_URL`, `OAUTH_SERVER_URL`, `OWNER_OPEN_ID`, `BUILT_IN_FORGE_API_URL`, and `BUILT_IN_FORGE_API_KEY`—to the environments where their related NIU features are required. If analytics is retained, also add `VITE_ANALYTICS_ENDPOINT` and `VITE_ANALYTICS_WEBSITE_ID`.
5. Select **Deploy**. Vercel will run `pnpm install --frozen-lockfile` followed by `pnpm build`, serve the Vite build from `dist/public`, and route only API, OAuth, and managed-storage requests through the generated bundled `api/index.js` function; its readable source is `api/index.source.ts`.
6. Open the resulting deployment URL and check the homepage, `/programs`, `/courses`, `/verify`, and `/portal`. Confirm that the NIU seal appears in the browser tab and that the public site is shown without draft academic records.
7. In Supabase, open **Authentication → URL Configuration**. Set the Site URL to the final Vercel or custom-domain URL and add that URL, with `/**`, to Redirect URLs. Repeat this change whenever the production domain changes. Then test Google sign-in with an allowlisted NIU account.
8. If you add a custom domain in Vercel, make it the production domain first, then update the matching Supabase Site URL and Redirect URL, and redeploy once. Search engines use the committed title, description, icon, and social-preview metadata after they recrawl the deployed domain; indexing timing is controlled by the search engine.

## Deployment verification

| Check | Expected result |
|---|---|
| Build | The Vercel build completes using the committed `vercel.json`. |
| Browser branding | The tab displays the NIU favicon and the page title is “Nova International University \| Certificate Learning”. |
| Public discovery | `/programs`, `/courses`, and `/verify` load without exposing draft or staff-only records. |
| Authentication | An allowlisted Google account reaches its assigned NIU dashboard role after Supabase URL settings are updated. |

## Latest external verification

After the Vercel static-output repair, the public deployment at `https://novainternationaluniversity.vercel.app` was checked directly. The homepage rendered the NIU application rather than bundled server source, including the browser seal and external campus image. The `/verify` credential-verification route also rendered its public form correctly. Authentication requires the Vercel and Supabase environment variables and redirect configuration described above.

The Google sign-in client fallback was subsequently pushed in commit `36f2839`. If the sign-in page still reports that the authentication connection is unconfigured, Vercel is still serving the preceding deployment; redeploy or wait for the build associated with that commit before rechecking the button.

## Google OAuth provider completion

The deployed Supabase client is now initialized and its Google provider is enabled. A live OAuth check reached Google and identified the final external configuration: the Google OAuth client must authorize this exact callback URL:

`https://oevgnonkqpvfvjsmovpw.supabase.co/auth/v1/callback`

In the Google Cloud Console that owns NIU’s OAuth client, open **APIs & Services → Credentials → OAuth 2.0 Client IDs**, select the client used by the linked Supabase project, add the callback URL above under **Authorized redirect URIs**, and save. This is a Google-account-level operation and cannot be performed through the NIU application, Supabase database tools, or the connected Vercel integration. After saving, retry **Continue with Google** from the NIU sign-in page. Separately, keep `https://novainternationaluniversity.vercel.app/**` in Supabase Authentication Redirect URLs so Supabase can return the completed session to NIU.

The configured connector inventory was reviewed for Google Cloud administration. It contains Google Ads, Calendar, Gemini, Maps, and Workspace integrations, but no Google Cloud OAuth-credentials connector. The connected Supabase tools expose no Google Cloud client registration operation. This confirms that the callback must be approved by an authenticated owner of the existing Google OAuth client; no NIU source-code or database change can authorize it with Google.

NIU also provides a Supabase email-link sign-in path for **existing approved NIU identities**. It never creates a new account from the email-link form. This allows an approved user to receive a one-time secure link without a hard dependency on the Google OAuth callback while the Google Cloud client owner completes the registration. The email link returns to `/portal` through the same Supabase redirect configuration; new identities remain governed by the database allowlist gate.

The email-link flow was dispatched from the production sign-in page to the existing approved Super Administrator identity, `nassboss231@gmail.com`. The page confirmed the one-time link request. Opening the received link in the same browser remains the final user-inbox step for completing the live session-return check.

The primary Google sign-in flow was rechecked after the NIU Google OAuth client was replaced in Supabase. The live NIU page now reaches Google’s account-selection screen with the new client and the registered `https://oevgnonkqpvfvjsmovpw.supabase.co/auth/v1/callback` URI, rather than returning the former `redirect_uri_mismatch` error. The application then uses `/auth/callback` to exchange the returned authorization code before routing an authenticated user to `/portal`. Google account selection and consent remain user-controlled actions.

The GitHub integration currently reports two Vercel projects. Use `https://novainternationaluniversity.vercel.app` as the NIU public deployment. The separately named `nova-me` deployment returned a Vercel page-load error during the audit and is not the NIU public URL; it should not be used for launch, sign-in links, or Supabase redirect configuration.

### Owner walkthrough for the remaining Google setting

1. Open [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials) and sign in with the Google account that owns the NIU OAuth client.
2. At the top of Google Cloud, select the project that contains the OAuth client used for NIU/Supabase Google sign-in. If you are unsure, choose the project where the OAuth client ID begins with `1000311073949-`.
3. In **APIs & Services → Credentials**, click the OAuth client under **OAuth 2.0 Client IDs**.
4. In **Authorized redirect URIs**, click **Add URI** and paste exactly: `https://oevgnonkqpvfvjsmovpw.supabase.co/auth/v1/callback`.
5. Click **Save**. Wait about one minute for Google to apply the change.
6. Open `https://novainternationaluniversity.vercel.app/signin` and click **Continue with Google** again.
7. If Google sign-in completes but NIU does not return to the portal, open Supabase **Authentication → URL Configuration**, set **Site URL** to `https://novainternationaluniversity.vercel.app`, and add `https://novainternationaluniversity.vercel.app/**` under **Redirect URLs**.
