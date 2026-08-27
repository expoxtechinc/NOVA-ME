import { Activity, AlertCircle, ArrowRight, BarChart3, BookOpenText, Building2, FileCheck2, GraduationCap, LayoutDashboard, LoaderCircle, ShieldAlert, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import SiteShell from "@/components/SiteShell";
import { supabase, supabaseConfigured } from "@/lib/supabase";

type Role = "student" | "instructor" | "administrator" | "super_admin";
type AuditEvent = { id: number; action: string; subject_type: string; created_at: string };
type Counts = { students: number; activeStudents: number; faculty: number; schools: number; departments: number; programs: number; courses: number; enrollments: number; certificates: number; candidates: number; completedEnrollments: number };

const initialCounts: Counts = { students: 0, activeStudents: 0, faculty: 0, schools: 0, departments: 0, programs: 0, courses: 0, enrollments: 0, certificates: 0, candidates: 0, completedEnrollments: 0 };
const adminDomains = [
  { title: "Institution", links: [["University & settings", "/institution-settings"], ["Schools, departments & programmes", "/institutional-builder"], ["Calendar, policies & announcements", "/academic-tools"]] },
  { title: "Academics", links: [["Courses & authoring", "/authoring"], ["Modules, lessons & learning notes", "/institutional-builder"], ["Content & media library", "/content-library"], ["Question banks & assessments", "/assessment-builder"], ["Assignment late-submission policy", "/assignment-policies"]] },
  { title: "People & records", links: [["Access, roles & permissions", "/access-control"], ["Grades & learning progress", "/grading"], ["Certificate eligibility & registry", "/registrar"], ["Credential correction & reissue", "/credential-reissue"], ["Credential history & verification", "/credential-history"]] },
  { title: "Communication & reporting", links: [["Communication & notices", "/communication"], ["Reports & CSV/PDF exports", "/reports"]] },
  { title: "System & quality", links: [["Institution settings", "/institution-settings"], ["Content review & previews", "/content-preview"], ["Academic configuration", "/academic-configuration"]] },
] as const;

async function exactCount(table: string, filters: (query: any) => any = (query) => query) {
  const result = await filters(supabase.from(table).select("id", { count: "exact", head: true }));
  return result.count ?? 0;
}

export default function AdminDashboard() {
  const [role, setRole] = useState<Role | null>(null);
  const [counts, setCounts] = useState<Counts>(initialCounts);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) { setError("The NIU account connection is not configured."); setLoading(false); return; }
    let active = true;
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { if (active) setLoading(false); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", sessionData.session.user.id).maybeSingle();
      if (!active) return;
      setRole(profile?.role as Role ?? null);
      if (profile?.role !== "administrator" && profile?.role !== "super_admin") { setLoading(false); return; }
      try {
        const [students, activeStudents, faculty, schools, departments, programs, courses, enrollments, certificates, candidates, completedEnrollments, auditResult] = await Promise.all([
          exactCount("profiles", (query) => query.eq("role", "student")),
          exactCount("program_enrollments", (query) => query.eq("status", "active")),
          exactCount("profiles", (query) => query.in("role", ["instructor", "administrator", "super_admin"])),
          exactCount("schools"), exactCount("departments"), exactCount("certificate_programs"), exactCount("courses"), exactCount("program_enrollments"), exactCount("certificates"), exactCount("certificate_candidates"),
          exactCount("program_enrollments", (query) => query.eq("status", "completed")),
          supabase.from("audit_events").select("id, action, subject_type, created_at").order("created_at", { ascending: false }).limit(6),
        ]);
        if (!active) return;
        setCounts({ students, activeStudents, faculty, schools, departments, programs, courses, enrollments, certificates, candidates, completedEnrollments });
        setEvents((auditResult.data ?? []) as AuditEvent[]);
      } catch {
        if (active) setError("NIU could not load all administration metrics. Your protected records remain unchanged; refresh to try again.");
      }
      if (active) setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, []);

  const completionRate = useMemo(() => counts.enrollments ? Math.round((counts.completedEnrollments / counts.enrollments) * 100) : 0, [counts]);
  const alerts = useMemo(() => [
    counts.programs === 0 ? "No certificate programmes have been created yet." : null,
    counts.courses === 0 ? "No course records have been created yet." : null,
    counts.candidates > 0 ? `${counts.candidates} certificate candidate${counts.candidates === 1 ? " is" : "s are"} awaiting an authorised review.` : null,
  ].filter(Boolean) as string[], [counts]);
  const metrics = [
    ["Total students", counts.students, UsersRound], ["Active students", counts.activeStudents, GraduationCap], ["Faculty & administrators", counts.faculty, UsersRound], ["Schools", counts.schools, Building2], ["Departments", counts.departments, Building2], ["Certificate programmes", counts.programs, BookOpenText], ["Courses", counts.courses, BookOpenText], ["Enrolments", counts.enrollments, Activity], ["Certificates issued", counts.certificates, FileCheck2], ["Certificate candidates", counts.candidates, FileCheck2], ["Completion rate", `${completionRate}%`, BarChart3],
  ] as const;

  if (loading) return <SiteShell><div className="mx-auto flex min-h-[55vh] flex-col items-center justify-center"><LoaderCircle className="h-8 w-8 animate-spin text-wine" /><p className="mt-4 text-sm text-ink/60">Loading NIU administration records…</p></div></SiteShell>;
  if (role !== "administrator" && role !== "super_admin") return <SiteShell><section className="mx-auto flex min-h-[55vh] max-w-2xl flex-col items-center justify-center px-5 text-center"><ShieldAlert className="h-10 w-10 text-wine" /><h1 className="mt-5 font-serif text-4xl">Super Administrator authority required.</h1><p className="mt-3 leading-7 text-ink/65">NIU only shows institutional oversight metrics and administration controls to protected administrator roles.</p><Link href={role ? "/portal" : "/signin"} className="button-primary mt-7">{role ? "Return to My NIU" : "Sign in to NIU"}</Link></section></SiteShell>;
  return <SiteShell><section className="border-b border-wine/10 bg-canvas"><div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12"><p className="eyebrow">NIU Admin Dashboard</p><div className="mt-4 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><h1 className="font-serif text-5xl tracking-[-0.04em]">Institutional control center.</h1><p className="mt-3 max-w-3xl leading-7 text-ink/65">Live counts, alerts, governance actions, and secure entry points for NIU’s certificate-learning administration. No demo institutional data is shown.</p></div><Link href="/portal" className="inline-flex items-center gap-2 text-sm font-bold text-wine">My NIU portal <ArrowRight className="h-4 w-4" /></Link></div></div></section><section className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 lg:px-12">{error && <p className="mb-6 flex gap-2 border-l-4 border-wine bg-wine/5 p-4 text-sm text-ink/75"><AlertCircle className="h-5 w-5 shrink-0 text-wine" />{error}</p>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, Icon]) => <article key={label} className="border border-wine/10 bg-white p-5 shadow-[0_12px_28px_rgba(29,25,21,0.04)]"><Icon className="h-5 w-5 text-wine" /><p className="mt-5 text-3xl font-semibold text-ink">{value}</p><p className="mt-1 text-sm text-ink/60">{label}</p></article>)}</div><div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_.85fr]"><section className="border border-wine/10 bg-white p-7"><div className="flex items-center gap-3"><LayoutDashboard className="h-6 w-6 text-wine" /><div><p className="eyebrow">Administration domains</p><h2 className="mt-1 font-serif text-3xl">Governed workspaces</h2></div></div><div className="mt-7 grid gap-5 sm:grid-cols-2">{adminDomains.map((domain) => <div key={domain.title}><h3 className="font-semibold text-ink">{domain.title}</h3><div className="mt-3 grid gap-2">{domain.links.map(([label, href]) => <Link key={label} href={href} className="flex items-center justify-between text-sm text-wine hover:text-ink"><span>{label}</span><ArrowRight className="h-4 w-4" /></Link>)}</div></div>)}</div></section><aside className="grid gap-6"><section className="border border-wine/10 bg-canvas p-6"><p className="eyebrow">System alerts</p><h2 className="mt-2 font-serif text-2xl">Actionable record status</h2><div className="mt-5 grid gap-3">{alerts.length ? alerts.map((alert) => <p key={alert} className="border-l-4 border-gold bg-white p-3 text-sm leading-6 text-ink/75">{alert}</p>) : <p className="text-sm leading-6 text-ink/65">No record-derived operational alerts currently require attention.</p>}</div></section><section className="border border-wine/10 bg-white p-6"><p className="eyebrow">Recent activity</p><h2 className="mt-2 font-serif text-2xl">Audit-linked events</h2><div className="mt-5 grid gap-3">{events.length ? events.map((event) => <div key={event.id} className="border-b border-wine/10 pb-3 last:border-0"><p className="text-sm font-semibold text-ink">{event.action.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-ink/55">{event.subject_type} · {new Date(event.created_at).toLocaleString()}</p></div>) : <p className="text-sm leading-6 text-ink/65">No audit records are available yet.</p>}</div></section></aside></div></section></SiteShell>;
}
