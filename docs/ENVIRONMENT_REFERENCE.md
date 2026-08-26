# NIU Environment Configuration Reference

This committed reference intentionally contains **variable names and safe example formats only**. Configure values in the managed secret interface; never commit real secrets, database passwords, service-role keys, or OAuth client secrets.

| Variable | Safe example format | Used by |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | Browser and public server client. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` | Browser client constrained by Supabase RLS. |
| `INITIAL_ADMIN_EMAIL` | `administrator@example.edu` | One-time bootstrap allowlist process. |
| `APP_URL` | `https://niu.example.edu` | OAuth redirects and official verification links. |
| `GOOGLE_CLIENT_ID` | Google OAuth client identifier | Supabase Google Auth configuration, not browser code. |
| `GOOGLE_CLIENT_SECRET` | Managed secret value | Supabase Google Auth configuration, never client-visible. |
| `SUPABASE_SERVICE_ROLE_KEY` | Managed server-only secret | Optional server/edge workflows only; never browser-visible. |

> The NIU web app does not require a service-role key for its public catalogue, public verification path, or browser account views. If a future server-side workflow requires one, isolate it from browser code and enforce the same database authorisation rules.
