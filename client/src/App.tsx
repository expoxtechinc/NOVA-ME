import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
const Authoring = lazy(() => import("./pages/Authoring"));
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
    <Route path="/courses" component={Courses} />
    <Route path="/verify" component={Verify} />
    <Route path="/signin" component={SignIn} />
    <Route path="/portal" component={Portal} />
    <Route path="/operations" component={Operations} />
    <Route path="/authoring" component={Authoring} />
    <Route path="/dashboard/:dashboard" component={RoleDashboard} />
    {["/about", "/founder", "/mission", "/values", "/schools", "/admissions", "/resources", "/calendar", "/help", "/faqs", "/policies", "/contact"].map((path) => <Route key={path} path={path} component={InfoPage} />)}
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Suspense fallback={<div className="grid min-h-screen place-items-center bg-paper text-sm text-ink/60">Loading NIU…</div>}><Router /></Suspense></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
