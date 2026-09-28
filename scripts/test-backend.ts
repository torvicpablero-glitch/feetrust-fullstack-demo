process.env.IS_TEST_RUNNER = "true";
process.env.NODE_ENV = "test";
import { app } from "../server";
import http from "http";

async function runTests() {
  console.log("🚀 Starting FeeTrust Backend API Verification Tests...\n");

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(` ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(` ❌ FAIL: ${name} ->`, err.message);
      failed++;
    }
  }

  // 1. Healthcheck Test
  await test("GET /api/health", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const json = await res.json();
    // "ok" when a DB is configured; "degraded" is the honest status when DATABASE_URL is absent
    if (res.status !== 200 || !["ok", "degraded"].includes(json.status)) {
      throw new Error(`Expected status 200 (ok|degraded), got ${res.status} ${JSON.stringify(json)}`);
    }
  });

  // 2. Auth Signup Test
  let token = "";
  let userId = "";
  let nonOwnedWorkerId = "";
  let testEmailAddr = "";
  await test("POST /api/auth/signup", async () => {
    const testEmail = `test_${Date.now()}@feetrust.com`;
    testEmailAddr = testEmail;
    const res = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test User", email: testEmail, password: "password123", role: "Customer" }),
    });
    const json = await res.json();
    if (res.status !== 200 || !json.token) {
      throw new Error(`Signup failed: ${JSON.stringify(json)}`);
    }
    token = json.token;
    userId = json.user.uid || json.user.id;
  });

  // 3. Auth Me Test
  await test("GET /api/auth/me", async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (res.status !== 200 || !json.user) {
      throw new Error(`Auth me failed: ${JSON.stringify(json)}`);
    }
  });

  // 3b. Google Sign-In API Test
  await test("POST /api/auth/google", async () => {
    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-suite": "true" },
      body: JSON.stringify({ email: "google.tester@feetrust.com", name: "Google Tester", photoURL: "https://lh3.googleusercontent.com/a/example" }),
    });
    const json = await res.json();
    if (res.status !== 200 || !json.token || !json.user) {
      throw new Error(`Google Auth failed: ${JSON.stringify(json)}`);
    }
  });

  // 4. Workers Test
  let firstWorkerId = "";
  await test("GET /api/workers", async () => {
    const res = await fetch(`${baseUrl}/api/workers`);
    const json = await res.json();
    if (res.status !== 200 || !Array.isArray(json.workers) || json.workers.length === 0) {
      throw new Error(`Get workers failed: ${JSON.stringify(json)}`);
    }
    firstWorkerId = json.workers[0].id;
    // Pick a worker that is NOT owned by the test user (name differs) for
    // non-owner authorization + merit-target tests.
    const notMine = json.workers.find((w: any) => (w.name || '').trim().toLowerCase() !== 'test user');
    nonOwnedWorkerId = notMine ? notMine.id : json.workers[0].id;
  });

  // 5. Worker Detail & Availability Patch
  let ownedWorkerId = "";
  await test("POST /api/workers (create owned worker)", async () => {
    const res = await fetch(`${baseUrl}/api/workers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: "Test User", position: "Tester", workplace: "Test Store", role: "Worker", isVerifiedStaff: true }),
    });
    const json = await res.json();
    if (res.status !== 200 || !json.worker?.id) {
      throw new Error(`Create worker failed: ${JSON.stringify(json)}`);
    }
    ownedWorkerId = json.worker.id;
  });

  await test("PATCH /api/workers/:id/availability", async () => {
    const res = await fetch(`${baseUrl}/api/workers/${ownedWorkerId}/availability`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ isAvailable: false }),
    });
    const json = await res.json();
    if (res.status !== 200 || json.worker.isAvailable !== false) {
      throw new Error(`Patch availability failed: ${JSON.stringify(json)}`);
    }
  });

  await test("PATCH /api/workers/:id/availability (forbidden for non-owner)", async () => {
    const res = await fetch(`${baseUrl}/api/workers/${nonOwnedWorkerId}/availability`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ isAvailable: false }),
    });
    if (res.status !== 403) {
      throw new Error(`Expected 403 for non-owner, got ${res.status}`);
    }
  });

  // 6. Businesses Test
  await test("GET /api/businesses", async () => {
    const res = await fetch(`${baseUrl}/api/businesses`);
    const json = await res.json();
    if (res.status !== 200 || !Array.isArray(json.businesses) || json.businesses.length === 0) {
      throw new Error(`Get businesses failed: ${JSON.stringify(json)}`);
    }
  });

  await test("GET /api/auth/me (synthetic token_* is rejected)", async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer token_usr_admin_torvic_1789000000000` },
    });
    if (res.status !== 401) {
      throw new Error(`Expected 401 for synthetic token, got ${res.status}`);
    }
  });

  await test("DELETE /api/businesses/:id (owner delete sticks)", async () => {
    const bizId = "biz_delete_test_" + Date.now();
    const created = await fetch(`${baseUrl}/api/businesses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: bizId, name: "Delete Test Store " + bizId, category: "Test", address: "Chicago, IL" }),
    });
    if (created.status !== 200) throw new Error(`Create for delete failed: ${JSON.stringify(await created.json())}`);

    const del = await fetch(`${baseUrl}/api/businesses/${bizId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    if (del.status !== 200) throw new Error(`Owner delete failed: ${JSON.stringify(await del.json())}`);

    const after = await (await fetch(`${baseUrl}/api/businesses`)).json();
    if ((after.businesses || []).some((b: any) => b.id === bizId)) {
      throw new Error("Deleted business still present in the businesses list.");
    }
  });

  await test("DELETE /api/businesses/:id (forbidden for non-owner)", async () => {
    const res = await fetch(`${baseUrl}/api/businesses/biz_3`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    if (res.status !== 403) {
      throw new Error(`Expected 403 deleting a business you don't own, got ${res.status}`);
    }
  });

  await test("DELETE /api/workers/:id (owner delete sticks)", async () => {
    const created = await fetch(`${baseUrl}/api/workers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: "DeleteMe Worker " + Date.now(), position: "Temp", workplace: "Test Store" }),
    });
    const cJson = await created.json();
    const wid = cJson.worker?.id;
    if (!wid) throw new Error(`Create for delete failed: ${JSON.stringify(cJson)}`);

    const del = await fetch(`${baseUrl}/api/workers/${wid}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    if (del.status !== 200) throw new Error(`Worker delete failed: ${JSON.stringify(await del.json())}`);

    const after = await (await fetch(`${baseUrl}/api/workers`)).json();
    if ((after.workers || []).some((w: any) => w.id === wid)) {
      throw new Error("Deleted worker still present in the workers list.");
    }
  });

  // 7. Submit Review/Merit & Tip Test
  let createdReviewId = "";
  await test("POST /api/reviews", async () => {
    const res = await fetch(`${baseUrl}/api/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromUserId: userId,
        fromUserName: "Test User",
        toUserId: nonOwnedWorkerId,
        meritType: "Legend",
        tipAmount: 10,
        reviewText: "Outstanding service!",
      }),
    });
    const json = await res.json();
    if (res.status !== 201 || !json.review) {
      throw new Error(`Post review failed: ${JSON.stringify(json)}`);
    }
    createdReviewId = json.review.id;
  });

  await test("POST /api/reviews (rejects self-merit)", async () => {
    const res = await fetch(`${baseUrl}/api/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        fromUserId: userId,
        fromUserName: "Test User",
        toUserId: ownedWorkerId,
        meritType: "Legend",
        tipAmount: 0,
        reviewText: "self",
      }),
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400 for self-merit, got ${res.status}`);
    }
  });

  await test("POST /api/reviews (rejects invalid merit type)", async () => {
    const res = await fetch(`${baseUrl}/api/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        fromUserId: userId,
        fromUserName: "Test User",
        toUserId: nonOwnedWorkerId,
        meritType: "NotARealMerit",
        tipAmount: 0,
      }),
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400 for invalid merit type, got ${res.status}`);
    }
  });

  // 8. Submit Thank-You Note Test
  await test("POST /api/reviews/:id/thank-you", async () => {
    const res = await fetch(`${baseUrl}/api/reviews/${createdReviewId}/thank-you`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromWorkerName: "Alex Morgan",
        toUserName: "Test User",
        message: "Thank you so much for the tip!",
      }),
    });
    const json = await res.json();
    if (res.status !== 201 || !json.thankYouNote) {
      throw new Error(`Post thank you note failed: ${JSON.stringify(json)}`);
    }
  });

  // 9. Activity Feed Test
  await test("GET /api/activity", async () => {
    const res = await fetch(`${baseUrl}/api/activity`);
    const json = await res.json();
    if (res.status !== 200 || !Array.isArray(json.activityFeed)) {
      throw new Error(`Get activity failed: ${JSON.stringify(json)}`);
    }
  });

  // 10. Claim Coupon Test
  await test("POST /api/coupons/claim", async () => {
    const res = await fetch(`${baseUrl}/api/coupons/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        couponId: "beta_gift",
        code: "FEETRUST-BETA10K",
        gemsAwarded: 10000,
      }),
    });
    const json = await res.json();
    if (res.status !== 201 || !json.claim) {
      throw new Error(`Claim coupon failed: ${JSON.stringify(json)}`);
    }
  });

  await test("POST /api/coupons/claim (idempotent — no double credit)", async () => {
    const res = await fetch(`${baseUrl}/api/coupons/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, couponId: "beta_gift", code: "FEETRUST-BETA10K", gemsAwarded: 10000 }),
    });
    const json = await res.json();
    if (res.status !== 201 || json.gemsAwarded !== 10000) {
      throw new Error(`Idempotent claim failed: ${JSON.stringify(json)}`);
    }
  });

  await test("GET /api/coupons/claims (durable history)", async () => {
    const res = await fetch(`${baseUrl}/api/coupons/claims?userId=${encodeURIComponent(userId)}`);
    const json = await res.json();
    if (res.status !== 200 || !Array.isArray(json.claims) || json.claims.length < 1) {
      throw new Error(`Coupon claims lookup failed: ${JSON.stringify(json)}`);
    }
  });

  await test("POST /api/coupons/claim (spend deducts gems)", async () => {
    // User currently holds 10000 gems from the bonus claim above.
    const res = await fetch(`${baseUrl}/api/coupons/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ couponId: "perk_coffee_5", code: "FT-COFFEE_5-TEST", gemsAwarded: -500 }),
    });
    const json = await res.json();
    if (res.status !== 201 || json.claim?.gemsAwarded !== -500) {
      throw new Error(`Spend not recorded (expected -500): ${JSON.stringify(json)}`);
    }
  });

  await test("POST /api/coupons/claim (insufficient gems rejected)", async () => {
    const res = await fetch(`${baseUrl}/api/coupons/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ couponId: "perk_expensive", code: "FT-EXPENSIVE-TEST", gemsAwarded: -999999 }),
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400 for oversized spend, got ${res.status}`);
    }
  });

  await test("POST /api/businesses/:id/invite (requires auth)", async () => {
    const res = await fetch(`${baseUrl}/api/businesses/biz_2/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "spam@example.com", inviteUrl: "https://www.feetrust.com/auth" }),
    });
    if (res.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated invite, got ${res.status}`);
    }
  });

  await test("POST /api/businesses/:id/invite (forbidden for non-owner)", async () => {
    const res = await fetch(`${baseUrl}/api/businesses/biz_2/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: "spam@example.com", inviteUrl: "https://www.feetrust.com/auth" }),
    });
    if (res.status !== 403) {
      throw new Error(`Expected 403 inviting to a business you don't own, got ${res.status}`);
    }
  });

  await test("POST /api/auth/signup (new account starts with 0 gems, level 1)", async () => {
    const email = `fresh_${Date.now()}@feetrust.com`;
    const created = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Fresh Stats Probe", email, password: "password123", role: "Customer" }),
    });
    if (created.status !== 200) throw new Error(`Signup failed: ${JSON.stringify(await created.json())}`);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "password123" }),
    });
    const u = (await login.json()).user || {};
    if (u.gems !== 0 || u.level !== 1) {
      throw new Error(`New account should start at 0 gems / level 1, got gems=${u.gems} level=${u.level}`);
    }
  });

  await test("POST /api/auth/delete-account (purges account)", async () => {
    const email = `purge_${Date.now()}@feetrust.com`;
    const signup = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Purge Target", email, password: "password123", role: "Customer" }),
    });
    const sJson = await signup.json();
    if (signup.status !== 200) throw new Error(`Purge signup failed: ${JSON.stringify(sJson)}`);

    const del = await fetch(`${baseUrl}/api/auth/delete-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sJson.token}` },
      body: JSON.stringify({ userId: sJson.user.uid, email }),
    });
    if (del.status !== 200) throw new Error(`Delete failed: ${JSON.stringify(await del.json())}`);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "password123" }),
    });
    if (login.status === 200) {
      throw new Error("Deleted account can still log in.");
    }
  });

  await test("POST /api/auth/delete-account (requires auth)", async () => {
    const res = await fetch(`${baseUrl}/api/auth/delete-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "victim@example.com" }),
    });
    if (res.status === 200) {
      throw new Error("Unauthenticated delete-account must not succeed.");
    }
  });

  await test("POST /api/auth/request-password-reset (no account-enumeration oracle)", async () => {
    // Existing account
    const knownEmail = `enum_${Date.now()}@feetrust.com`;
    await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Enum Probe", email: knownEmail, password: "password123", role: "Customer" }),
    });
    const unknownEmail = `enum_missing_${Date.now()}@feetrust.com`;

    const [knownRes, unknownRes] = await Promise.all([
      fetch(`${baseUrl}/api/auth/request-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: knownEmail }),
      }),
      fetch(`${baseUrl}/api/auth/request-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: unknownEmail }),
      }),
    ]);

    if (knownRes.status !== unknownRes.status) {
      throw new Error(`Status differs: known=${knownRes.status} unknown=${unknownRes.status}`);
    }
    const known = await knownRes.json();
    const unknown = await unknownRes.json();
    const kKeys = Object.keys(known).sort().join(",");
    const uKeys = Object.keys(unknown).sort().join(",");
    if (kKeys !== uKeys) {
      throw new Error(`Response shape leaks account existence:\n  known:   ${kKeys}\n  unknown: ${uKeys}`);
    }
  });

  await test("POST /api/auth/password reset (request + reset + login)", async () => {
    const email = `reset_${Date.now()}@feetrust.com`;
    const oldPw = "oldpassword123";
    const newPw = "newpassword456";

    const su = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Reset Target", email, password: oldPw, role: "Customer" }),
    });
    if (su.status !== 200) throw new Error(`Reset signup failed: ${JSON.stringify(await su.json())}`);

    const reqRes = await fetch(`${baseUrl}/api/auth/request-password-reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const reqJson = await reqRes.json();
    if (reqRes.status !== 200 || !reqJson.verificationToken) {
      throw new Error(`Reset request failed: ${JSON.stringify(reqJson)}`);
    }
    if (!reqJson.devCode) {
      // In non-dev environments the code is delivered by email instead.
      return;
    }

    const resetRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: reqJson.devCode, token: reqJson.verificationToken, newPassword: newPw }),
    });
    if (resetRes.status !== 200) {
      throw new Error(`Reset failed: ${JSON.stringify(await resetRes.json())}`);
    }

    const oldLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: oldPw }),
    });
    if (oldLogin.status === 200) throw new Error("Old password still works after reset.");

    const newLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: newPw }),
    });
    if (newLogin.status !== 200) throw new Error(`New password login failed: ${JSON.stringify(await newLogin.json())}`);
  });

  // 11. QR Verify Worker Test
  await test("POST /api/qr/verify (Worker Payload)", async () => {
    const res = await fetch(`${baseUrl}/api/qr/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrData: `https://www.feetrust.com/worker/${firstWorkerId}` }),
    });
    const json = await res.json();
    if (res.status !== 200 || !json.verified || json.type !== "worker") {
      throw new Error(`QR worker verification failed: ${JSON.stringify(json)}`);
    }
  });

  // 12. QR Generate Test
  await test("POST /api/qr/generate", async () => {
    const res = await fetch(`${baseUrl}/api/qr/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "business", targetId: "biz_1" }),
    });
    const json = await res.json();
    if (res.status !== 200 || !json.qrCodeUrl) {
      throw new Error(`QR generation failed: ${JSON.stringify(json)}`);
    }
  });

  // 13. Admin moderation
  let adminToken = "";
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim();
  const adminPassword = (process.env.ADMIN_PASSWORD || "").trim();
  const hasAdminCreds = Boolean(adminEmail && adminPassword);

  await test("POST /api/auth/login (admin)", async () => {
    if (!hasAdminCreds) {
      // Admin is intentionally disabled unless ADMIN_EMAIL/ADMIN_PASSWORD are configured.
      return;
    }
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    const json = await res.json();
    if (res.status !== 200 || json.user?.role !== "Admin") {
      throw new Error(`Admin login failed: ${JSON.stringify(json)}`);
    }
    adminToken = json.token;
  });

  await test("POST /api/auth/login (admin portal disabled without env creds)", async () => {
    if (hasAdminCreds) return;
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "torvicpablero@gmail.com", password: "Pablero*20" }),
    });
    if (res.status === 200) {
      throw new Error("Hardcoded admin credentials must not work.");
    }
  });

  await test("GET /api/admin/users (forbidden for non-admin)", async () => {
    const res = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status !== 403) {
      throw new Error(`Expected 403 for non-admin, got ${res.status}`);
    }
  });

  await test("GET /api/admin/users (admin)", async () => {
    if (!adminToken) return; // admin disabled without env creds
    const res = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const json = await res.json();
    if (res.status !== 200 || !Array.isArray(json.users)) {
      throw new Error(`Admin user list failed: ${JSON.stringify(json)}`);
    }
  });

  await test("PATCH /api/admin/users/:id/status (suspend blocks login)", async () => {
    if (!adminToken) return; // admin disabled without env creds
    const res = await fetch(`${baseUrl}/api/admin/users/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: "suspended" }),
    });
    if (res.status !== 200) {
      throw new Error(`Suspend failed: ${JSON.stringify(await res.json())}`);
    }
    // Suspended user must not be able to log in
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmailAddr, password: "password123" }),
    });
    if (loginRes.status !== 403) {
      throw new Error(`Expected 403 for suspended login, got ${loginRes.status}`);
    }
  });

  server.close();
  console.log(`\n🎉 Verification Complete: ${passed} passed, ${failed} failed.\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
