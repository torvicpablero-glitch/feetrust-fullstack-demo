import { Pool } from "@neondatabase/serverless";

const NEW_DB_URL = "postgresql://neondb_owner:npg_xBlyYM41gbNC@ep-icy-star-au2bb5kk-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function main() {
  console.log("Testing connection to Feetrust-db...");
  const pool = new Pool({
    connectionString: NEW_DB_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
  });

  try {
    const res = await pool.query("SELECT current_database(), current_user, version();");
    console.log("Connected successfully:", res.rows[0]);

    // Check existing tables
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log("Tables present in new DB:", tables.rows.map(r => r.table_name));

    await pool.end();
  } catch (err) {
    console.error("Connection failed:", err);
    process.exit(1);
  }
}

main();
