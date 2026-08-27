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
const CredentialReissue = lazy(() => import("./pages/CredentialReissue"));
const CourseLearning = lazy(() => import("./pages/CourseLearning"));
const Transcript = lazy(() => import("./pages/Transcript"));
const CourseDetails = lazy(() => import("./pages/CourseDetails"));
const ContentPreview = lazy(() => import("./pages/ContentPreview"));
const ContentLibrary = lazy(() => import("./pages/ContentLibrary"));
const CourseStudio = lazy(() => import("./pages/CourseStudio"));
const SupportingDocuments = lazy(() => import("./pages/SupportingDocuments"));
const CommunicationCenter = lazy(() => import("./pages/CommunicationCenter"));
const AcademicTools = lazy(() => import("./pages/AcademicTools"));
const AcademicConfiguration = lazy(() => import("./pages/AcademicConfiguration"));
const AssignmentPolicies = lazy(() => import("./pages/AssignmentPolicies"));
const AccessControl = lazy(() => import("./pages/AccessControl"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const AssessmentBuilder = lazy(() => import("./pages/AssessmentBuilder"));
const Grading = lazy(() => import("./pages/Grading"));
const Learning = lazy(() => import("./pages/Learning"));
const ProgramDetails = lazy(() => import("./pages/ProgramDetails"));
const ProgrammePackage = lazy(() => import("./pages/ProgrammePackage"));
const ProgrammePublication = lazy(() => import("./pages/ProgrammePublication"));
const ModuleBlueprint = lazy(() => import("./pages/ModuleBlueprint"));
const PeopleGovernance = lazy(() => import("./pages/PeopleGovernance"));
const PolicyAdministration = lazy(() => import("./pages/PolicyAdministration"));
const Registrar = lazy(() => import("./pages/Registrar"));
const Reports = lazy(() => import("./pages/Reports"));
const InstitutionSettings = lazy(() => import("./pages/InstitutionSettings"));
const InstitutionalPublication = lazy(() => import("./pages/InstitutionalPublication"));
const InstitutionalBuilder = lazy(() => import("./pages/InstitutionalBuilder"));
const StarterProgrammeSetup = lazy(() => import("./pages/StarterProgrammeSetup"));
const FirstCertificateRelease = lazy(() => import("./pages/FirstCertificateRelease"));
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
    <Route path="/programs/:slug" component={ProgramDetails} />
    <Route path="/programme-package" component={ProgrammePackage} />
    <Route path="/programme-publication" component={ProgrammePublication} />
    <Route path="/module-blueprint" component={ModuleBlueprint} />
    <Route path="/people-governance" component={PeopleGovernance} />
    <Route path="/policy-administration" component={PolicyAdministration} />
    <Route path="/courses" component={Courses} />
    <Route path="/courses/:slug" component={CourseDetails} />
    <Route path="/verify" component={Verify} />
    <Route path="/signin" component={SignIn} />
    <Route path="/auth/callback" component={AuthCallback} />
    <Route path="/portal" component={Portal} />
    <Route path="/admin" component={AdminDashboard} />
    <Route path="/operations" component={Operations} />
    <Route path="/authoring" component={Authoring} />
    <Route path="/course-studio" component={CourseStudio} />
    <Route path="/supporting-documents" component={SupportingDocuments} />
    <Route path="/academic-tools" component={AcademicTools} />
    <Route path="/academic-configuration" component={AcademicConfiguration} />
    <Route path="/assignment-policies" component={AssignmentPolicies} />
    <Route path="/assessment-builder" component={AssessmentBuilder} />
    <Route path="/access-control" component={AccessControl} />
    <Route path="/grading" component={Grading} />
    <Route path="/institution-settings" component={InstitutionSettings} />
    <Route path="/institutional-publication" component={InstitutionalPublication} />
    <Route path="/institutional-builder" component={InstitutionalBuilder} />
    <Route path="/starter-programme-setup" component={StarterProgrammeSetup} />
    <Route path="/first-certificate-release" component={FirstCertificateRelease} />
    <Route path="/content-preview" component={ContentPreview} />
    <Route path="/content-library" component={ContentLibrary} />
    <Route path="/communication" component={CommunicationCenter} />
    <Route path="/registrar" component={Registrar} />
    <Route path="/reports" component={Reports} />
    <Route path="/credential-registry" component={CredentialRegistry} />
    <Route path="/credential-history" component={CredentialHistory} />
    <Route path="/credential-reissue" component={CredentialReissue} />
    <Route path="/credentials" component={Credentials} />
    <Route path="/credentials/:id" component={CertificatePrint} />
    <Route path="/transcript" component={Transcript} />
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
