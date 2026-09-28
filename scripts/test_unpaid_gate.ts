import { createOrUpdateBusiness, fetchBusinesses, deleteBusiness } from "../server/db";
import { app } from "../server";
import http from "http";

async function runUnpaidGateTest() {
  console.log("==================================================");
  console.log("   FEETRUST UNPAID GATE & PAYMENT LIFECYCLE TEST  ");
  console.log("==================================================");

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(3097, () => resolve()));

  const testBizId = "biz_gate_test_" + Date.now();
  const testEmail = "pending_owner_" + Date.now() + "@test.com";

  try {
    // 1. Create a newly registered business in unpaid state (hasPaid: false, paymentStatus: 'pending')
    const created = await createOrUpdateBusiness({
      id: testBizId,
      name: "Gate Test Cafe",
      category: "Food & Beverage",
      address: "123 Test St, Chicago, IL",
      plan: "Starter",
      planPrice: "$5 USD / year",
      employeeLimit: 4,
      ownerEmail: testEmail,
      hasPaid: false,
      paymentStatus: "pending",
    });

    if (created.hasPaid !== false || created.paymentStatus !== "pending") {
      throw new Error(`Expected hasPaid: false & paymentStatus: pending, got hasPaid: ${created.hasPaid}, paymentStatus: ${created.paymentStatus}`);
    }
    console.log("✅ PASS | Business created in UNPAID pending state:", {
      id: created.id,
      hasPaid: created.hasPaid,
      paymentStatus: created.paymentStatus,
    });

    // 2. Fetch businesses via API
    const res = await fetch("http://127.0.0.1:3097/api/businesses");
    const data = await res.json();
    const fetched = (data.businesses || []).find((b: any) => b.id === testBizId);
    if (!fetched) {
      throw new Error("Created test business not found in GET /api/businesses");
    }
    if (fetched.hasPaid !== false || fetched.paymentStatus !== "pending") {
      throw new Error(`API returned incorrect status: hasPaid=${fetched.hasPaid}, paymentStatus=${fetched.paymentStatus}`);
    }
    console.log("✅ PASS | GET /api/businesses confirms hasPaid: false & paymentStatus: pending");

    // 3. Simulate payment completion (Stripe checkout.session.completed or success callback)
    const paid = await createOrUpdateBusiness({
      ...fetched,
      hasPaid: true,
      paymentStatus: "paid",
    });

    if (paid.hasPaid !== true || paid.paymentStatus !== "paid") {
      throw new Error(`Expected hasPaid: true & paymentStatus: paid, got hasPaid: ${paid.hasPaid}, paymentStatus: ${paid.paymentStatus}`);
    }
    console.log("✅ PASS | Business upgraded to PAID active state:", {
      id: paid.id,
      hasPaid: paid.hasPaid,
      paymentStatus: paid.paymentStatus,
    });

    // 4. Verify existing/demo businesses are paid by default
    const luigi = (data.businesses || []).find((b: any) => b.id === "biz_jwjbmsk");
    if (luigi && luigi.hasPaid === false) {
      throw new Error("Demo store Luigi should have hasPaid: true");
    }
    console.log("✅ PASS | Seeded demo businesses retain full access (hasPaid !== false)");

  } finally {
    // Clean up test business to preserve database hygiene
    await deleteBusiness(testBizId);
    console.log("🧹 Test cleanup: deleted test business", testBizId);
    server.close();
  }

  console.log("==================================================");
  console.log("🎉 ALL UNPAID GATE VERIFICATION CHECKS PASSED!");
  console.log("==================================================");
}

runUnpaidGateTest().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
