import { ArrowRight, CircleAlert, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link } from "wouter";
import SiteShell from "@/components/SiteShell";
import { supabase, supabaseConfigured } from "@/lib/supabase";

export default function SignIn() {
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  async function signInWithGoogle() {
    setError(null);
    setEmailSent(false);
    if (!supabaseConfigured) { setError("The NIU authentication connection has not been configured yet."); return; }
    setGoogleLoading(true);
    const { error: signInError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
    if (signInError) { setError(signInError.message); setGoogleLoading(false); }
  }

  async function sendEmailLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setEmailSent(false);
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) { setError("Enter a valid email address to receive a secure NIU sign-in link."); return; }
    setEmailLoading(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { emailRedirectTo: `${window.location.origin}/portal`, shouldCreateUser: false },
    });
    setEmailLoading(false);
    if (otpError) { setError("We could not start a sign-in link for this email. Use an approved NIU address or contact the NIU administrator."); return; }
    setEmailSent(true);
  }

  return <SiteShell><section className="mx-auto grid min-h-[calc(100vh-74px)] max-w-[1440px] items-stretch lg:grid-cols-[.95fr_1.05fr]"><div className="bg-wine px-5 py-14 text-paper sm:px-8 lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-16"><div><p className="eyebrow text-gold">NIU account access</p><h1 className="mt-5 max-w-md font-serif text-5xl leading-none tracking-[-0.04em]">One learning record. Clear permissions.</h1><p className="mt-6 max-w-md leading-7 text-paper/75">Students, faculty, registrar staff, and authorised administrators receive only the access appropriate to their official role.</p></div><div className="mt-14 grid gap-4"><div className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-gold" /><p className="text-sm text-paper/75">Google authentication and secure email links both connect to NIU’s protected identity provider.</p></div><div className="flex gap-3"><LockKeyhole className="h-5 w-5 shrink-0 text-gold" /><p className="text-sm text-paper/75">Only email addresses approved in NIU’s allowlist can create or access an NIU account.</p></div></div></div><div className="flex items-center px-5 py-14 sm:px-8 lg:px-16"><div className="w-full max-w-md"><h2 className="font-serif text-4xl tracking-[-0.03em] text-ink">Sign in to NIU</h2><p className="mt-3 leading-6 text-ink/65">Use your approved NIU-linked Google account or receive a secure sign-in link by email.</p>{error && <div role="alert" className="mt-6 flex gap-3 border-l-4 border-wine bg-wine/5 p-4 text-sm text-ink/75"><CircleAlert className="h-5 w-5 shrink-0 text-wine" />{error}</div>}<button onClick={signInWithGoogle} disabled={googleLoading || emailLoading} className="mt-8 flex w-full items-center justify-center gap-3 border border-wine/25 bg-white px-5 py-4 text-sm font-bold text-ink shadow-sm transition hover:border-wine disabled:cursor-not-allowed disabled:opacity-70"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#4285F4] text-[10px] font-bold text-white">G</span>{googleLoading ? "Redirecting to Google…" : "Continue with Google"}<ArrowRight className="h-4 w-4 text-wine" /></button><div className="my-7 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.14em] text-ink/40"><span className="h-px flex-1 bg-wine/15" />or<span className="h-px flex-1 bg-wine/15" /></div><form onSubmit={sendEmailLink}><label htmlFor="niu-signin-email" className="text-sm font-bold text-ink">Email sign-in link</label><p className="mt-1 text-xs leading-5 text-ink/55">We will send a one-time sign-in link to your approved NIU email inbox.</p><div className="mt-3 flex gap-2"><input id="niu-signin-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="min-w-0 flex-1 border border-wine/25 bg-white px-3 py-3 text-sm text-ink outline-none placeholder:text-ink/35 focus:border-wine focus:ring-2 focus:ring-wine/15" required /><button type="submit" disabled={emailLoading || googleLoading} className="inline-flex shrink-0 items-center gap-2 bg-wine px-4 py-3 text-sm font-bold text-paper transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-70"><Mail className="h-4 w-4" />{emailLoading ? "Sending…" : "Send link"}</button></div></form>{emailSent && <p role="status" className="mt-4 border-l-4 border-gold bg-gold/10 p-3 text-sm leading-6 text-ink">Check <strong>{email.trim()}</strong> for your one-time NIU sign-in link. Open it in this browser to continue to your portal.</p>}<p className="mt-6 text-xs leading-5 text-ink/55">By continuing, you acknowledge that NIU access is subject to applicable institutional policies and account authorization.</p><Link href="/help" className="mt-5 inline-block text-sm font-semibold text-wine hover:text-ink">Need support with account access?</Link></div></div></section></SiteShell>;
}
