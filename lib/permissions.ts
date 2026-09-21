// Single source of truth for the three-role permission model (§3 of the spec).
// Every Server Action and Route Handler calls requireRole/requirePermission —
// roles are enforced server-side here, never only in the UI (FR-31).

export const ROLES = ["admin", "member", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = {
  // tasks & board
  "task.create": ["admin", "member"],
  "task.edit": ["admin", "member"],
  "task.move": ["admin", "member"],
  "task.delete": ["admin"],
  "task.comment": ["admin", "member"],
  "board.configure": ["admin"],
  // objectives
  "objective.manage": ["admin", "member"],
  // meetings
  "meeting.participate": ["admin", "member"],
  "meeting.submit": ["admin", "member"],
  "meeting.readRaw": ["admin", "member"], // viewers see AI summaries only (FR-28)
  "meeting.readSummary": ["admin", "member", "viewer"],
  "template.edit": ["admin"],
  // AI pipeline
  "proposal.confirm": ["admin", "member"],
  // dashboards & archive
  "dashboard.view": ["admin", "member", "viewer"],
  "archive.search": ["admin", "member", "viewer"],
  "decision.manage": ["admin", "member"],
  // administration
  "user.invite": ["admin"],
  "user.manage": ["admin"],
  "ai.configure": ["admin"],
  "data.export": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function hasPermission(role: string, permission: Permission): boolean {
  if (!isRole(role)) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export class PermissionError extends Error {
  constructor(permission: Permission, role: string) {
    super(`Role '${role}' is not allowed to perform '${permission}'`);
    this.name = "PermissionError";
  }
}

/** Throws unless the role grants the permission. */
export function assertPermission(role: string, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new PermissionError(permission, role);
  }
}
