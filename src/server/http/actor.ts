import type { AuthenticatedStaff } from "@/server/auth/session";
import type { AuditActor } from "@/server/audit";

export function actorFromStaff(staff: AuthenticatedStaff): AuditActor {
  return { userId: staff.user.id, label: staff.user.fullName, role: staff.user.role };
}

export function actorForDevice(tableCode: string): AuditActor {
  return { userId: null, label: `Mijoz qurilmasi (${tableCode})`, role: "customer" };
}
