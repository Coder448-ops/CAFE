import { NextResponse } from "next/server";
import { ADMIN_ROLES, POS_ROLES, requireStaff } from "@/server/auth/session";
import { NO_STORE, route } from "@/server/http/handler";
import { listCategories, listProducts } from "@/server/services/menu";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireStaff([...ADMIN_ROLES, ...POS_ROLES]);
  return NextResponse.json(
    { categories: listCategories({ includeInactive: true }), products: listProducts({ includeInactive: true }) },
    NO_STORE,
  );
});
