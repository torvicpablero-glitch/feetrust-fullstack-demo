/**
 * Guards against pricing drift between the marketing landing page and the plan
 * definitions the product actually assigns at signup.
 *
 * The landing page copy lives in src/pages/LandingPage.tsx; the source of truth is
 * PRICING_PLANS in src/components/PricingPlansSelector.tsx. This test asserts that
 * every real plan's price and employee range is advertised, and that no plan is
 * advertised at a price the product does not offer.
 */
import fs from "fs";
import path from "path";
import { PRICING_PLANS } from "../src/components/PricingPlansSelector";

function run() {
  console.log("\n==================================================");
  console.log("  PRICING CONSISTENCY: landing page vs real plans");
  console.log("==================================================\n");

  const landingPath = path.join(process.cwd(), "src", "pages", "LandingPage.tsx");
  const landing = fs.readFileSync(landingPath, "utf-8");

  let failed = 0;

  // 1. Every real plan's price + employee range must appear on the landing page.
  for (const plan of PRICING_PLANS) {
    const price = plan.priceFormatted.replace(" USD", ""); // "$219 USD" -> "$219"
    const hasPrice = landing.includes(price);
    const hasRange = landing.includes(plan.employeeRange);
    const hasName = landing.includes(`'${plan.name}'`) || landing.includes(`"${plan.name}"`);

    if (hasPrice && hasRange && hasName) {
      console.log(`  ✅ ${plan.name}: ${price} / year · ${plan.employeeRange}`);
    } else {
      console.log(
        `  ❌ ${plan.name} missing from landing page` +
        ` (price=${hasPrice} range=${hasRange} name=${hasName})`
      );
      failed++;
    }
  }

  // 2. No price should be advertised that isn't a real plan price.
  //    Collect every "$NNN" token in the pricing tiers block.
  const tierBlockMatch = landing.match(/const PRICING_TIERS[\s\S]*?\n\];/);
  const advertised = tierBlockMatch
    ? Array.from(tierBlockMatch[0].matchAll(/\$(\d+)/g)).map((m) => Number(m[1]))
    : [];
  const real = PRICING_PLANS.map((p) => p.price);
  const phantom = advertised.filter((p) => !real.includes(p));
  if (phantom.length === 0) {
    console.log(`  ✅ no phantom prices advertised (found: ${advertised.join(", ") || "none"})`);
  } else {
    console.log(`  ❌ landing page advertises prices that are not real plans: ${phantom.join(", ")}`);
    failed++;
  }

  // 3. The app currently bills annually only — the page must not offer monthly.
  if (/priceMonthly|billingCycle/.test(landing)) {
    console.log("  ❌ landing page still offers a monthly billing option the product does not provide");
    failed++;
  } else {
    console.log("  ✅ no monthly billing implied");
  }

  console.log("\n==================================================");
  if (failed === 0) {
    console.log("🎉 PRICING CONSISTENCY VERIFIED");
    console.log("==================================================\n");
  } else {
    console.error(`⚠️  ${failed} pricing inconsistency(ies) found.`);
    console.error("==================================================\n");
    process.exit(1);
  }
}

try {
  run();
} catch (err) {
  console.error("Pricing consistency check failed to run:", err);
  process.exit(1);
}
