import { NextResponse } from "next/server";
import { NO_STORE, requireTableDevice, route } from "@/server/http/handler";
import { listCategories, listProducts } from "@/server/services/menu";

export const dynamic = "force-dynamic";

/** Menu browsing requires a paired device so ordering and browsing share one identity. */
export const GET = route(async () => {
  await requireTableDevice();
  return NextResponse.json(
    { categories: listCategories(), products: listProducts({ onlyAvailable: true }) },
    NO_STORE,
  );
});
