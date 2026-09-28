import fs from 'fs';
import path from 'path';
import { syncWorkerAvatar, getLocalDataStore, saveLocalDataStore, createOrUpdateBusiness } from '../server/db';

async function testBossFixes() {
  console.log("==================================================");
  console.log("FEETRUST BOSS FEEDBACK VERIFICATION SUITE");
  console.log("==================================================");
  let allPassed = true;

  // 1. Test Business Seat Synchronization
  console.log("\n🏢 [1/4] Verifying Business Dashboard Seat Calculation...");
  const testBiz = await createOrUpdateBusiness({
    id: "biz_test_sync_" + Date.now(),
    name: "Valet Parking Co",
    plan: "Business",
    planPrice: "$499 USD / year",
  });

  if (testBiz.employeeLimit === 15 && testBiz.plan === "Business") {
    console.log(`   ✅ PASS: Business plan correctly enforced 15 seats (received: ${testBiz.employeeLimit}).`);
  } else {
    console.error(`   ❌ FAIL: Expected 15 seats for Business plan, got: ${testBiz.employeeLimit}`);
    allPassed = false;
  }

  // 2. Test syncWorkerAvatar in server/db
  console.log("\n📸 [2/4] Verifying Profile Avatar Server Synchronization...");
  const store = getLocalDataStore();
  const testWorkerId = "worker_test_" + Date.now();
  store.workers.push({
    id: testWorkerId,
    name: "Carlos Test Stylist",
    position: "Stylist",
    category: "Stylists",
    workplace: "Valet Parking Co",
    level: 2,
    initials: "CT",
    lat: 41.878,
    lng: -87.629,
    role: "Worker",
    isAvailable: true,
    avatar: "https://feetrust.com/old_avatar.png"
  });
  saveLocalDataStore(store);

  const newAvatarUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  await syncWorkerAvatar(testWorkerId, newAvatarUrl);

  const freshStore = getLocalDataStore();
  const updatedWorker = freshStore.workers.find(w => w.id === testWorkerId);

  if (updatedWorker && updatedWorker.avatar === newAvatarUrl) {
    console.log("   ✅ PASS: Worker avatar updated synchronously across data stores.");
  } else {
    console.error("   ❌ FAIL: Worker avatar was not updated:", updatedWorker?.avatar);
    allPassed = false;
  }

  // 3. Clean up test worker
  freshStore.workers = freshStore.workers.filter(w => w.id !== testWorkerId);
  saveLocalDataStore(freshStore);

  // 4. Verify PWA Icons & Apple Touch Icon
  console.log("\n📱 [3/4] Verifying PWA & Apple Touch Icons on Disk...");
  const publicDir = path.join(process.cwd(), "public");
  const appleTouchIconPath = path.join(publicDir, "apple-touch-icon.png");
  const icon192Path = path.join(publicDir, "icon-192.png");
  const icon512Path = path.join(publicDir, "icon-512.png");
  const faviconPath = path.join(publicDir, "favicon.png");

  const iconsExist = fs.existsSync(appleTouchIconPath) && 
                     fs.existsSync(icon192Path) && 
                     fs.existsSync(icon512Path) && 
                     fs.existsSync(faviconPath);

  if (iconsExist) {
    const statApple = fs.statSync(appleTouchIconPath);
    const stat192 = fs.statSync(icon192Path);
    const stat512 = fs.statSync(icon512Path);
    console.log(`   ✅ PASS: All icons exist (apple-touch-icon: ${statApple.size}B, 192: ${stat192.size}B, 512: ${stat512.size}B).`);
  } else {
    console.error("   ❌ FAIL: Missing one or more icon files in public/.");
    allPassed = false;
  }

  // 5. Verify index.html and manifest.json references
  console.log("\n🔗 [4/4] Verifying HTML & Manifest Integration...");
  const indexHtml = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf-8");
  const manifestJson = fs.readFileSync(path.join(publicDir, "manifest.json"), "utf-8");

  const htmlHasAppleIcon = indexHtml.includes('rel="apple-touch-icon"') && indexHtml.includes('href="/apple-touch-icon.png"');
  const htmlHasFavicon = indexHtml.includes('href="/favicon.png"') || indexHtml.includes('href="/icon-192.png"');
  const manifestHasIcons = manifestJson.includes('/apple-touch-icon.png') && manifestJson.includes('/icon-192.png') && manifestJson.includes('/icon-512.png');

  if (htmlHasAppleIcon && htmlHasFavicon && manifestHasIcons) {
    console.log("   ✅ PASS: index.html and manifest.json correctly configure iOS and Android PWA icons.");
  } else {
    console.error("   ❌ FAIL: Icon references missing in HTML or Manifest:", {
      htmlHasAppleIcon,
      htmlHasFavicon,
      manifestHasIcons
    });
    allPassed = false;
  }

  console.log("\n==================================================");
  if (allPassed) {
    console.log("🎉 ALL BOSS FEEDBACK ISSUES RESOLVED & VERIFIED!");
  } else {
    console.error("⚠️ SOME CHECKS FAILED. PLEASE REVIEW.");
    process.exit(1);
  }
  console.log("==================================================");
}

testBossFixes().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
