import { Pool } from "@neondatabase/serverless";
import { DEFAULT_WORKERS, DEFAULT_BUSINESSES, DEFAULT_ACTIVITY } from "../server/db";

const NEW_DB_URL = "postgresql://neondb_owner:npg_xBlyYM41gbNC@ep-icy-star-au2bb5kk-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function seedNewDatabase() {
  console.log("==================================================");
  console.log("INITIALIZING & SEEDING NEW NEON DATABASE (Feetrust-db)");
  console.log("==================================================");

  const pool = new Pool({
    connectionString: NEW_DB_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
  });

  try {
    console.log("1. Creating schema tables...");
    await pool.query(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      role TEXT,
      password_hash TEXT,
      avatar_url TEXT,
      level INTEGER,
      gems INTEGER,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY,
      name TEXT,
      position TEXT,
      category TEXT,
      workplace TEXT,
      level INTEGER,
      initials TEXT,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      role TEXT,
      is_available BOOLEAN,
      avatar TEXT,
      address TEXT,
      merits INTEGER,
      rating DOUBLE PRECISION,
      registered_via_invite BOOLEAN,
      invited_by_business_id TEXT,
      business_id TEXT,
      is_verified_staff BOOLEAN,
      roster_status TEXT DEFAULT 'active',
      user_id TEXT,
      status TEXT DEFAULT 'active'
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      name TEXT,
      category TEXT,
      address TEXT,
      rating DOUBLE PRECISION,
      qr_code_url TEXT,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      plan TEXT,
      plan_price TEXT,
      employee_limit INTEGER,
      avatar TEXT,
      user_id TEXT,
      status TEXT DEFAULT 'active',
      verified BOOLEAN DEFAULT false
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      from_user_id TEXT,
      from_user_name TEXT,
      to_user_id TEXT,
      merit_type TEXT,
      tip_amount INTEGER,
      review_text TEXT,
      business_name TEXT,
      hidden BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS activity_feed (
      id TEXT PRIMARY KEY,
      review_id TEXT,
      from_user_name TEXT,
      to_worker_name TEXT,
      business_name TEXT,
      merit_type TEXT,
      tip_amount INTEGER,
      time_ago TEXT,
      created_at TIMESTAMPTZ
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS thank_you_notes (
      id TEXT PRIMARY KEY,
      review_id TEXT,
      from_worker_name TEXT,
      to_user_name TEXT,
      message TEXT,
      created_at TIMESTAMPTZ
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS claimed_coupons (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      coupon_id TEXT,
      code TEXT,
      gems_awarded INTEGER,
      claimed_at TIMESTAMPTZ
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    )`);

    console.log("   ✅ Schema tables created successfully.");

    console.log("\n2. Seeding businesses...");
    for (const biz of DEFAULT_BUSINESSES) {
      await pool.query(
        `INSERT INTO businesses (
          id, name, category, address, rating, qr_code_url, lat, lng, plan, plan_price, employee_limit, verified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          address = EXCLUDED.address,
          plan = EXCLUDED.plan,
          plan_price = EXCLUDED.plan_price,
          employee_limit = EXCLUDED.employee_limit,
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng`,
        [
          biz.id,
          biz.name,
          biz.category,
          biz.address,
          biz.rating,
          biz.qrCodeUrl,
          biz.lat ?? null,
          biz.lng ?? null,
          biz.plan || "Business",
          biz.planPrice || "$499 USD / year",
          biz.employeeLimit || 15
        ]
      );
      console.log(`   🏢 Inserted/Updated business: ${biz.name} (${biz.employeeLimit} seats, plan: ${biz.plan})`);
    }

    console.log("\n3. Seeding workers...");
    for (const wk of DEFAULT_WORKERS) {
      const bId = wk.businessId || 
        (wk.workplace.includes("Luigi") ? "biz_jwjbmsk" :
         wk.workplace.includes("Smith") ? "biz_smith_wollensky" :
         wk.workplace.includes("Harry Caray") ? "biz_harry_caray" :
         wk.workplace.includes("Target") ? "biz_2" :
         wk.workplace.includes("Glamour") ? "biz_3" : null);

      await pool.query(
        `INSERT INTO workers (
          id, name, position, category, workplace, level, initials, lat, lng,
          role, is_available, merits, rating, business_id, is_verified_staff, roster_status, avatar
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          position = EXCLUDED.position,
          workplace = EXCLUDED.workplace,
          business_id = EXCLUDED.business_id,
          is_verified_staff = EXCLUDED.is_verified_staff,
          roster_status = EXCLUDED.roster_status`,
        [
          wk.id,
          wk.name,
          wk.position,
          wk.category || "Staff",
          wk.workplace,
          wk.level,
          wk.initials,
          wk.lat,
          wk.lng,
          wk.role,
          wk.isAvailable,
          wk.merits || 0,
          wk.rating || 5.0,
          bId,
          wk.isVerifiedStaff ?? true,
          wk.rosterStatus || "active",
          wk.avatar || null
        ]
      );
      console.log(`   👷 Inserted/Updated worker: ${wk.name} (${wk.workplace}) -> business_id: ${bId}`);
    }

    console.log("\n4. Seeding activity feed...");
    for (const act of DEFAULT_ACTIVITY) {
      await pool.query(
        `INSERT INTO activity_feed (
          id, from_user_name, to_worker_name, business_name, merit_type, tip_amount, time_ago, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (id) DO NOTHING`,
        [act.id, act.fromUserName, act.toWorkerName, act.businessName, act.meritType, act.tipAmount, act.timeAgo]
      );
    }

    // Set meta
    await pool.query("INSERT INTO app_meta (key, value) VALUES ('defaults_seeded', '1') ON CONFLICT (key) DO NOTHING");

    console.log("\n5. Verifying DB row counts...");
    const bCount = await pool.query("SELECT count(*)::int as c FROM businesses");
    const wCount = await pool.query("SELECT count(*)::int as c FROM workers");
    const aCount = await pool.query("SELECT count(*)::int as c FROM activity_feed");

    console.log(`   📊 Businesses in Feetrust-db: ${bCount.rows[0].c}`);
    console.log(`   📊 Workers in Feetrust-db:    ${wCount.rows[0].c}`);
    console.log(`   📊 Activities in Feetrust-db: ${aCount.rows[0].c}`);

    // Verify Luigi
    const luigi = await pool.query("SELECT * FROM businesses WHERE id = 'biz_jwjbmsk'");
    console.log("\n6. Luigi establishment check:");
    console.log(luigi.rows[0]);

    const luigiStaff = await pool.query("SELECT id, name, position, workplace, business_id FROM workers WHERE business_id = 'biz_jwjbmsk'");
    console.log("\n7. Luigi staff check:");
    console.log(luigiStaff.rows);

    await pool.end();
    console.log("\n🎉 ALL SEEDING AND INITIALIZATION COMPLETE!");
  } catch (err) {
    console.error("❌ Error during seeding:", err);
    process.exit(1);
  }
}

seedNewDatabase();
