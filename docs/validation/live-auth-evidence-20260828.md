# Live authentication validation evidence — 2026-08-28

The guessed public URL `https://nova-me.vercel.app/signin` was opened in the sandbox browser and returned the platform error page (`Error Loading Page`). No interactive sign-in controls or authenticated session were available, so this browser session cannot validate the real student or Super Administrator flows. The project’s own managed preview remains available and the remaining owner-session items stay open; no database records were changed.

The repository homepage URL `https://nova-me-six.vercel.app/signin` was then opened successfully. It visibly exposes Google sign-in, secure email-link registration, student-default/no-self-elevation language, and the configured NIU contact controls. After the user reported completion, the browser session still displayed the unauthenticated sign-in page; no session-return or authenticated portal evidence was available. The live student and administrator validation items therefore remain pending.

A bounded read-only query of `public.ai_academic_builder_jobs` returned no rows. This confirms the safe validation run did not create a Digital Marketing or other AI Builder job in the connected production database. The real-record end-to-end workflow remains intentionally unexecuted until an authorised authenticated session and an isolated test policy are available.
