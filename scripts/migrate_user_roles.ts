import { Pool } from "@neondatabase/serverless";
import { PRIMARY_CLEAN_DATABASE_URL, getUsersDb, saveUsersDb } from "../server/db";

async function runRoleMigration() {
  const isApply = process.argv.includes("--apply");
  console.log(`\n==================================================`);
  console.log(`  FEETRUST USER ROLE BACKFILL & RECONCILIATION   `);
  console.log(`  Mode: ${isApply ? "🚀 APPLY (Live Migration)" : "🔍 DRY RUN (Preview Only)"}`);
  console.log(`==================================================\n`);

  const pool = new Pool({ connectionString: PRIMARY_CLEAN_DATABASE_URL });

  try {
    // 1. Fetch current database state
    const { rows: users } = await pool.query("SELECT id, email, name, role FROM users");
    const { rows: businesses } = await pool.query("SELECT id, name, user_id FROM businesses");
    const { rows: workers } = await pool.query("SELECT id, name, workplace, role, user_id FROM workers");

    console.log(`📊 Current Counts:`);
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Businesses: ${businesses.length}`);
    console.log(`   - Workers: ${workers.length}\n`);

    const usersToUpgradeToBusiness: { id: string; email: string; currentRole: string; businessName: string }[] = [];
    const usersToUpgradeToWorker: { id: string; email: string; currentRole: string; workerName: string }[] = [];

    // Find business owners
    for (const b of businesses) {
      if (b.user_id) {
        const matchingUser = users.find((u) => u.id === b.user_id);
        if (matchingUser && matchingUser.role !== "Business" && matchingUser.role !== "Admin") {
          usersToUpgradeToBusiness.push({
            id: matchingUser.id,
            email: matchingUser.email,
            currentRole: matchingUser.role || "Customer",
            businessName: b.name,
          });
        }
      }
    }

    // Find workers
    for (const w of workers) {
      if (w.user_id) {
        const matchingUser = users.find((u) => u.id === w.user_id);
        if (matchingUser && matchingUser.role === "Customer") {
          // Only if not already in the business upgrade list
          if (!usersToUpgradeToBusiness.some((u) => u.id === matchingUser.id)) {
            usersToUpgradeToWorker.push({
              id: matchingUser.id,
              email: matchingUser.email,
              currentRole: matchingUser.role || "Customer",
              workerName: w.name,
            });
          }
        }
      }
    }

    console.log(`🎯 Identified Upgrades:`);
    console.log(`   - Users needing upgrade to Business: ${usersToUpgradeToBusiness.length}`);
    usersToUpgradeToBusiness.forEach((u) => {
      console.log(`     • ${u.email} (${u.id}): ${u.currentRole} -> Business (Store: "${u.businessName}")`);
    });

    console.log(`   - Users needing upgrade to Worker: ${usersToUpgradeToWorker.length}`);
    usersToUpgradeToWorker.forEach((u) => {
      console.log(`     • ${u.email} (${u.id}): ${u.currentRole} -> Worker (Worker Profile: "${u.workerName}")`);
    });

    if (isApply) {
      console.log("\n⚡ Applying updates to Neon Postgres...");
      const localDb = getUsersDb();

      for (const u of usersToUpgradeToBusiness) {
        await pool.query("UPDATE users SET role = 'Business' WHERE id = $1", [u.id]);
        if (localDb[u.id]) {
          localDb[u.id].role = "Business";
        }
      }

      for (const u of usersToUpgradeToWorker) {
        await pool.query("UPDATE users SET role = 'Worker' WHERE id = $1", [u.id]);
        if (localDb[u.id]) {
          localDb[u.id].role = "Worker";
        }
      }

      saveUsersDb(localDb);
      console.log("✅ Live database and local memory cache updated successfully!");
    } else {
      console.log("\n💡 Dry run complete. Run with `--apply` to commit these updates.");
    }
  } catch (err: any) {
    console.error("❌ Migration error:", err.message);
  } finally {
    await pool.end();
  }
}

runRoleMigration();
