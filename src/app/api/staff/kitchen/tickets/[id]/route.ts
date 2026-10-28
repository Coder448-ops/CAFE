import { NextResponse } from "next/server";
import { z } from "zod";
import { KITCHEN_ROLES, POS_ROLES, requireStaff } from "@/server/auth/session";
import { actorFromStaff } from "@/server/http/actor";
import { numericParam, parseBody, route } from "@/server/http/handler";
import { listTickets, updateTicketStatus } from "@/server/services/kitchen";
import { forbidden } from "@/server/http/errors";

const ticketUpdateSchema = z.object({
  status: z.enum(["preparing", "ready", "served", "cancelled"]),
});

export const POST = route<{ params: Promise<{ id: string }> }>(async (request, context) => {
  const staff = await requireStaff([...KITCHEN_ROLES, ...POS_ROLES]);
  const { id } = await context.params;
  const ticketId = numericParam(id);
  const input = await parseBody(request, ticketUpdateSchema);

  const isPos = POS_ROLES.includes(staff.user.role);
  if (input.status === "served" && !isPos) throw forbidden("Bu amalni faqat kassir bajaradi");
  if (input.status === "cancelled" && !isPos) throw forbidden("Biletni faqat kassir bekor qiladi");

  const ticket = updateTicketStatus({
    ticketId,
    status: input.status,
    actorUserId: staff.user.id,
    actor: actorFromStaff(staff),
    allowServe: isPos,
    allowCancel: isPos,
  });
  return NextResponse.json({ ticket });
});

export const GET = route<{ params: Promise<{ id: string }> }>(async (_request, context) => {
  await requireStaff([...KITCHEN_ROLES, ...POS_ROLES]);
  const { id } = await context.params;
  const ticket = listTickets({ includeHistory: true }).find((candidate) => candidate.id === numericParam(id));
  if (!ticket) return NextResponse.json({ error: { message: "Bilet topilmadi" } }, { status: 404 });
  return NextResponse.json({ ticket });
});
