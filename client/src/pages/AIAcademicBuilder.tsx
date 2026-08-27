import { useEffect, useState } from "react";
import { Link } from "wouter";
import SiteShell from "@/components/SiteShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";

type Role = "student" | "instructor" | "administrator" | "super_admin";
type Blueprint = { programme?: { title: string; description: string; difficulty: string; objectives: string[]; learningOutcomes: string[]; entryRequirements: string[]; completionRequirements: string[]; recommendedLearningHours: number }; courses?: Array<{ title: string; description: string; difficulty: string; position: number; objectives: string[]; modules: Array<{ title: string; description: string; difficulty: string; position: number; objectives: string[]; lessons: Array<{ title: string; description: string; position: number; objectives: string[]; activityIdeas: string[]; materialNeeds: string[]; assessmentIdeas: string[] }> }> }>; researchPlan?: Array<{ claimArea: string; sourceTypes: string[]; searchQuestions: string[]; sourceRequiredBeforeWriting: boolean }>; qualityGates?: string[]; missingInformation?: string[] };

const staffRoles: Role[] = ["instructor", "administrator", "super_admin"];

export default function AIAcademicBuilder() {
  const [role, setRole] = useState<Role | null>(null);
  const [topic, setTopic] = useState("");
  const [department, setDepartment] = useState("");
  const [difficulty, setDifficulty] = useState<"introductory" | "intermediate" | "advanced">("intermediate");
  const [hours, setHours] = useState("36");
  const [depth, setDepth] = useState<"foundation" | "applied" | "advanced">("applied");
  const [learner, setLearner] = useState("");
  const [courses, setCourses] = useState("3");
  const [researchDepth, setResearchDepth] = useState<"standard" | "deep">("standard");
  const [visuals, setVisuals] = useState(false);
  const [assessments, setAssessments] = useState(true);
  const [references, setReferences] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceType, setSourceType] = useState("official guidance");
  const [researchNotes, setResearchNotes] = useState("");
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active || !data.session) return;
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.session.user.id).maybeSingle();
      if (active) setRole((profile?.role as Role | undefined) ?? null);
    });
    return () => { active = false; };
  }, []);

  const staff = role !== null && staffRoles.includes(role);
  const jobsQuery = trpc.aiBuilder.listJobs.useQuery(undefined, { enabled: staff });

  const planMutation = trpc.aiBuilder.createPlan.useMutation({
    onSuccess(result) {
      setJobId(result.jobId);
      setBlueprint(result.blueprint as Blueprint);
      setNotice("Planning is complete. Review the blueprint and research requirements before any draft records are generated.");
      setError(null);
    },
    onError(result) {
      setError(result.message);
      setNotice(null);
    },
  });

  const reviewMutation = trpc.aiBuilder.submitResearchReview.useMutation({
    onSuccess() { setNotice("Research review saved. The job is now queued for a separate governed generation review; no academic records were created."); setError(null); jobsQuery.refetch(); },
    onError(result) { setError(result.message); setNotice(null); },
  });

  const submitResearchReview = (event: React.FormEvent) => {
    event.preventDefault();
    if (!jobId) return;
    reviewMutation.mutate({ jobId, researchSources: [{ title: sourceTitle, url: sourceUrl, sourceType }], researchNotes });
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null); setError(null); setBlueprint(null); setJobId(null);
    planMutation.mutate({ topic, settings: { department: department || undefined, difficulty, learningHours: Number(hours), academicDepth: depth, targetLearner: learner || undefined, numberOfCourses: Number(courses), researchDepth, visualGeneration: visuals, assessmentGeneration: assessments, referenceRequirements: references || undefined } });
  };

  if (!staff) return <SiteShell><main className="mx-auto max-w-5xl px-5 py-16"><Card><CardHeader><CardTitle>NIU AI Academic Builder</CardTitle></CardHeader><CardContent><p className="text-sm text-ink/70">Academic staff authorization is required. This workspace never creates content for student accounts.</p><Button asChild className="mt-5"><Link href="/signin">Sign in to NIU</Link></Button></CardContent></Card></main></SiteShell>;

  return <SiteShell><main className="mx-auto max-w-7xl px-5 py-10"><div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-burgundy">Governed academic authoring</p><h1 className="mt-2 font-serif text-4xl text-ink">NIU AI Academic Builder</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-ink/70">Plan a certificate programme with structured AI assistance. The planning stage produces a reviewable blueprint only; it does not approve, publish, or create academic records.</p></div><Button variant="outline" asChild><Link href="/programme-package">Back to guided package</Link></Button></div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]"><Card className="xl:col-span-2"><CardHeader><CardTitle>Saved planning jobs</CardTitle><p className="text-sm text-ink/60">Reopen a private blueprint to continue review. Saved jobs never publish or create academic records by themselves.</p></CardHeader><CardContent>{jobsQuery.isLoading ? <p className="text-sm text-ink/60">Loading saved jobs…</p> : jobsQuery.data?.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{jobsQuery.data.map(job => <button type="button" key={job.id} onClick={() => { setJobId(job.id); setTopic(job.topic); setBlueprint(job.blueprint as Blueprint); setNotice(`Loaded ${job.topic}. Continue governed review before any draft generation.`); setError(null); }} className={`rounded-xl border p-4 text-left transition-colors hover:border-burgundy ${jobId === job.id ? "border-burgundy bg-burgundy/5" : "border-line"}`}><p className="font-medium text-ink">{job.topic}</p><p className="mt-1 text-xs uppercase tracking-wide text-ink/50">{job.status.replaceAll("_", " ")}</p><p className="mt-2 text-xs text-ink/55">Updated {new Date(job.updated_at).toLocaleString()}</p></button>)}</div> : <p className="text-sm text-ink/65">No saved planning jobs yet. Start with an approved programme topic below.</p>}</CardContent></Card><div className="grid gap-6 xl:col-span-2 xl:grid-cols-[minmax(0,420px)_1fr]">
        <Card className="h-fit"><CardHeader><CardTitle>Programme brief</CardTitle><p className="text-sm text-ink/60">The topic is required. Every other setting can be reviewed before planning.</p></CardHeader><CardContent><form onSubmit={submit} className="space-y-5">
          <div><Label htmlFor="topic">Programme topic</Label><Input id="topic" value={topic} onChange={event => setTopic(event.target.value)} placeholder="e.g. Digital Marketing" required minLength={3} className="mt-2" /></div>
          <div><Label htmlFor="department">Department (optional)</Label><Input id="department" value={department} onChange={event => setDepartment(event.target.value)} placeholder="Existing or proposed department" className="mt-2" /></div>
          <div className="grid gap-4 sm:grid-cols-2"><div><Label>Difficulty</Label><Select value={difficulty} onValueChange={value => setDifficulty(value as typeof difficulty)}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="introductory">Introductory</SelectItem><SelectItem value="intermediate">Intermediate</SelectItem><SelectItem value="advanced">Advanced</SelectItem></SelectContent></Select></div><div><Label htmlFor="hours">Learning hours</Label><Input id="hours" type="number" min="1" max="2000" value={hours} onChange={event => setHours(event.target.value)} className="mt-2" /></div></div>
          <div className="grid gap-4 sm:grid-cols-2"><div><Label>Academic depth</Label><Select value={depth} onValueChange={value => setDepth(value as typeof depth)}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="foundation">Foundation</SelectItem><SelectItem value="applied">Applied</SelectItem><SelectItem value="advanced">Advanced</SelectItem></SelectContent></Select></div><div><Label htmlFor="courses">Number of courses</Label><Input id="courses" type="number" min="1" max="24" value={courses} onChange={event => setCourses(event.target.value)} className="mt-2" /></div></div>
          <div><Label htmlFor="learner">Target learner (optional)</Label><Input id="learner" value={learner} onChange={event => setLearner(event.target.value)} placeholder="Who is the programme for?" className="mt-2" /></div>
          <div><Label>Research depth</Label><Select value={researchDepth} onValueChange={value => setResearchDepth(value as typeof researchDepth)}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="standard">Standard source plan</SelectItem><SelectItem value="deep">Deep source plan</SelectItem></SelectContent></Select></div>
          <div><Label htmlFor="references">Reference requirements (optional)</Label><Textarea id="references" value={references} onChange={event => setReferences(event.target.value)} placeholder="Required standards, institutions, or source expectations" className="mt-2 min-h-24" /></div>
          <div className="space-y-3 rounded-xl bg-paper p-4 text-sm"><label className="flex items-center gap-3"><input type="checkbox" checked={visuals} onChange={event => setVisuals(event.target.checked)} /> Plan purposeful educational visuals</label><label className="flex items-center gap-3"><input type="checkbox" checked={assessments} onChange={event => setAssessments(event.target.checked)} /> Plan governed assessments</label></div>
          <Button type="submit" disabled={planMutation.isPending || topic.trim().length < 3} className="w-full">{planMutation.isPending ? "Planning programme…" : "Generate Complete Programme Plan"}</Button>
          <p className="text-xs leading-5 text-ink/55">This action creates a private planning job. No course, lesson, question, assessment, material, or certificate record is generated at this stage.</p>
        </form></CardContent></Card>
        <section className="space-y-6"><Card><CardHeader><CardTitle>Builder progress</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-4">{["Brief", "Plan", "Research review", "Draft generation"].map((item, index) => <div key={item} className={`rounded-lg border p-3 ${index === 0 || (index === 1 && blueprint) || (index === 2 && blueprint) ? "border-burgundy bg-burgundy/5" : "border-line"}`}><p className="text-xs font-semibold uppercase tracking-wide text-ink/55">0{index + 1}</p><p className="mt-1 text-sm font-medium">{item}</p><p className="mt-1 text-xs text-ink/55">{index < 2 && blueprint ? "Complete" : index === 2 && blueprint ? "Ready for review" : index === 3 ? "Manual next step" : "Current"}</p></div>)}</div>{jobId && <p className="mt-4 text-xs text-ink/55">Planning job: {jobId}</p>}{notice && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}</CardContent></Card>
          {blueprint ? <><Card><CardHeader><CardTitle>Programme blueprint</CardTitle></CardHeader><CardContent><h2 className="font-serif text-3xl text-ink">{blueprint.programme?.title}</h2><p className="mt-3 text-sm leading-6 text-ink/70">{blueprint.programme?.description}</p><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-paper p-3"><p className="text-xs uppercase tracking-wide text-ink/50">Difficulty</p><p className="mt-1 font-medium">{blueprint.programme?.difficulty}</p></div><div className="rounded-lg bg-paper p-3"><p className="text-xs uppercase tracking-wide text-ink/50">Learning hours</p><p className="mt-1 font-medium">{blueprint.programme?.recommendedLearningHours}</p></div><div className="rounded-lg bg-paper p-3"><p className="text-xs uppercase tracking-wide text-ink/50">Courses</p><p className="mt-1 font-medium">{blueprint.courses?.length ?? 0}</p></div></div></CardContent></Card>
            <Card><CardHeader><CardTitle>Planned curriculum</CardTitle></CardHeader><CardContent className="space-y-4">{(blueprint.courses ?? []).map(course => <details key={`${course.position}-${course.title}`} className="rounded-xl border border-line p-4"><summary className="cursor-pointer font-medium">Course {course.position}: {course.title}<span className="ml-2 text-xs text-ink/50">{course.modules.length} modules</span></summary><p className="mt-3 text-sm text-ink/70">{course.description}</p><div className="mt-3 space-y-2">{course.modules.map(module => <div key={`${module.position}-${module.title}`} className="rounded-lg bg-paper p-3"><p className="text-sm font-medium">Module {module.position}: {module.title} <span className="text-xs text-ink/50">({module.difficulty})</span></p><p className="mt-1 text-xs text-ink/60">{module.lessons.length} planned lessons · {module.objectives.length} objectives</p></div>)}</div></details>)}</CardContent></Card>
            <Card><CardHeader><CardTitle>Research and quality review</CardTitle><p className="text-sm text-ink/60">Record authoritative source provenance and notes before a future draft-generation stage can proceed.</p></CardHeader><CardContent className="space-y-4">{(blueprint.researchPlan ?? []).map(item => <div key={item.claimArea} className="rounded-lg border border-line p-4"><p className="font-medium">{item.claimArea}</p><p className="mt-1 text-sm text-ink/65">Sources required: {item.sourceTypes.join(", ")}</p><p className="mt-2 text-sm text-ink/65">Questions: {item.searchQuestions.join("; ")}</p></div>)}<form onSubmit={submitResearchReview} className="grid gap-3 rounded-xl border border-line p-4"><p className="text-sm font-medium">Submit research review</p><Input value={sourceTitle} onChange={event => setSourceTitle(event.target.value)} placeholder="Source title" required /><Input type="url" value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder="https://authoritative-source.example" required /><Input value={sourceType} onChange={event => setSourceType(event.target.value)} placeholder="Source type" required /><Textarea value={researchNotes} onChange={event => setResearchNotes(event.target.value)} placeholder="Summarise what the source confirms and what still requires academic review (minimum 20 characters)." minLength={20} className="min-h-28" required /><Button type="submit" disabled={reviewMutation.isPending || !jobId}>{reviewMutation.isPending ? "Saving review…" : "Save research review"}</Button></form><div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900"><p className="font-medium">Before draft generation</p><p className="mt-1">{(blueprint.missingInformation?.length ? blueprint.missingInformation : ["Review the research plan, obtain authoritative sources, and confirm every programme decision before generating academic drafts."]).join(" ")}</p></div><ul className="space-y-2 text-sm text-ink/70">{(blueprint.qualityGates ?? []).map(gate => <li key={gate}>• {gate}</li>)}</ul></CardContent></Card></> : <Card><CardContent className="py-16 text-center"><p className="font-serif text-2xl text-ink">Start with an approved programme topic</p><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-ink/65">The AI Builder will create a reviewable architecture and research plan. It will not invent missing facts, create disconnected records, or publish content.</p></CardContent></Card>}
        </section>
      </div></div>
    </main></SiteShell>;
}
