import {
  AlertCircle,
  ArrowRight,
  Bell,
  BookOpen,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  LoaderCircle,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import type { Session } from "@supabase/supabase-js";
import type { CoreNiuRole, InstitutionalRole } from "@shared/roleDashboards";
import { dashboardPathForRole } from "@shared/roleDashboards";
import SiteShell from "@/components/SiteShell";
import { supabase, supabaseConfigured } from "@/lib/supabase";

type Profile = { display_name: string | null; legal_name: string | null; role: CoreNiuRole };
type WorkspaceCard = { icon: typeof BookOpen; title: string; body: string };

export default function Portal() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assignedRoles, setAssignedRoles] = useState<InstitutionalRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) { setMessage("The NIU account connection is not configured."); setLoading(false); return; }
    let mounted = true;
    async function loadWorkspace() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(sessionData.session);
      if (!sessionData.session) { setLoading(false); return; }
      const { data, error } = await supabase.from("profiles").select("display_name, legal_name, role").eq("id", sessionData.session.user.id).maybeSingle();
      if (!mounted) return;
      if (error) setMessage("Your account is authenticated, but the NIU profile record could not be loaded.");
      else if (!data) setMessage("Your account is awaiting institutional profile provisioning. Please contact NIU support.");
      else {
        setProfile(data as Profile);
        const { data: assignments } = await supabase.from("profile_role_assignments").select("institutional_role").eq("profile_id", sessionData.session.user.id);
        if (mounted) setAssignedRoles((assignments ?? []).map((assignment) => assignment.institutional_role as InstitutionalRole));
      }
      if (mounted) setLoading(false);
    }
    loadWorkspace();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  async function signOut() { await supabase.auth.signOut(); setSession(null); setProfile(null); setAssignedRoles([]); }

  if (loading) return <SiteShell><div className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center px-5 text-center"><LoaderCircle className="h-8 w-8 animate-spin text-wine" /><p className="mt-4 text-sm text-ink/60">Loading your secure NIU workspace…</p></div></SiteShell>;
  if (!session) return <SiteShell><section className="mx-auto flex min-h-[55vh] max-w-2xl flex-col items-center justify-center px-5 py-16 text-center"><GraduationCap className="h-10 w-10 text-wine" /><h1 className="mt-5 font-serif text-5xl tracking-[-0.04em]">Your NIU workspace awaits.</h1><p className="mt-4 max-w-lg leading-7 text-ink/65">Sign in with your approved account to access your learning record, role-appropriate workspace, and authorised institutional tools.</p><Link href="/signin" className="button-primary mt-8">Sign in to NIU <ArrowRight className="h-4 w-4" /></Link></section></SiteShell>;
  const role = profile?.role ?? "student";
  const displayName = profile?.display_name || profile?.legal_name || session.user.email || "NIU learner";
  const dashboardPath = dashboardPathForRole(role, assignedRoles);
  const isStaff = dashboardPath !== null;
  const cards: WorkspaceCard[] = isStaff ? [{ icon: LayoutDashboard, title: "Role-specific workspace", body: "Your faculty, registrar, or administrator entry point reflects protected account roles and assignments." }, { icon: UsersRound, title: "Learner records", body: "Access is limited to students and records within your designated responsibilities." }, { icon: ShieldCheck, title: "Review & governance", body: "Content review, approval, and audit-linked actions are available only where permitted." }] : [{ icon: BookOpen, title: "My learning", body: "Your active programs, course progress, and next required activity appear here when you are enrolled." }, { icon: ClipboardCheck, title: "Assessments & grades", body: "Your released assessment outcomes and grade records appear here after authorised publication." }, { icon: FileCheck2, title: "Certificates", body: "Certificate eligibility, approved credentials, and personal retrieval links appear here when issued." }];
  return <SiteShell><section className="border-b border-wine/10 bg-canvas"><div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-5 px-5 py-10 sm:px-8 md:flex-row md:items-end lg:px-12"><div><p className="eyebrow">Secure NIU workspace</p><h1 className="mt-4 font-serif text-4xl tracking-[-0.04em] text-ink">Welcome, {displayName}.</h1><p className="mt-2 text-sm text-ink/65">Current role: <span className="font-bold capitalize text-wine">{role.replace("_", " ")}</span></p></div><div className="flex items-center gap-4"><button onClick={signOut} className="text-sm font-semibold text-wine hover:text-ink">Sign out</button><span className="grid h-10 w-10 place-items-center rounded-full bg-wine font-serif text-lg text-gold" aria-label="NIU user account">{displayName.charAt(0).toUpperCase()}</span></div></div></section><section className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12"><div className="mb-9 flex flex-wrap items-center gap-3 text-sm text-ink/65"><Bell className="h-5 w-5 text-wine" />Notifications, progress, records, and actions appear from your authorised NIU data only.</div>{message && <div className="mb-8 flex gap-3 border-l-4 border-wine bg-wine/5 p-5"><AlertCircle className="h-5 w-5 shrink-0 text-wine" /><div><h2 className="font-semibold">Profile action needed</h2><p className="mt-1 text-sm text-ink/70">{message}</p></div></div>}<div className="grid gap-5 md:grid-cols-3">{cards.map(({ icon: CardIcon, title, body }) => <article key={title} className="min-h-56 border border-wine/10 bg-white p-6 shadow-[0_16px_36px_rgba(29,25,21,0.05)]"><CardIcon className="h-6 w-6 text-wine" /><h2 className="mt-7 font-serif text-2xl">{title}</h2><p className="mt-3 text-sm leading-6 text-ink/65">{body}</p></article>)}</div>{dashboardPath && <div className="mt-8 flex flex-wrap gap-3"><Link href={dashboardPath} className="button-primary">Open role workspace <ArrowRight className="h-4 w-4" /></Link><Link href="/operations" className="button-secondary">Institutional operations</Link></div>}<div className="mt-8 border border-dashed border-wine/25 bg-canvas p-8"><h2 className="font-serif text-3xl">No unauthorised actions are shown here.</h2><p className="mt-3 max-w-3xl leading-7 text-ink/65">This workspace remains intentionally quiet until NIU enrolments, assigned responsibilities, notifications, and records exist for your authenticated account. Student grades, completion, and certificates are never inferred from client-side interaction alone.</p></div></section></SiteShell>;
}
