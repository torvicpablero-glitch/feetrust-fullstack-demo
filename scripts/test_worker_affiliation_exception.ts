import { fetchBusinesses, createOrUpdateBusiness, createOrUpdateWorker, fetchWorkers, WorkerProfile, BusinessProfile } from "../server/db";
import { isWorkerManagerAffiliated } from "../src/lib/store";

async function runAffiliationExceptionTest() {
  console.log("\n================================================================================");
  console.log("  FEETRUST WORKER REGISTRATION EXCEPTION (INVITE VS MAP VISIBILITY) TEST  ");
  console.log("================================================================================\n");

  const bizId = "biz_test_" + Date.now();
  const bizName = "Apex Craft Roasters " + Date.now();

  // 1. Create Business
  const business: BusinessProfile = {
    id: bizId,
    name: bizName,
    category: "Coffee & Bakery",
    address: "200 N Michigan Ave, Chicago, IL",
    rating: 5.0,
    qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300",
    employeeLimit: 4,
    workers: [],
  };
  await createOrUpdateBusiness(business);
  console.log(`[SETUP] Created Business: "${bizName}" (ID: ${bizId}, Limit: 4 seats)`);

  // 2. Worker 1 signs up WITH manager invite link
  const worker1: WorkerProfile = {
    id: "worker_invited_" + Date.now(),
    name: "Alex Rivera (Invited)",
    position: "Head Barista",
    level: 1,
    initials: "AR",
    lat: 41.8818,
    lng: -87.6231,
    role: "Worker",
    isAvailable: true,
    workplace: bizName,
    registeredViaInvite: true,
    invitedByBusinessId: bizId,
    businessId: bizId,
    isVerifiedStaff: true,
  };
  await createOrUpdateWorker(worker1);
  console.log(`[SIGNUP] Worker 1 registered WITH manager invite link: "${worker1.name}"`);

  // 3. Worker 2 signs up WITHOUT manager invite link (manual workplace entry)
  const worker2: WorkerProfile = {
    id: "worker_organic_" + Date.now(),
    name: "Sam Taylor (Self-Reported)",
    position: "Shift Barista",
    level: 1,
    initials: "ST",
    lat: 41.8818,
    lng: -87.6231,
    role: "Worker",
    isAvailable: true,
    workplace: bizName,
    registeredViaInvite: false,
    isVerifiedStaff: false,
  };
  await createOrUpdateWorker(worker2);
  console.log(`[SIGNUP] Worker 2 registered WITHOUT manager invite link: "${worker2.name}"`);

  // 4. Test isWorkerManagerAffiliated logic
  const isW1Affiliated = isWorkerManagerAffiliated(worker1, business);
  const isW2Affiliated = isWorkerManagerAffiliated(worker2, business);

  console.log("\n--- Verification: Business Manager Affiliation ---");
  if (isW1Affiliated) {
    console.log(" ✅ PASS: Worker 1 is recognized as manager-affiliated staff.");
  } else {
    throw new Error("FAIL: Worker 1 should be manager-affiliated!");
  }

  if (!isW2Affiliated) {
    console.log(" ✅ PASS: Worker 2 is NOT recognized as manager-affiliated staff (excluded from dashboard).");
  } else {
    throw new Error("FAIL: Worker 2 should NOT be manager-affiliated without invite!");
  }

  // 5. Fetch businesses from DB and verify dashboard roster
  const allBusinesses = await fetchBusinesses();
  const fetchedBiz = allBusinesses.find(b => b.id === bizId);
  const bizRoster = fetchedBiz?.workers || [];

  console.log("\n--- Verification: Business Roster / Dashboard Seat Count ---");
  const hasW1 = bizRoster.some(w => w.id === worker1.id);
  const hasW2 = bizRoster.some(w => w.id === worker2.id);

  if (hasW1) {
    console.log(` ✅ PASS: Worker 1 ("${worker1.name}") appears on the business roster.`);
  } else {
    throw new Error("FAIL: Worker 1 should be on the business roster!");
  }

  if (!hasW2) {
    console.log(` ✅ PASS: Worker 2 ("${worker2.name}") does NOT appear on the business roster.`);
  } else {
    throw new Error("FAIL: Worker 2 should NOT appear on the business roster!");
  }

  console.log(` ℹ️ Business Staff Count: ${bizRoster.length} (Only invited staff counted toward limit)`);

  // 6. Test Map Visibility (all workers with workplace matching business name)
  console.log("\n--- Verification: Public Map / Venue Discovery ---");
  const allWorkers = await fetchWorkers();
  const mapWorkersForBiz = allWorkers.filter(
    w => w.role !== "Business" && w.workplace && w.workplace.toLowerCase().trim() === bizName.toLowerCase().trim()
  );

  const mapHasW1 = mapWorkersForBiz.some(w => w.id === worker1.id);
  const mapHasW2 = mapWorkersForBiz.some(w => w.id === worker2.id);

  if (mapHasW1) {
    console.log(` ✅ PASS: Worker 1 ("${worker1.name}") appears on the Map under "${bizName}".`);
  } else {
    throw new Error("FAIL: Worker 1 should appear on the Map!");
  }

  if (mapHasW2) {
    console.log(` ✅ PASS: Worker 2 ("${worker2.name}") STILL appears on the Map under "${bizName}" for customer merit tipping.`);
  } else {
    throw new Error("FAIL: Worker 2 MUST still appear on the Map!");
  }

  // 7. Cleanup test fixtures so test never pollutes data.json
  const store = (await import("../server/db")).getLocalDataStore();
  store.businesses = (store.businesses || []).filter(b => b.id !== bizId);
  store.workers = (store.workers || []).filter(w => w.id !== worker1.id && w.id !== worker2.id);
  (await import("../server/db")).saveLocalDataStore(store);
  console.log(`[CLEANUP] Purged test business ("${bizName}") and test workers from data store.`);

  console.log("\n================================================================================");
  console.log("  ALL AFFILIATION EXCEPTION TESTS PASSED SUCCESSFULLY!  ");
  console.log("================================================================================\n");
}

runAffiliationExceptionTest().catch(err => {
  console.error("❌ Test Suite Error:", err);
  process.exit(1);
});
