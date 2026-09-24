import type { User } from "@/generated/prisma/client";

export function hasActiveSubscription(
  user: Pick<User, "subscriptionStatus" | "currentPeriodEnd"> | null | undefined
): boolean {
  if (!user) return false;
  if (user.subscriptionStatus !== "ACTIVE") return false;
  if (user.currentPeriodEnd && user.currentPeriodEnd.getTime() < Date.now()) {
    return false;
  }
  return true;
}
