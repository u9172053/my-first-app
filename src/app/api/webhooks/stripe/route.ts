import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "webhook未設定" }, { status: 503 });
  }

  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature ?? "",
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return NextResponse.json(
      { error: `署名の検証に失敗しました: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = await resolveSubscription(event, stripe);
      if (subscription) await syncSubscription(subscription);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await prisma.user.updateMany({
        where: { stripeCustomerId: subscription.customer as string },
        data: { subscriptionStatus: "CANCELED" },
      });
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

async function resolveSubscription(
  event: Stripe.Event,
  stripe: Stripe
): Promise<Stripe.Subscription | null> {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (!session.subscription) return null;
    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id;
    return stripe.subscriptions.retrieve(subId);
  }
  return event.data.object as Stripe.Subscription;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const status =
    subscription.status === "active" || subscription.status === "trialing"
      ? "ACTIVE"
      : subscription.status === "past_due"
        ? "PAST_DUE"
        : "CANCELED";

  const currentPeriodEndSec = subscription.items.data[0]?.current_period_end;

  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: status,
      currentPeriodEnd: currentPeriodEndSec
        ? new Date(currentPeriodEndSec * 1000)
        : null,
    },
  });
}
