export type CurriculumDifficulty = "introductory" | "intermediate" | "advanced";

export type ImportedLesson = {
  title: string;
  position: number;
  objectives: string[];
  activities: string[];
  knowledgeChecks: string[];
};

export type ImportedModule = {
  title: string;
  position: number;
  difficulty?: CurriculumDifficulty;
  objectives: string[];
  lessons: ImportedLesson[];
};

export type ImportedCourse = {
  title: string;
  position: number;
  description?: string;
  difficulty?: CurriculumDifficulty;
  objectives: string[];
  modules: ImportedModule[];
  assessments: string[];
  finalExamination?: string;
};

export type CurriculumAnalysis = {
  department?: { name: string; code?: string; description?: string };
  programme?: { name: string; code?: string; description?: string; difficulty?: CurriculumDifficulty; objectives: string[]; completionRules?: string };
  courses: ImportedCourse[];
  certificateSettings?: { templateKey?: string; awardScope?: string };
  explicitMaterials: string[];
  missingInformation: string[];
  validationErrors: string[];
  sourceFormat: "markdown" | "plain_text";
};

const difficultyPattern = /^(introductory|intermediate|advanced)$/i;
const clean = (value: string) => value.replace(/^[-*]\s*/, "").replace(/\s+/g, " ").trim();
const valueAfter = (line: string, label: string) => clean(line.slice(label.length).replace(/^[:\-]\s*/, ""));

export function analyzeCurriculumDocument(source: string, fileName: string): CurriculumAnalysis {
  const lines = source.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const analysis: CurriculumAnalysis = { courses: [], explicitMaterials: [], missingInformation: [], validationErrors: [], sourceFormat: /\.md$/i.test(fileName) ? "markdown" : "plain_text" };
  let currentCourse: ImportedCourse | undefined;
  let currentModule: ImportedModule | undefined;
  let currentLesson: ImportedLesson | undefined;
  let lastSection = "";

  for (const raw of lines) {
    const line = raw.replace(/^#+\s*/, "").trim();
    const lower = line.toLowerCase();
    if (/^(department|school department)\s*:/i.test(line)) { const name = valueAfter(line, line.match(/^[^:]+/)![0]); analysis.department = { name }; lastSection = "department"; continue; }
    if (/^(programme|program|certificate programme|certificate program)\s*:/i.test(line)) { const label = line.match(/^[^:]+/)![0]; analysis.programme = { name: valueAfter(line, label), objectives: [] }; lastSection = "programme"; continue; }
    if (/^(course)\s*:/i.test(line)) { currentCourse = { title: valueAfter(line, "Course"), position: analysis.courses.length, objectives: [], modules: [], assessments: [] }; analysis.courses.push(currentCourse); currentModule = undefined; currentLesson = undefined; lastSection = "course"; continue; }
    if (/^(module|unit)\s*(\d+)?\s*:/i.test(line)) { if (!currentCourse) { analysis.validationErrors.push("A module appears before any course."); continue; } currentModule = { title: valueAfter(line, line.match(/^[^:]+/)![0]), position: currentCourse.modules.length, objectives: [], lessons: [] }; currentCourse.modules.push(currentModule); currentLesson = undefined; lastSection = "module"; continue; }
    if (/^(lesson|topic)\s*([\d.]+)?\s*:/i.test(line)) { if (!currentModule) { analysis.validationErrors.push("A lesson appears before any module."); continue; } currentLesson = { title: valueAfter(line, line.match(/^[^:]+/)![0]), position: currentModule.lessons.length, objectives: [], activities: [], knowledgeChecks: [] }; currentModule.lessons.push(currentLesson); lastSection = "lesson"; continue; }
    if (/^(objective|learning objective|outcome)\s*:/i.test(line)) { const text = valueAfter(line, line.match(/^[^:]+/)![0]); if (currentLesson) currentLesson.objectives.push(text); else if (currentModule) currentModule.objectives.push(text); else if (currentCourse) currentCourse.objectives.push(text); else if (analysis.programme) analysis.programme.objectives.push(text); lastSection = "objective"; continue; }
    if (/^(activity|learning activity)\s*:/i.test(line)) { if (currentLesson) currentLesson.activities.push(valueAfter(line, line.match(/^[^:]+/)![0])); else analysis.missingInformation.push("A learning activity was declared before a lesson."); lastSection = "activity"; continue; }
    if (/^(knowledge check|check|question)\s*:/i.test(line)) { if (currentLesson) currentLesson.knowledgeChecks.push(valueAfter(line, line.match(/^[^:]+/)![0])); else analysis.missingInformation.push("A knowledge check was declared before a lesson."); lastSection = "question"; continue; }
    if (/^(assessment|module assessment)\s*:/i.test(line)) { if (currentCourse) currentCourse.assessments.push(valueAfter(line, line.match(/^[^:]+/)![0])); else analysis.missingInformation.push("An assessment was declared before a course."); lastSection = "assessment"; continue; }
    if (/^(final examination|final exam|examination)\s*:/i.test(line)) { if (currentCourse) currentCourse.finalExamination = valueAfter(line, line.match(/^[^:]+/)![0]); else analysis.missingInformation.push("A final examination was declared before a course."); lastSection = "final"; continue; }
    if (/^(material|learning material|protected material)\s*:/i.test(line)) { analysis.explicitMaterials.push(valueAfter(line, line.match(/^[^:]+/)![0])); lastSection = "material"; continue; }
    if (/^(difficulty|level)\s*:/i.test(line)) { const value = valueAfter(line, line.match(/^[^:]+/)![0]).toLowerCase(); if (!difficultyPattern.test(value)) analysis.validationErrors.push(`Unsupported difficulty \"${value}\". Use introductory, intermediate, or advanced.`); else if (currentModule) currentModule.difficulty = value as CurriculumDifficulty; else if (currentCourse) currentCourse.difficulty = value as CurriculumDifficulty; else if (analysis.programme) analysis.programme.difficulty = value as CurriculumDifficulty; lastSection = "difficulty"; continue; }
    if (/^(certificate|certificate template|template)\s*:/i.test(line)) { const value = valueAfter(line, line.match(/^[^:]+/)![0]); analysis.certificateSettings = { templateKey: value, awardScope: "certificate_only" }; lastSection = "certificate"; continue; }
    if (/^(description|overview)\s*:/i.test(line)) { const value = valueAfter(line, line.match(/^[^:]+/)![0]); if (currentCourse) currentCourse.description = value; else if (analysis.programme) analysis.programme.description = value; lastSection = "description"; continue; }
    if (/^(completion|completion rules|required score)\s*:/i.test(line) && analysis.programme) { analysis.programme.completionRules = valueAfter(line, line.match(/^[^:]+/)![0]); lastSection = "completion"; continue; }
    if (lastSection === "material" && /^(https?:\/\/|[-*])/.test(line)) analysis.explicitMaterials.push(clean(line));
  }

  if (!analysis.department?.name) analysis.missingInformation.push("Department name and school relationship are missing.");
  if (!analysis.programme?.name) analysis.missingInformation.push("Certificate programme name is missing.");
  if (!analysis.programme?.description || analysis.programme.description.length < 30) analysis.missingInformation.push("Certificate programme description of at least 30 characters is missing.");
  if (!analysis.courses.length) analysis.missingInformation.push("At least one course is missing.");
  for (const course of analysis.courses) {
    if (!course.description || course.description.length < 3) analysis.missingInformation.push(`Course \"${course.title}\" needs an explicit description.`);
    if (!course.modules.length) analysis.missingInformation.push(`Course \"${course.title}\" has no modules.`);
    if (!course.assessments.length) analysis.missingInformation.push(`Course \"${course.title}\" has no explicit assessment.`);
    for (const module of course.modules) {
      if (!module.difficulty) analysis.missingInformation.push(`Module \"${module.title}\" needs introductory, intermediate, or advanced difficulty.`);
      if (!module.lessons.length) analysis.missingInformation.push(`Module \"${module.title}\" has no lessons.`);
      for (const lesson of module.lessons) {
        if (!lesson.objectives.length) analysis.missingInformation.push(`Lesson \"${lesson.title}\" has no learning objective.`);
        if (!lesson.activities.length) analysis.missingInformation.push(`Lesson \"${lesson.title}\" has no learning activity.`);
      }
    }
  }
  if (!analysis.certificateSettings) analysis.missingInformation.push("Certificate template/settings are missing.");
  return analysis;
}
