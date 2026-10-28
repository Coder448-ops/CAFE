import { redirect } from "next/navigation";
import { ADMIN_ROLES, getCurrentStaff } from "@/server/auth/session";
import { StaffShell } from "@/shared/components/layout/staff-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (!ADMIN_ROLES.includes(staff.user.role)) redirect("/cashier");

  return (
    <StaffShell user={{ fullName: staff.user.fullName, role: staff.user.role }} contentClassName="pb-10">
      {children}
    </StaffShell>
  );
}
