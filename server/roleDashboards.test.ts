import { describe, expect, it } from "vitest";
import { canAccessDashboard, dashboardPathForRole, preferredDashboard } from "../shared/roleDashboards";

describe("NIU role dashboard access", () => {
  it("keeps student accounts out of all staff dashboards", () => {
    expect(canAccessDashboard("student", [], "faculty")).toBe(false);
    expect(canAccessDashboard("student", [], "registrar")).toBe(false);
    expect(canAccessDashboard("student", [], "administrator")).toBe(false);
  });

  it("routes instructors and registrars to their appropriate workspaces", () => {
    expect(preferredDashboard("instructor", [])).toBe("faculty");
    expect(preferredDashboard("student", ["registrar"])).toBe("registrar");
  });

  it("gives administrator roles priority access to the administrator dashboard", () => {
    expect(preferredDashboard("administrator", ["registrar"])).toBe("administrator");
    expect(canAccessDashboard("super_admin", [], "administrator")).toBe(true);
  });

  it("provides a concrete dashboard route only for an authorised role", () => {
    expect(dashboardPathForRole("instructor", [])).toBe("/dashboard/faculty");
    expect(dashboardPathForRole("student", ["registrar"])).toBe("/dashboard/registrar");
    expect(dashboardPathForRole("student", [])).toBeNull();
  });
});
