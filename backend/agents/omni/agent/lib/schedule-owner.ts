import type { SessionContext } from "eve/context";

export function requireScheduleOwner(ctx: SessionContext): {
  userId: string;
} {
  const auth = ctx.session.auth.current;
  if (!auth?.principalId) {
    throw new Error("An authenticated user is required to manage schedules.");
  }
  return { userId: auth.principalId };
}
