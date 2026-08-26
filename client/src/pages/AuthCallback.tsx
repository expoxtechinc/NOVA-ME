import { CircleAlert, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import SiteShell from "@/components/SiteShell";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function completeSignIn() {
      // Supabase can establish an implicit OAuth session before this route renders.
      // Accept that session first; PKCE returns continue through the code exchange below.
      const { data: existingSession } = await supabase.auth.getSession();
      if (existingSession.session) {
        if (active) setLocation("/portal", { replace: true });
        return;
      }

      const code = new URLSearchParams(window.location.search).get("code");
      if (!code) {
        if (active) setError("The NIU sign-in response did not include a valid authorization code.");
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (!active) return;

      if (exchangeError) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setLocation("/portal", { replace: true });
          return;
        }
        setError("NIU could not complete your secure sign-in session. Please try Google sign-in again.");
        return;
      }

      setLocation("/portal", { replace: true });
    }

    void completeSignIn();
    return () => { active = false; };
  }, [setLocation]);

  return <SiteShell><section className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center px-5 py-16 text-center">
    {error ? <>
      <CircleAlert className="h-10 w-10 text-wine" />
      <h1 className="mt-5 font-serif text-4xl tracking-[-0.04em] text-ink">Sign-in needs one more try.</h1>
      <p className="mt-4 leading-7 text-ink/65">{error}</p>
      <Link href="/signin" className="button-primary mt-8">Return to NIU sign in</Link>
    </> : <>
      <LoaderCircle className="h-9 w-9 animate-spin text-wine" />
      <h1 className="mt-5 font-serif text-4xl tracking-[-0.04em] text-ink">Completing secure sign-in…</h1>
      <p className="mt-4 leading-7 text-ink/65">NIU is creating your secure session and opening the portal.</p>
    </>}
  </section></SiteShell>;
}
