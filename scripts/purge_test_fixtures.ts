import fs from "fs";
import path from "path";

const dataFilePath = path.join(process.cwd(), "data.json");
const usersFilePath = path.join(process.cwd(), "users.json");

const data = JSON.parse(fs.readFileSync(dataFilePath, "utf8"));
data.workers = (data.workers || []).filter((w: any) => 
  !w.id?.startsWith("worker_organic_") && 
  !w.id?.startsWith("worker_invited_") && 
  !w.id?.startsWith("worker_sync_") && 
  !w.name?.includes("Test") && 
  !w.name?.includes("Sam Taylor") && 
  !w.name?.includes("Alex Rivera")
);

data.businesses = (data.businesses || []).filter((b: any) => 
  !b.id?.startsWith("biz_test_") && 
  !b.id?.startsWith("biz_sync_") && 
  !b.name?.includes("Apex Craft") && 
  !b.name?.includes("Sync Roasters")
);

data.reviews = (data.reviews || []).filter((r: any) => 
  !r.toUserId?.includes("test") && 
  !r.toUserId?.includes("sync")
);

data.activityFeed = (data.activityFeed || []).filter((a: any) => 
  !a.businessName?.includes("Apex Craft") && 
  !a.businessName?.includes("Sync Roasters")
);

fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));

const users = JSON.parse(fs.readFileSync(usersFilePath, "utf8"));
const cleanUsers: Record<string, any> = {};
for (const [k, v] of Object.entries(users as Record<string, any>)) {
  if (
    !v.email?.startsWith("test_") && 
    !v.email?.includes("hannibalvictor8") && 
    !v.name?.includes("Test") &&
    !v.name?.includes("Apex Craft")
  ) {
    cleanUsers[k] = v;
  }
}
fs.writeFileSync(usersFilePath, JSON.stringify(cleanUsers, null, 2));

console.log("SUCCESS: Purged test fixtures.");
console.log("Remaining Workers:", data.workers.map((w: any) => w.name));
console.log("Remaining Businesses:", data.businesses.map((b: any) => b.name));
