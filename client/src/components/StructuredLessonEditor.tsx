import { useEffect, useMemo, useRef, useState } from "react";
import { Bold, CheckSquare, Code2, Heading2, Highlighter, ImagePlus, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, Strikethrough, Table2, Type, Underline, Undo2 } from "lucide-react";

export type LessonSection = {
  id: string;
  title: string;
  kind: "text" | "objectives" | "examples" | "activity" | "self_check" | "glossary";
  html: string;
};

type LessonDocument = { version: 1; sections: LessonSection[] };

export const DEFAULT_LESSON_SECTIONS: LessonSection[] = [
  { id: "introduction", title: "Introduction", kind: "text", html: "" },
  { id: "objectives", title: "Learning Objectives", kind: "objectives", html: "" },
  { id: "prerequisites", title: "Prerequisites", kind: "text", html: "" },
  { id: "main-content", title: "Main Content", kind: "text", html: "" },
  { id: "key-concepts", title: "Key Concepts", kind: "text", html: "" },
  { id: "examples", title: "Examples", kind: "examples", html: "" },
  { id: "practical-application", title: "Practical Application", kind: "activity", html: "" },
  { id: "case-study", title: "Case Study", kind: "examples", html: "" },
  { id: "activity", title: "Activity", kind: "activity", html: "" },
  { id: "self-check", title: "Self-Check", kind: "self_check", html: "" },
  { id: "key-takeaways", title: "Key Takeaways", kind: "text", html: "" },
  { id: "glossary", title: "Glossary", kind: "glossary", html: "" },
  { id: "conclusion", title: "Conclusion", kind: "text", html: "" },
  { id: "further-reading", title: "Further Reading", kind: "text", html: "" },
];

function emptyDocument(): LessonDocument { return { version: 1, sections: DEFAULT_LESSON_SECTIONS }; }

function parseDocument(value: string): LessonDocument {
  try {
    const parsed = JSON.parse(value) as Partial<LessonDocument>;
    if (parsed.version === 1 && Array.isArray(parsed.sections)) {
      const byId = new Map(parsed.sections.map(section => [section.id, section]));
      return { version: 1, sections: DEFAULT_LESSON_SECTIONS.map(section => ({ ...section, ...(byId.get(section.id) ?? {}) })) };
    }
  } catch { /* Existing legacy Markdown is displayed in the main content section below. */ }
  if (value.trim()) return { version: 1, sections: DEFAULT_LESSON_SECTIONS.map((section, index) => index === 3 ? { ...section, html: escapeHtml(value) } : section) };
  return emptyDocument();
}

function escapeHtml(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\n", "<br />"); }
function sanitiseHtml(value: string) {
  const template = document.createElement("template");
  template.innerHTML = value;
  template.content.querySelectorAll("script,style,iframe,object,embed,form,link,meta").forEach(node => node.remove());
  template.content.querySelectorAll("*").forEach(node => {
    Array.from(node.attributes).forEach(attribute => {
      if (attribute.name.toLowerCase().startsWith("on") || attribute.name.toLowerCase() === "style") node.removeAttribute(attribute.name);
      if ((attribute.name === "href" || attribute.name === "src") && !/^(https?:|mailto:|#|data:image\/)/i.test(attribute.value)) node.removeAttribute(attribute.name);
    });
  });
  return template.innerHTML;
}

export function getStructuredText(value: string) {
  const documentValue = parseDocument(value);
  const wrapper = document.createElement("div");
  wrapper.innerHTML = documentValue.sections.map(section => section.html).join(" ");
  return wrapper.textContent ?? "";
}

const commands: Array<{ label: string; command: string; icon: typeof Bold }> = [
  { label: "Bold", command: "bold", icon: Bold }, { label: "Italic", command: "italic", icon: Italic }, { label: "Underline", command: "underline", icon: Underline }, { label: "Strikethrough", command: "strikeThrough", icon: Strikethrough },
  { label: "Heading", command: "formatBlock", icon: Heading2 }, { label: "Bulleted list", command: "insertUnorderedList", icon: List }, { label: "Numbered list", command: "insertOrderedList", icon: ListOrdered }, { label: "Blockquote", command: "formatBlock:blockquote", icon: Quote },
];

export default function StructuredLessonEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [documentValue, setDocumentValue] = useState<LessonDocument>(() => parseDocument(value));
  const [activeSectionId, setActiveSectionId] = useState(DEFAULT_LESSON_SECTIONS[0].id);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [lastEmitted, setLastEmitted] = useState(value);
  const editorRef = useRef<HTMLDivElement>(null);
  const activeSection = documentValue.sections.find(section => section.id === activeSectionId) ?? documentValue.sections[0];
  const plainTextLength = useMemo(() => getStructuredText(JSON.stringify(documentValue)).trim().length, [documentValue]);
  const wordCount = useMemo(() => getStructuredText(JSON.stringify(documentValue)).trim().split(/\s+/).filter(Boolean).length, [documentValue]);
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 200));

  useEffect(() => {
    if (value === lastEmitted) return;
    const next = parseDocument(value);
    setDocumentValue(next);
    setLastEmitted(value);
  }, [value, lastEmitted]);

  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = activeSection?.html ?? "";
  }, [activeSectionId]);

  function emit(next: LessonDocument) {
    const serialised = JSON.stringify(next);
    setDocumentValue(next);
    setLastEmitted(serialised);
    onChange(serialised);
    setSavedAt(new Date());
  }

  function updateActiveSection(html: string) {
    emit({ ...documentValue, sections: documentValue.sections.map(section => section.id === activeSection.id ? { ...section, html: sanitiseHtml(html) } : section) });
  }

  function exec(command: string) {
    editorRef.current?.focus();
    const [name, argument] = command.split(":");
    document.execCommand(name, false, argument ?? undefined);
    updateActiveSection(editorRef.current?.innerHTML ?? "");
  }

  function insertLink() {
    const url = window.prompt("Enter an HTTPS or mailto link");
    if (url && /^(https:\/\/|mailto:)/i.test(url)) { editorRef.current?.focus(); document.execCommand("createLink", false, url); updateActiveSection(editorRef.current?.innerHTML ?? ""); }
  }

  function insertTable() {
    const table = "<table><tbody><tr><th>Key point</th><th>Explanation</th></tr><tr><td></td><td></td></tr></tbody></table>";
    editorRef.current?.focus(); document.execCommand("insertHTML", false, table); updateActiveSection(editorRef.current?.innerHTML ?? "");
  }

  function moveSection(offset: number) {
    const index = documentValue.sections.findIndex(section => section.id === activeSection.id);
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= documentValue.sections.length) return;
    const sections = [...documentValue.sections]; [sections[index], sections[nextIndex]] = [sections[nextIndex], sections[index]]; emit({ ...documentValue, sections });
  }

  return <div className="overflow-hidden border border-wine/15 bg-white" aria-label="Structured academic lesson editor">
    <div className="border-b border-wine/10 bg-canvas p-3">
      <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Lesson note formatting">
        {commands.map(({ label, command, icon: Icon }) => <button key={label} type="button" title={label} aria-label={label} onMouseDown={event => event.preventDefault()} onClick={() => exec(command)} className="grid h-9 w-9 place-items-center border border-wine/15 bg-white text-wine transition hover:bg-wine hover:text-paper"><Icon className="h-4 w-4" /></button>)}
        <span className="mx-1 h-6 w-px bg-wine/15" />
        <button type="button" title="Undo" aria-label="Undo" onClick={() => exec("undo")} className="grid h-9 w-9 place-items-center border border-wine/15 bg-white text-wine hover:bg-wine hover:text-paper"><Undo2 className="h-4 w-4" /></button>
        <button type="button" title="Redo" aria-label="Redo" onClick={() => exec("redo")} className="grid h-9 w-9 place-items-center border border-wine/15 bg-white text-wine hover:bg-wine hover:text-paper"><Redo2 className="h-4 w-4" /></button>
        <button type="button" title="Highlight" aria-label="Highlight" onClick={() => exec("hiliteColor")} className="grid h-9 w-9 place-items-center border border-wine/15 bg-white text-wine hover:bg-wine hover:text-paper"><Highlighter className="h-4 w-4" /></button>
        <button type="button" title="Insert link" aria-label="Insert link" onClick={insertLink} className="grid h-9 w-9 place-items-center border border-wine/15 bg-white text-wine hover:bg-wine hover:text-paper"><Link2 className="h-4 w-4" /></button>
        <button type="button" title="Insert table" aria-label="Insert table" onClick={insertTable} className="grid h-9 w-9 place-items-center border border-wine/15 bg-white text-wine hover:bg-wine hover:text-paper"><Table2 className="h-4 w-4" /></button>
        <button type="button" title="Horizontal rule" aria-label="Horizontal rule" onClick={() => exec("insertHorizontalRule")} className="grid h-9 w-9 place-items-center border border-wine/15 bg-white text-wine hover:bg-wine hover:text-paper"><Minus className="h-4 w-4" /></button>
        <button type="button" title="Inline code" aria-label="Inline code" onClick={() => exec("formatBlock:pre")} className="grid h-9 w-9 place-items-center border border-wine/15 bg-white text-wine hover:bg-wine hover:text-paper"><Code2 className="h-4 w-4" /></button>
        <button type="button" title="Insert image" aria-label="Insert image" onClick={() => window.alert("Add images through the protected learning-content attachment panel; the editor stores only safe image references.")} className="grid h-9 w-9 place-items-center border border-wine/15 bg-white text-wine hover:bg-wine hover:text-paper"><ImagePlus className="h-4 w-4" /></button>
        <button type="button" title="Checklist" aria-label="Checklist" onClick={() => exec("insertUnorderedList")} className="grid h-9 w-9 place-items-center border border-wine/15 bg-white text-wine hover:bg-wine hover:text-paper"><CheckSquare className="h-4 w-4" /></button>
        <button type="button" title="Clear formatting" aria-label="Clear formatting" onClick={() => exec("removeFormat")} className="grid h-9 w-9 place-items-center border border-wine/15 bg-white text-wine hover:bg-wine hover:text-paper"><Type className="h-4 w-4" /></button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink/55"><span>{wordCount} words · {readingMinutes} min reading time · {plainTextLength >= 40 ? "Content ready" : "Add at least 40 meaningful characters"}</span><span>{savedAt ? `Autosaved ${savedAt.toLocaleTimeString()}` : "Autosave on"}</span></div>
    </div>
    <div className="grid min-h-[420px] md:grid-cols-[220px_minmax(0,1fr)]">
      <nav className="max-h-[420px] overflow-y-auto border-b border-wine/10 bg-canvas p-2 md:border-b-0 md:border-r" aria-label="Academic note sections"><p className="px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-wine">Academic structure</p>{documentValue.sections.map((section, index) => <button key={section.id} type="button" onClick={() => setActiveSectionId(section.id)} className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${activeSection.id === section.id ? "bg-wine text-paper" : "text-ink/70 hover:bg-white"}`}><span className="text-xs opacity-60">{index + 1}</span><span className="truncate">{section.title}</span></button>)}</nav>
      <div className="min-w-0 p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Section {documentValue.sections.findIndex(section => section.id === activeSection.id) + 1}</p><h4 className="mt-1 font-serif text-2xl">{activeSection.title}</h4></div><div className="flex gap-2"><button type="button" onClick={() => moveSection(-1)} className="button-secondary px-3 py-2 text-xs">Move up</button><button type="button" onClick={() => moveSection(1)} className="button-secondary px-3 py-2 text-xs">Move down</button></div></div><div ref={editorRef} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={`${activeSection.title} content`} onInput={event => updateActiveSection(event.currentTarget.innerHTML)} onBlur={event => updateActiveSection(event.currentTarget.innerHTML)} className="prose prose-stone mt-5 min-h-[280px] max-w-none border border-wine/15 bg-canvas p-5 outline-none focus:border-wine focus:ring-2 focus:ring-wine/15" data-placeholder={`Write ${activeSection.title.toLowerCase()}…`} />
      </div>
    </div>
  </div>;
}
