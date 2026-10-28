import { redirect } from "next/navigation";
import { getCurrentStaff, POS_ROLES } from "@/server/auth/session";
import { StaffShell } from "@/shared/components/layout/staff-shell";

export default async function CashierLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (!POS_ROLES.includes(staff.user.role)) redirect("/kitchen");

  return (
    <StaffShell user={{ fullName: staff.user.fullName, role: staff.user.role }} contentClassName="pb-6">
      {children}
    </StaffShell>
  );
}
