import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
const Authoring = lazy(() => import("./pages/Authoring"));
const CertificatePrint = lazy(() => import("./pages/CertificatePrint"));
const Credentials = lazy(() => import("./pages/Credentials"));
const CredentialRegistry = lazy(() => import("./pages/CredentialRegistry"));
const CredentialHistory = lazy(() => import("./pages/CredentialHistory"));
const CourseLearning = lazy(() => import("./pages/CourseLearning"));
const CourseDetails = lazy(() => import("./pages/CourseDetails"));
const ContentPreview = lazy(() => import("./pages/ContentPreview"));
const AcademicTools = lazy(() => import("./pages/AcademicTools"));
const AcademicConfiguration = lazy(() => import("./pages/AcademicConfiguration"));
const AccessControl = lazy(() => import("./pages/AccessControl"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const AssessmentBuilder = lazy(() => import("./pages/AssessmentBuilder"));
const Grading = lazy(() => import("./pages/Grading"));
const Learning = lazy(() => import("./pages/Learning"));
const ProgramDetails = lazy(() => import("./pages/ProgramDetails"));
const Registrar = lazy(() => import("./pages/Registrar"));
const InstitutionSettings = lazy(() => import("./pages/InstitutionSettings"));
const InstitutionalBuilder = lazy(() => import("./pages/InstitutionalBuilder"));
const RoleDashboard = lazy(() => import("./pages/RoleDashboard"));

const Home = lazy(() => import("./pages/Home"));
const Courses = lazy(() => import("./pages/Courses"));
const InfoPage = lazy(() => import("./pages/InfoPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Operations = lazy(() => import("./pages/Operations"));
const Portal = lazy(() => import("./pages/Portal"));
const Programs = lazy(() => import("./pages/Programs"));
const SignIn = lazy(() => import("./pages/SignIn"));
const Verify = lazy(() => import("./pages/Verify"));

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/programs" component={Programs} />
    <Route path="/programs/:id" component={ProgramDetails} />
    <Route path="/courses" component={Courses} />
    <Route path="/courses/:slug" component={CourseDetails} />
    <Route path="/verify" component={Verify} />
    <Route path="/signin" component={SignIn} />
    <Route path="/auth/callback" component={AuthCallback} />
    <Route path="/portal" component={Portal} />
    <Route path="/operations" component={Operations} />
    <Route path="/authoring" component={Authoring} />
    <Route path="/academic-tools" component={AcademicTools} />
    <Route path="/academic-configuration" component={AcademicConfiguration} />
    <Route path="/assessment-builder" component={AssessmentBuilder} />
    <Route path="/access-control" component={AccessControl} />
    <Route path="/grading" component={Grading} />
    <Route path="/institution-settings" component={InstitutionSettings} />
    <Route path="/institutional-builder" component={InstitutionalBuilder} />
    <Route path="/content-preview" component={ContentPreview} />
    <Route path="/registrar" component={Registrar} />
    <Route path="/credential-registry" component={CredentialRegistry} />
    <Route path="/credential-history" component={CredentialHistory} />
    <Route path="/credentials" component={Credentials} />
    <Route path="/credentials/:id" component={CertificatePrint} />
    <Route path="/learning" component={Learning} />
    <Route path="/learn/:courseId" component={CourseLearning} />
    <Route path="/dashboard/:dashboard" component={RoleDashboard} />
    {["/about", "/founder", "/mission", "/values", "/schools", "/admissions", "/resources", "/calendar", "/help", "/faqs", "/policies", "/contact"].map((path) => <Route key={path} path={path} component={InfoPage} />)}
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Suspense fallback={<div className="grid min-h-screen place-items-center bg-paper text-sm text-ink/60">Loading NIU…</div>}><Router /></Suspense></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
