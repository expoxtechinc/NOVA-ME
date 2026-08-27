import { BookOpenCheck, Clock3, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import SiteShell from "@/components/SiteShell";
import { supabase, supabaseConfigured } from "@/lib/supabase";

type Course = { id: string; slug: string; title: string; description: string | null; category: string | null; duration_minutes: number | null; level: string | null };

export default function Courses() {
  const [search, setSearch] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabaseConfigured) { if (active) { setError(true); setLoading(false); } return; }
      const { data, error: queryError } = await supabase.from("courses").select("id,slug,title,description,category,duration_minutes,level").eq("status", "published").order("title", { ascending: true }).limit(100);
      if (!active) return;
      setCourses((data ?? []) as Course[]); setError(Boolean(queryError)); setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, []);
  const filteredCourses = useMemo(() => { const query = search.trim().toLocaleLowerCase(); return query ? courses.filter(course => `${course.title} ${course.category ?? ""}`.toLocaleLowerCase().includes(query)) : courses; }, [courses, search]);
  return <SiteShell><section className="border-b border-wine/10 bg-canvas"><div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 lg:px-12 lg:py-20"><p className="eyebrow">Course discovery</p><div className="mt-4 flex flex-col justify-between gap-8 lg:flex-row lg:items-end"><div><h1 className="max-w-3xl font-serif text-5xl leading-none tracking-[-0.04em] text-ink sm:text-6xl">Courses published for certificate learning.</h1><p className="mt-5 max-w-2xl leading-7 text-ink/70">NIU course listings are connected to authorised academic publication records and appear only when they are available to the public.</p></div><div className="flex w-full max-w-md items-center gap-2 border-b-2 border-wine bg-white px-3 py-3 shadow-sm"><Search className="h-5 w-5 text-wine" /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search courses" placeholder="Search by course or category" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/40" /></div></div></div></section><section className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 lg:px-12 lg:py-18">{loading && <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[1,2,3].map((item) => <div key={item} className="h-56 animate-pulse bg-canvas" />)}</div>}{error && <div className="border-l-4 border-wine bg-wine/5 p-6"><h2 className="font-serif text-2xl">Course discovery is temporarily unavailable.</h2><p className="mt-2 text-sm text-ink/70">Please retry shortly.</p></div>}{!loading && !error && filteredCourses.length === 0 && <div className="border border-dashed border-wine/25 bg-canvas p-10 text-center"><BookOpenCheck className="mx-auto h-8 w-8 text-wine" /><h2 className="mt-5 font-serif text-3xl">No public courses yet.</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-ink/65">Courses will appear here only after the associated academic content is reviewed and published by NIU.</p></div>}{!loading && !error && filteredCourses.length > 0 && <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{filteredCourses.map((course) => <article key={course.id} className="flex min-h-64 flex-col border border-wine/10 bg-white p-6 shadow-[0_16px_36px_rgba(29,25,21,0.05)]"><p className="text-xs font-bold uppercase tracking-[0.16em] text-wine">{course.category}</p><Link href={`/courses/${course.slug}`} className="mt-4 font-serif text-3xl leading-tight text-ink hover:text-wine"><h2>{course.title}</h2></Link><p className="mt-4 line-clamp-3 text-sm leading-6 text-ink/65">{course.description}</p><div className="mt-auto flex items-center justify-between border-t border-wine/10 pt-5 text-xs text-ink/60"><span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{course.duration_minutes ?? "—"} minutes</span><span className="capitalize">{course.level ?? ""}</span></div></article>)}</div>}</section></SiteShell>;
}
