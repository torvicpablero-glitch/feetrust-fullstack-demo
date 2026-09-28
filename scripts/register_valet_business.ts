import { Pool } from "@neondatabase/serverless";
import { getActiveDatabaseUrl, fetchBusinesses } from "../server/db";

async function main() {
  const url = getActiveDatabaseUrl();
  console.log("Connecting to:", url.split("@")[1]?.split("/")[0] || "database");
  const pool = new Pool({ connectionString: url });

  try {
    const businessRecord = {
      id: "biz_valet_kitchen_koctails",
      name: "VALET Kitchen + Koctails",
      category: "Restaurant & Bar",
      address: "339 North Dearborn Street, Chicago, Illinois",
      rating: 5.0,
      qr_code_url: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://www.feetrust.com/business/biz_valet_kitchen_koctails",
      lat: 41.8885135,
      lng: -87.6293075,
      plan: "Business",
      plan_price: "$499 USD / year",
      employee_limit: 15,
      avatar: null,
      user_id: null,
    };

    const res = await pool.query(
      `INSERT INTO businesses
         (id, name, category, address, rating, qr_code_url, lat, lng, plan, plan_price, employee_limit, avatar, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         category = EXCLUDED.category,
         address = EXCLUDED.address,
         rating = EXCLUDED.rating,
         lat = EXCLUDED.lat,
         lng = EXCLUDED.lng,
         plan = EXCLUDED.plan,
         plan_price = EXCLUDED.plan_price,
         employee_limit = EXCLUDED.employee_limit
       RETURNING *;`,
      [
        businessRecord.id,
        businessRecord.name,
        businessRecord.category,
        businessRecord.address,
        businessRecord.rating,
        businessRecord.qr_code_url,
        businessRecord.lat,
        businessRecord.lng,
        businessRecord.plan,
        businessRecord.plan_price,
        businessRecord.employee_limit,
        businessRecord.avatar,
        businessRecord.user_id,
      ]
    );

    console.log("Successfully registered VALET Kitchen + Koctails in database:");
    console.log(res.rows[0]);

    const all = await fetchBusinesses();
    console.log(`Total active businesses on server: ${all.length}`);
    const found = all.find(b => b.name.toLowerCase().includes("valet kitchen"));
    console.log("Found in fetchBusinesses:", found ? found.name : "NOT FOUND");
  } catch (err) {
    console.error("Failed to register business:", err);
  } finally {
    await pool.end();
  }
}

main();
