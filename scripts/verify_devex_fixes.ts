import fs from "fs";
import path from "path";

async function verifyDeveXFixes() {
  console.log("==================================================");
  console.log("FEETRUST DEVEX PART B & C VERIFICATION SUITE");
  console.log("==================================================\n");

  let allPassed = true;

  // 1. Check SEO Assets
  console.log("🌐 [1/7] Verifying SEO Assets (robots.txt, sitemap.xml, canonical)...");
  const robotsPath = path.join(process.cwd(), "public/robots.txt");
  const sitemapPath = path.join(process.cwd(), "public/sitemap.xml");
  const indexPath = path.join(process.cwd(), "index.html");

  const robotsOk = fs.existsSync(robotsPath) && fs.readFileSync(robotsPath, "utf-8").includes("Sitemap: https://feetrust.com/sitemap.xml");
  const sitemapOk = fs.existsSync(sitemapPath) && fs.readFileSync(sitemapPath, "utf-8").includes("<loc>https://feetrust.com/</loc>");
  const indexContent = fs.readFileSync(indexPath, "utf-8");
  const canonicalOk = indexContent.includes('<link rel="canonical" href="https://feetrust.com/" />');

  if (robotsOk && sitemapOk && canonicalOk) {
    console.log("   ✅ PASS: robots.txt, sitemap.xml, and canonical meta tag verified.");
  } else {
    console.error("   ❌ FAIL: Missing or invalid SEO files:", { robotsOk, sitemapOk, canonicalOk });
    allPassed = false;
  }

  // 2. Check Viewport Accessibility
  console.log("\n📱 [2/7] Verifying Viewport Accessibility (WCAG 1.4.4)...");
  const userScalableRemoved = !indexContent.includes("user-scalable=no") && !indexContent.includes("maximum-scale=1.0");
  if (userScalableRemoved) {
    console.log("   ✅ PASS: Viewport allows user pinch-to-zoom (user-scalable=no removed).");
  } else {
    console.error("   ❌ FAIL: Viewport still contains hostile zoom-blocking attributes.");
    allPassed = false;
  }

  // 3. Check Default User Starting Stats
  console.log("\n👤 [3/7] Verifying New User Default Starting Stats...");
  const storeSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/store.tsx"), "utf-8");
  const cleanLevel = storeSrc.includes("level: 1");
  const cleanGems = storeSrc.includes("gems: 0");
  const cleanMeritsGiven = storeSrc.includes("meritsGiven: 0");
  const noInventedGems = !storeSrc.includes("gems: 150");
  const noInventedMerits = !storeSrc.includes("meritsGiven: 3");

  if (cleanLevel && cleanGems && cleanMeritsGiven && noInventedGems && noInventedMerits) {
    console.log("   ✅ PASS: New users seed with 0 gems and 0 merits given (no synthetic stats).");
  } else {
    console.error("   ❌ FAIL: Store still seeds invented starting stats.");
    allPassed = false;
  }

  // 4. Check Auth Rate Limiter
  console.log("\n🛡️ [4/7] Verifying Auth Rate Limit Protection for Shared IPs...");
  const securitySrc = fs.readFileSync(path.join(process.cwd(), "server/middleware/security.ts"), "utf-8");
  const tunedRateLimit = securitySrc.includes("max: 120");
  if (tunedRateLimit) {
    console.log("   ✅ PASS: Strict rate limiter tuned to max: 120 per 15 minutes (shared NAT safe).");
  } else {
    console.error("   ❌ FAIL: Rate limiter not tuned to 120.");
    allPassed = false;
  }

  // 5. Check Fabricated Metrics & Timestamps in Analytics Modal
  console.log("\n📊 [5/7] Verifying Elimination of Fabricated Metrics & Timestamps...");
  const modalSrc = fs.readFileSync(path.join(process.cwd(), "src/components/BusinessMeritsAnalyticsModal.tsx"), "utf-8");
  const noFakeTimestamp = !modalSrc.includes("Date.now() - (idx + 1) * 3600000 * 4");
  const noHardcodedHeaderBadge = !modalSrc.includes("+28% this month");
  const noHardcodedCard = !modalSrc.includes("+28% vs previous period");
  const noHardcodedSurge = !modalSrc.includes("● +28% Monthly Surge");
  const parsesCreatedAt = modalSrc.includes("item.createdAt ? new Date(item.createdAt) : new Date()");

  if (noFakeTimestamp && noHardcodedHeaderBadge && noHardcodedCard && noHardcodedSurge && parsesCreatedAt) {
    console.log("   ✅ PASS: All fabricated percentages (+28%) and synthetic timestamps purged.");
  } else {
    console.error("   ❌ FAIL: Fabricated metrics or synthetic timestamps still present in analytics modal.");
    allPassed = false;
  }

  // 6. Check Server-Side Staff Invites via Resend
  console.log("\n✉️ [6/7] Verifying Server-Side Staff Invites via Resend...");
  const businessRoutesSrc = fs.readFileSync(path.join(process.cwd(), "server/routes/businessRoutes.ts"), "utf-8");
  const inviteModalSrc = fs.readFileSync(path.join(process.cwd(), "src/components/BusinessInviteModal.tsx"), "utf-8");

  const hasInviteRoute = businessRoutesSrc.includes('businessRouter.post("/:id/invite"');
  const hasInviteEmailDispatch = businessRoutesSrc.includes("https://api.resend.com/emails") && businessRoutesSrc.includes("You've Been Invited!");
  const hasModalServerDispatch = inviteModalSrc.includes("/invite") && inviteModalSrc.includes("isSendingEmail");

  if (hasInviteRoute && hasInviteEmailDispatch && hasModalServerDispatch) {
    console.log("   ✅ PASS: Server-side staff invite API endpoint and frontend modal dispatch verified.");
  } else {
    console.error("   ❌ FAIL: Staff invite email routing or dispatch check failed.", {
      hasInviteRoute,
      hasInviteEmailDispatch,
      hasModalServerDispatch,
    });
    allPassed = false;
  }

  // 7. Check Landing Page Preservation & Hidden Public State
  console.log("\n🚀 [7/7] Verifying Landing Page Preservation & Hidden Routing...");
  const appSrc = fs.readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf-8");
  const hasLandingImport = appSrc.includes("import LandingPage from './pages/LandingPage'");
  const hasNotFoundImport = appSrc.includes("import NotFoundPage from './pages/NotFoundPage'");
  const hasCatchAllRoute = appSrc.includes('<Route path="*" element={<NotFoundPage />} />');
  const isHiddenFromPublic = !appSrc.includes('<Route path="/landing" element={<LandingPage />} />');
  const hasPreviewRoute = appSrc.includes('<Route path="/_preview-landing" element={<LandingPage />} />');
  const landingFileExists = fs.existsSync(path.join(process.cwd(), "src/pages/LandingPage.tsx"));
  const notFoundFileExists = fs.existsSync(path.join(process.cwd(), "src/pages/NotFoundPage.tsx"));

  if (hasLandingImport && hasNotFoundImport && hasCatchAllRoute && isHiddenFromPublic && hasPreviewRoute && landingFileExists && notFoundFileExists) {
    console.log("   ✅ PASS: Landing page code preserved, hidden from public routing, private preview available.");
  } else {
    console.error("   ❌ FAIL: Landing page preservation or routing check failed.", {
      hasLandingImport,
      hasNotFoundImport,
      hasCatchAllRoute,
      isHiddenFromPublic,
      hasPreviewRoute,
      landingFileExists,
      notFoundFileExists
    });
    allPassed = false;
  }

  console.log("\n==================================================");
  if (allPassed) {
    console.log("🎉 ALL DEVEX PART B & C VERIFICATION CHECKS PASSED!");
  } else {
    console.error("⚠️ SOME VERIFICATION CHECKS FAILED. PLEASE REVIEW.");
    process.exit(1);
  }
  console.log("==================================================");
}

verifyDeveXFixes().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
