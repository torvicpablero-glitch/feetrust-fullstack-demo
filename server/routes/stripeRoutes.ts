import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { fetchBusinesses, createOrUpdateBusiness } from "../db";
import { optionalAuth, AuthenticatedRequest } from "../middleware/auth";

export const stripeRouter = Router();

// Retrieve Stripe secret key supporting both conventional and legacy environment variable names
function getStripeSecretKey(): string {
  return (
    process.env.STRIPE_SECRET_KEY ||
    process.env.OFFICIAL_STRIPE_SECRET_KEY ||
    ""
  ).trim();
}

function getStripeClient(): Stripe | null {
  const key = getStripeSecretKey();
  if (!key) return null;
  return new Stripe(key);
}

// Plan specifications mirroring FeeTrust product definition
const PLAN_CATALOG: Record<string, { name: string; priceCents: number; limit: number; formattedPrice: string }> = {
  starter: {
    name: "FeeTrust Starter Plan",
    priceCents: 500,
    limit: 4,
    formattedPrice: "$5 USD / year",
  },
  growth: {
    name: "FeeTrust Growth Plan",
    priceCents: 34900,
    limit: 8,
    formattedPrice: "$349 USD / year",
  },
  business: {
    name: "FeeTrust Business Plan",
    priceCents: 49900,
    limit: 15,
    formattedPrice: "$499 USD / year",
  },
};

// 1. GET /api/stripe/config
// Exposes the public publishable key to the client
stripeRouter.get("/config", (req: Request, res: Response) => {
  const publishableKey = (
    process.env.VITE_STRIPE_PUBLISHABLE_KEY ||
    process.env.STRIPE_PUBLISHABLE_KEY ||
    ""
  ).trim();
  res.json({
    publishableKey,
    hasSecretKey: Boolean(getStripeSecretKey()),
    hasWebhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
  });
});

// 2. POST /api/stripe/create-checkout-session
// Generates a Stripe Checkout URL for annual recurring plans
stripeRouter.post("/create-checkout-session", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(500).json({
        error: "Stripe is not configured on this server. Missing STRIPE_SECRET_KEY.",
      });
    }

    const body = req.body || {};
    const {
      planId = "starter",
      businessId,
      businessName,
      customerEmail,
      successUrl,
      cancelUrl,
    } = body;

    const normalizedPlanId = String(planId).toLowerCase().trim();
    const planSpec = PLAN_CATALOG[normalizedPlanId] || PLAN_CATALOG.starter;

    const resolvedEmail =
      customerEmail || req.user?.email || undefined;

    const origin =
      req.headers.origin ||
      (req.headers.host ? `https://${req.headers.host}` : "https://www.feetrust.com");

    const resolvedSuccessUrl =
      successUrl || `${origin}/business?payment=success&plan=${normalizedPlanId}`;
    const resolvedCancelUrl =
      cancelUrl || `${origin}/business?payment=cancelled`;

    // Create a subscription checkout session with inline dynamic pricing
    const sessionParams: any = {
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: planSpec.name,
              description: `FeeTrust annual membership for up to ${planSpec.limit} staff members. Includes counter QR display kit, verified map listing, and live analytics.`,
            },
            unit_amount: planSpec.priceCents,
            recurring: {
              interval: "year",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        businessId: businessId || "",
        businessName: businessName || "",
        planId: normalizedPlanId,
        planName: planSpec.name,
        planPrice: planSpec.formattedPrice,
        employeeLimit: String(planSpec.limit),
        userId: req.user?.uid || "",
      },
      subscription_data: {
        metadata: {
          businessId: businessId || "",
          planId: normalizedPlanId,
          userId: req.user?.uid || "",
        },
      },
      success_url: resolvedSuccessUrl,
      cancel_url: resolvedCancelUrl,
    };

    if (resolvedEmail && typeof resolvedEmail === "string" && resolvedEmail.includes("@")) {
      sessionParams.customer_email = resolvedEmail.trim();
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    res.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error: any) {
    console.error("[STRIPE] create-checkout-session error:", error);
    res.status(500).json({ error: error.message || "Failed to create checkout session" });
  }
});

// 3. POST /api/stripe/create-portal-session
// Generates a Stripe Customer Portal session for managing invoices and cards
stripeRouter.post("/create-portal-session", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(500).json({ error: "Stripe is not configured." });
    }

    const { customerId, returnUrl } = req.body;
    if (!customerId) {
      return res.status(400).json({ error: "customerId is required." });
    }

    const origin =
      req.headers.origin ||
      (req.headers.host ? `https://${req.headers.host}` : "https://www.feetrust.com");

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${origin}/business`,
    });

    res.json({ success: true, url: portalSession.url });
  } catch (error: any) {
    console.error("[STRIPE] create-portal-session error:", error);
    res.status(500).json({ error: error.message || "Failed to create portal session" });
  }
});

// 4. POST /api/stripe/webhook
// Cryptographically verified Stripe webhook listener
stripeRouter.post("/webhook", async (req: Request, res: Response) => {
  const stripe = getStripeClient();
  if (!stripe) {
    return res.status(500).json({ error: "Stripe not configured on server" });
  }

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    const rawBody = (req as any).rawBody || req.body;
    if (!sig || !webhookSecret) {
      console.warn("[STRIPE WEBHOOK] Missing stripe-signature or STRIPE_WEBHOOK_SECRET");
      return res.status(400).send("Webhook Secret / Signature missing.");
    }

    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error("[STRIPE WEBHOOK] Verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[STRIPE WEBHOOK] Received event: ${event.type} (ID: ${event.id})`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};
        const businessId = metadata.businessId;
        const customerEmail = session.customer_email || metadata.customerEmail;
        const planId = metadata.planId || "starter";
        const planSpec = PLAN_CATALOG[planId] || PLAN_CATALOG.starter;

        console.log(`[STRIPE WEBHOOK] Checkout completed for business: ${businessId || "unassigned"} - Plan: ${planSpec.name}`);

        const businesses = await fetchBusinesses();
        const targetBiz = businesses.find(b => 
          (businessId && b.id === businessId) ||
          (customerEmail && b.ownerEmail && b.ownerEmail.toLowerCase() === customerEmail.toLowerCase())
        );

        if (targetBiz) {
          await createOrUpdateBusiness({
            ...targetBiz,
            plan: (planId.charAt(0).toUpperCase() + planId.slice(1)) as any,
            planPrice: planSpec.formattedPrice,
            employeeLimit: planSpec.limit,
            user_id: targetBiz.user_id || metadata.userId || undefined,
            hasPaid: true,
            paymentStatus: 'paid',
          });
          console.log(`[STRIPE WEBHOOK] Business ${targetBiz.id} marked as PAID and upgraded to ${planSpec.name} (${planSpec.limit} staff)`);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`[STRIPE WEBHOOK] Invoice paid: ${invoice.id} for customer: ${invoice.customer}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn(`[STRIPE WEBHOOK] Invoice payment failed: ${invoice.id}`);
        break;
      }

      default:
        // Ignore unhandled event types gracefully
        break;
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error(`[STRIPE WEBHOOK] Error processing event ${event.type}:`, error);
    res.status(500).json({ error: error.message });
  }
});
