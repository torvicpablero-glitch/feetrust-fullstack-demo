import { getActiveDatabaseUrl, fetchBusinesses } from "../server/db";
import { app } from "../server";
import http from "http";

async function runStripeTests() {
  console.log("==================================================");
  console.log("     FEETRUST STRIPE BILLING & WEBHOOK TEST       ");
  console.log("==================================================");

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(3098, () => resolve()));
  console.log("Stripe test server running on http://127.0.0.1:3098");

  try {
    // 1. Check /api/stripe/config
    const configRes = await fetch("http://127.0.0.1:3098/api/stripe/config");
    const configData = await configRes.json();
    console.log("✅ PASS | GET /api/stripe/config:", configData);
    if (!configData.hasSecretKey) {
      throw new Error("Stripe secret key is not loaded in server environment");
    }

    // 2. Test create-checkout-session for Starter Plan ($219)
    const starterRes = await fetch("http://127.0.0.1:3098/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: "starter",
        businessName: "Test Cafe",
        customerEmail: "owner@testcafe.com",
      }),
    });
    const starterData = await starterRes.json();
    console.log("Starter session response status:", starterRes.status);
    if (!starterData.url || !starterData.url.includes("stripe.com")) {
      throw new Error(`Checkout session failed: ${JSON.stringify(starterData)}`);
    }
    console.log("✅ PASS | POST /api/stripe/create-checkout-session (Starter):", starterData.url.substring(0, 55) + "...");

    // 3. Test create-checkout-session for Business Plan ($499)
    const bizRes = await fetch("http://127.0.0.1:3098/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: "business",
        businessName: "VALET Kitchen + Koctails",
        customerEmail: "jcmari100k@gmail.com",
      }),
    });
    const bizData = await bizRes.json();
    if (!bizData.url || !bizData.url.includes("stripe.com")) {
      throw new Error(`Business checkout session failed: ${JSON.stringify(bizData)}`);
    }
    console.log("✅ PASS | POST /api/stripe/create-checkout-session (Business):", bizData.url.substring(0, 55) + "...");

    // 4. Test Webhook rejection without valid signature
    const badWebhookRes = await fetch("http://127.0.0.1:3098/api/stripe/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "test" }),
    });
    console.log("Webhook without signature status:", badWebhookRes.status);
    if (badWebhookRes.status !== 400) {
      throw new Error(`Expected 400 on unverified webhook, got ${badWebhookRes.status}`);
    }
    console.log("✅ PASS | POST /api/stripe/webhook (Rejects unverified requests with 400)");

    console.log("\n==================================================");
    console.log("🎉 ALL STRIPE INTEGRATION TESTS PASSED!");
    console.log("==================================================");
  } finally {
    server.close();
  }
}

runStripeTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
