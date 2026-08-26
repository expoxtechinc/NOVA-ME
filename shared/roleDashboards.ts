export type CoreNiuRole = "student" | "instructor" | "administrator" | "super_admin";
export type InstitutionalRole = "registrar" | "academic_director" | "content_manager" | "faculty_manager" | "examiner" | "student_support";
export type DashboardKey = "faculty" | "registrar" | "administrator";

export function canAccessDashboard(coreRole: CoreNiuRole, assignedRoles: InstitutionalRole[], dashboard: DashboardKey): boolean {
  if (dashboard === "faculty") return coreRole === "instructor" || coreRole === "administrator" || coreRole === "super_admin" || assignedRoles.includes("academic_director") || assignedRoles.includes("content_manager") || assignedRoles.includes("faculty_manager");
  if (dashboard === "registrar") return coreRole === "administrator" || coreRole === "super_admin" || assignedRoles.includes("registrar");
  return coreRole === "administrator" || coreRole === "super_admin";
}

export function preferredDashboard(coreRole: CoreNiuRole, assignedRoles: InstitutionalRole[]): DashboardKey | null {
  if (canAccessDashboard(coreRole, assignedRoles, "administrator")) return "administrator";
  if (canAccessDashboard(coreRole, assignedRoles, "registrar")) return "registrar";
  if (canAccessDashboard(coreRole, assignedRoles, "faculty")) return "faculty";
  return null;
}

export function dashboardPathForRole(coreRole: CoreNiuRole, assignedRoles: InstitutionalRole[]): string | null {
  const dashboard = preferredDashboard(coreRole, assignedRoles);
  return dashboard ? `/dashboard/${dashboard}` : null;
}
