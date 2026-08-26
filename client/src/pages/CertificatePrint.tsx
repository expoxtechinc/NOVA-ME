import { Download, LoaderCircle, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import SiteShell from "@/components/SiteShell";
import { supabase, supabaseConfigured } from "@/lib/supabase";

type Credential = {
  id: string;
  credential_number: string;
  credential_title: string | null;
  issued_at: string | null;
  status: string;
  learning_hours: number | null;
  certificate_programs: { name: string }[] | null;
  profiles: { display_name: string | null; legal_name: string | null }[] | null;
};

export default function CertificatePrint() {
  const [, params] = useRoute("/credentials/:id");
  const credentialId = params?.id;
  const [credential, setCredential] = useState<Credential | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured || !credentialId) { setLoading(false); return; }
    let active = true;
    async function load() {
      const { data } = await supabase
        .from("certificates")
        .select("id, credential_number, credential_title, issued_at, status, learning_hours, certificate_programs(name), profiles(display_name, legal_name)")
        .eq("id", credentialId)
        .maybeSingle();
      if (active) { setCredential(data as Credential | null); setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [credentialId]);

  if (loading) return <SiteShell><div className="mx-auto flex min-h-[55vh] flex-col items-center justify-center"><LoaderCircle className="h-8 w-8 animate-spin text-wine" /><p className="mt-4 text-sm text-ink/60">Loading your official certificate…</p></div></SiteShell>;
  if (!credential) return <SiteShell><section className="mx-auto flex min-h-[55vh] max-w-2xl flex-col items-center justify-center px-5 text-center"><h1 className="font-serif text-4xl">Credential not available.</h1><p className="mt-3 leading-7 text-ink/65">The record may not exist or may not be available to your account.</p><Link href="/credentials" className="button-primary mt-7">Return to my credentials</Link></section></SiteShell>;

  const recipient = credential.profiles?.[0]?.display_name || credential.profiles?.[0]?.legal_name || "NIU learner";
  const program = credential.certificate_programs?.[0]?.name;
  const verificationUrl = `${window.location.origin}/verify?credential=${encodeURIComponent(credential.credential_number)}`;

  return <SiteShell><section className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8 print:px-0 print:py-0"><div className="mb-6 flex flex-wrap justify-between gap-4 print:hidden"><Link href="/credentials" className="button-secondary">Back to credentials</Link><button onClick={() => window.print()} className="button-primary"><Download className="h-4 w-4" />Print or save as PDF</button></div><article className="certificate-print relative overflow-hidden border-[14px] border-wine bg-paper p-8 text-center shadow-[0_20px_55px_rgba(29,25,21,0.12)] sm:p-14"><div className="pointer-events-none absolute inset-4 border border-gold/70" /><div className="relative"><p className="eyebrow">Nova International University</p><h1 className="mt-8 font-serif text-5xl tracking-[-0.04em] sm:text-6xl">Certificate of completion</h1><p className="mx-auto mt-6 max-w-2xl leading-7 text-ink/65">This is to certify that</p><h2 className="mt-4 font-serif text-4xl text-wine sm:text-5xl">{recipient}</h2><p className="mx-auto mt-7 max-w-2xl leading-7 text-ink/65">has completed the requirements for</p><h3 className="mt-3 font-serif text-3xl sm:text-4xl">{credential.credential_title ?? program ?? "NIU certificate"}</h3><div className="mx-auto mt-10 grid max-w-3xl gap-6 border-y border-wine/15 py-6 text-left sm:grid-cols-3"><div><p className="record-label">Credential number</p><p className="record-value font-mono text-sm">{credential.credential_number}</p></div><div><p className="record-label">Issued</p><p className="record-value text-sm">{credential.issued_at ? new Date(credential.issued_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—"}</p></div><div><p className="record-label">Learning hours</p><p className="record-value text-sm">{credential.learning_hours ?? "—"}</p></div></div><div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"><QRCodeSVG value={verificationUrl} size={112} level="M" includeMargin aria-label="QR code linking to official credential verification" /><div className="max-w-sm text-left"><p className="font-serif text-xl">Official verification</p><p className="mt-2 text-xs leading-5 text-ink/60">Scan this QR code or enter the credential number in the NIU verification service. The current credential status is maintained in the official record.</p></div></div><div className="mt-10 flex items-center justify-center gap-2 text-xs text-ink/55"><ShieldCheck className="h-4 w-4 text-wine" />Status at render time: <span className="font-bold capitalize text-wine">{credential.status}</span></div></div></article></section></SiteShell>;
}
