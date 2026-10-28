import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/server/auth/session";
import { StaffAdmin } from "@/modules/administration/components/staff-admin";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  return <StaffAdmin currentUserId={staff.user.id} />;
}
