import { describe, expect, it } from "vitest";
import {
  assertPermission,
  hasPermission,
  PERMISSIONS,
  type Permission,
  PermissionError,
  ROLES,
} from "@/lib/permissions";

// The full expected matrix, spelled out so any change to lib/permissions.ts
// must consciously be mirrored here (spec §3: three-role model is fixed).
const EXPECTED: Record<Permission, Record<(typeof ROLES)[number], boolean>> = {
  "task.create": { admin: true, member: true, viewer: false },
  "task.edit": { admin: true, member: true, viewer: false },
  "task.move": { admin: true, member: true, viewer: false },
  "task.delete": { admin: true, member: false, viewer: false },
  "task.comment": { admin: true, member: true, viewer: false },
  "board.configure": { admin: true, member: false, viewer: false },
  "objective.manage": { admin: true, member: true, viewer: false },
  "meeting.participate": { admin: true, member: true, viewer: false },
  "meeting.submit": { admin: true, member: true, viewer: false },
  "meeting.readRaw": { admin: true, member: true, viewer: false },
  "meeting.readSummary": { admin: true, member: true, viewer: true },
  "template.edit": { admin: true, member: false, viewer: false },
  "proposal.confirm": { admin: true, member: true, viewer: false },
  "dashboard.view": { admin: true, member: true, viewer: true },
  "archive.search": { admin: true, member: true, viewer: true },
  "decision.manage": { admin: true, member: true, viewer: false },
  "user.invite": { admin: true, member: false, viewer: false },
  "user.manage": { admin: true, member: false, viewer: false },
  "ai.configure": { admin: true, member: false, viewer: false },
  "data.export": { admin: true, member: false, viewer: false },
};

describe("permission matrix", () => {
  it("covers every declared permission", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      Object.keys(PERMISSIONS).sort(),
    );
  });

  for (const [permission, byRole] of Object.entries(EXPECTED)) {
    for (const role of ROLES) {
      it(`${role} ${byRole[role] ? "can" : "cannot"} ${permission}`, () => {
        expect(hasPermission(role, permission as Permission)).toBe(
          byRole[role],
        );
      });
    }
  }

  it("viewers never touch raw meeting text (FR-28)", () => {
    expect(hasPermission("viewer", "meeting.readRaw")).toBe(false);
  });

  it("rejects unknown roles entirely", () => {
    expect(hasPermission("superuser", "task.create")).toBe(false);
    expect(hasPermission("", "dashboard.view")).toBe(false);
  });

  it("assertPermission throws PermissionError with context", () => {
    expect(() => assertPermission("viewer", "task.create")).toThrow(
      PermissionError,
    );
    expect(() => assertPermission("member", "task.create")).not.toThrow();
  });
});
