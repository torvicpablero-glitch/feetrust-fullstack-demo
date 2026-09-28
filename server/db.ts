import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Pool } from "@neondatabase/serverless";

// Load environment variables from .env.local or .env
dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

// ========================================================
// POSTGRES (Neon / Vercel) PERSISTENT CLIENT
// Reads the pooled connection string injected by the Neon Vercel integration.
// ========================================================
let _pool: Pool | null = null;

export const PRIMARY_CLEAN_DATABASE_URL =
  "postgresql://neondb_owner:npg_xBlyYM41gbNC@ep-icy-star-au2bb5kk-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

export function getActiveDatabaseUrl(): string {
  const candidate =
    process.env.POSTGRES_URL ||
    process.env.STORAGE_POSTGRES_URL ||
    process.env.STORAGE_URL ||
    process.env.DATABASE_URL ||
    process.env.DATABASE_POSTGRES_URL ||
    "";

  // If candidate is empty or points to the old quota-exhausted Neon project, route to clean Feetrust-db
  if (!candidate || candidate.includes("ep-little-sky-avm7mwqs") || candidate.includes("old-dawn-10580775")) {
    return PRIMARY_CLEAN_DATABASE_URL;
  }
  return candidate;
}

function getPool(): Pool | null {
  const url = getActiveDatabaseUrl();
  if (!url) return null;
  if (!_pool) {
    _pool = new Pool({
      connectionString: url,
      max: 10,
      connectionTimeoutMillis: 5000,
    });
  }
  return _pool;
}

async function ensureSchema(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT,
    password_hash TEXT,
    avatar_url TEXT,
    level INTEGER,
    gems INTEGER,
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
    is_verified_staff BOOLEAN
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
    user_id TEXT
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

  // Moderation columns (idempotent migrations)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'paid'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS has_paid BOOLEAN DEFAULT true`);
  await pool.query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`);
  await pool.query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'paid'`);
  await pool.query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS has_paid BOOLEAN DEFAULT true`);
  await pool.query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_email TEXT`);
  await pool.query(`ALTER TABLE workers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`);
  await pool.query(`ALTER TABLE workers ADD COLUMN IF NOT EXISTS roster_status TEXT DEFAULT 'active'`);
  await pool.query(`ALTER TABLE workers ADD COLUMN IF NOT EXISTS user_id TEXT`);
  await pool.query(`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT false`);

  await pool.query(`CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);

  // Restore the demo catalogue when the database is genuinely blank.
  // A one-time "already seeded" flag is unsafe here: if it is ever set while the
  // tables are empty (a cold start against an empty database), the app is left
  // with no data at all and no way to recover. Seeding is idempotent via
  // ON CONFLICT DO NOTHING, so running it whenever the tables are empty is safe —
  // and deleting individual rows still sticks, because this only fires when BOTH
  // tables are empty (never after a partial delete).
  const w = await pool.query("SELECT count(*)::int AS c FROM workers");
  const b = await pool.query("SELECT count(*)::int AS c FROM businesses");

  if (w.rows[0].c === 0 && b.rows[0].c === 0) {
    for (const wk of DEFAULT_WORKERS) {
      await pool.query(
        `INSERT INTO workers (id,name,position,category,workplace,level,initials,lat,lng,role,is_available,merits,rating,business_id,is_verified_staff,roster_status,avatar)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) ON CONFLICT (id) DO NOTHING`,
        [wk.id, wk.name, wk.position, wk.category || "Staff", wk.workplace, wk.level, wk.initials, wk.lat, wk.lng, wk.role, wk.isAvailable, wk.merits || 0, wk.rating || 5.0, wk.businessId || null, wk.isVerifiedStaff ?? true, wk.rosterStatus || 'active', wk.avatar || null]
      );
    }
    for (const biz of DEFAULT_BUSINESSES) {
      await pool.query(
        `INSERT INTO businesses (id,name,category,address,rating,qr_code_url,lat,lng,plan,plan_price,employee_limit,verified)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
        [biz.id, biz.name, biz.category, biz.address, biz.rating, biz.qrCodeUrl, biz.lat ?? null, biz.lng ?? null, biz.plan || "Starter", biz.planPrice || "$5 USD / year", biz.employeeLimit || 4, true]
      );
    }
    console.log("[PG] Seeded default establishments and staff into an empty database.");
  }

  await pool.query("INSERT INTO app_meta (key, value) VALUES ('defaults_seeded', '1') ON CONFLICT (key) DO NOTHING");

  // One-time data cleanup: remove rows created by earlier automated QA runs that
  // are still sitting in this database. Ids are matched exactly, never by prefix,
  // so real customer data can never be caught by this.
  const cleaned = await pool.query("SELECT value FROM app_meta WHERE key = 'qa_fixture_cleanup_v1'");
  if (cleaned.rows.length === 0) {
    await pool.query(
      `DELETE FROM businesses WHERE id = ANY($1::text[])`,
      [["biz_rt_1789043180"]]
    );
    await pool.query(
      `DELETE FROM workers WHERE name = ANY($1::text[]) AND id NOT IN ('worker_2','worker_3','worker_5')`,
      [["Wk Probe", "Sync Worker Probe", "Test User"]]
    );
    await pool.query("INSERT INTO app_meta (key, value) VALUES ('qa_fixture_cleanup_v1', '1') ON CONFLICT (key) DO NOTHING");
    console.log("[PG] Removed leftover QA fixture rows.");
  }
}

// Warm the schema once on module load (best-effort; never crash the server on a DB outage).
// NOTE: invoked AFTER seed constants are declared below to avoid TDZ errors.


function mapWorkerRow(r: any): WorkerProfile {
  return {
    id: r.id,
    name: r.name,
    position: r.position || "Staff",
    category: r.category || "Staff",
    workplace: r.workplace || "",
    level: Number(r.level || 1),
    initials: r.initials || (r.name ? r.name.substring(0, 2).toUpperCase() : "WK"),
    lat: r.lat != null ? Number(r.lat) : 41.8781,
    lng: r.lng != null ? Number(r.lng) : -87.6298,
    role: r.role || "Worker",
    isAvailable: r.is_available == null ? true : !!r.is_available,
    avatar: r.avatar || undefined,
    address: r.address || undefined,
    merits: Number(r.merits || 0),
    rating: r.rating != null ? Number(r.rating) : 5.0,
    registeredViaInvite: !!r.registered_via_invite,
    invitedByBusinessId: r.invited_by_business_id || undefined,
    businessId: r.business_id || undefined,
    isVerifiedStaff: !!r.is_verified_staff,
    rosterStatus: (r.roster_status === 'pending' ? 'pending' : 'active') as 'pending' | 'active',
    user_id: r.user_id || undefined,
  };
}

function mapBusinessRow(r: any): BusinessProfile {
  return {
    id: r.id,
    name: r.name,
    category: r.category || "Business",
    address: r.address || "Chicago, IL",
    rating: r.rating != null ? Number(r.rating) : 5.0,
    qrCodeUrl: r.qr_code_url || "",
    lat: r.lat != null ? Number(r.lat) : undefined,
    lng: r.lng != null ? Number(r.lng) : undefined,
    location: r.lat != null && r.lng != null ? { lat: Number(r.lat), lng: Number(r.lng) } : undefined,
    plan: r.plan || "Starter",
    planPrice: r.plan_price || "$5 USD / year",
    employeeLimit: Number(r.employee_limit || 4),
    avatar: r.avatar || undefined,
    user_id: r.user_id || undefined,
    ownerEmail: r.owner_email || undefined,
    hasPaid: r.has_paid != null ? Boolean(r.has_paid) : true,
    paymentStatus: (r.payment_status || 'paid') as 'paid' | 'pending' | 'cancelled',
    workers: [],
  };
}

function mapReviewRow(r: any): ReviewItem {
  return {
    id: r.id,
    fromUserId: r.from_user_id || "",
    fromUserName: r.from_user_name || "Customer",
    toUserId: r.to_user_id || "",
    meritType: r.merit_type || "Good",
    tipAmount: Number(r.tip_amount || 0),
    reviewText: r.review_text || undefined,
    businessName: r.business_name || undefined,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  };
}

function mapActivityRow(r: any): ActivityFeedItem {
  return {
    id: r.id,
    reviewId: r.review_id || undefined,
    fromUserName: r.from_user_name || "Customer",
    toWorkerName: r.to_worker_name || "Team Member",
    businessName: r.business_name || "FeeTrust Establishment",
    meritType: r.merit_type || "Good",
    tipAmount: Number(r.tip_amount || 0),
    timeAgo: r.time_ago || "Recently",
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
  };
}

function mapThankYouRow(r: any): ThankYouNoteItem {
  return {
    id: r.id,
    reviewId: r.review_id || "",
    fromWorkerName: r.from_worker_name || "Worker",
    toUserName: r.to_user_name || "Customer",
    message: r.message || "",
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  };
}

function mapCouponRow(r: any): ClaimedCouponItem {
  return {
    id: r.id,
    userId: r.user_id || "",
    couponId: r.coupon_id || "",
    code: r.code || "",
    gemsAwarded: Number(r.gems_awarded || 0),
    claimedAt: r.claimed_at ? new Date(r.claimed_at).toISOString() : new Date().toISOString(),
  };
}

/**
 * Loads all businesses/workers from Postgres into the local read cache so the app
 * serves the durable truth (not just the two static seed rows) on every cold start.
 */
async function hydrateLocalFromDb(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    const [wRes, bRes, rRes, aRes, tRes, cRes] = await Promise.all([
      pool.query("SELECT * FROM workers"),
      pool.query("SELECT * FROM businesses"),
      pool.query("SELECT * FROM reviews ORDER BY created_at DESC NULLS LAST LIMIT 200"),
      pool.query("SELECT * FROM activity_feed ORDER BY created_at DESC NULLS LAST LIMIT 200"),
      pool.query("SELECT * FROM thank_you_notes ORDER BY created_at DESC NULLS LAST LIMIT 200"),
      pool.query("SELECT * FROM claimed_coupons ORDER BY claimed_at DESC NULLS LAST LIMIT 200"),
    ]);
    const store = getLocalDataStore();
    store.workers = wRes.rows.map(mapWorkerRow);
    store.businesses = bRes.rows.map(mapBusinessRow);
    if (rRes.rows.length) store.reviews = rRes.rows.map(mapReviewRow);
    if (aRes.rows.length) store.activityFeed = aRes.rows.map(mapActivityRow);
    store.thankYouNotes = tRes.rows.map(mapThankYouRow);
    store.claimedCoupons = cRes.rows.map(mapCouponRow);
    saveLocalDataStore(store);
  } catch (err) {
    console.error(
      "[PG] hydrateLocalFromDb FAILED — serving empty in-memory store rather than stale local JSON.",
      err
    );
  }
}


// Types
export interface WorkerProfile {
  id: string;
  name: string;
  position: string;
  category?: string;
  workplace?: string;
  level: number;
  initials: string;
  lat: number;
  lng: number;
  role: string;
  isAvailable: boolean;
  avatar?: string;
  address?: string;
  merits?: number;
  meritsReceived?: number;
  rating?: number;
  registeredViaInvite?: boolean;
  invitedByBusinessId?: string;
  businessId?: string;
  isVerifiedStaff?: boolean;
  rosterStatus?: 'pending' | 'active';
  user_id?: string;
}

export interface BusinessProfile {
  id: string;
  name: string;
  category: string;
  address: string;
  rating: number;
  qrCodeUrl: string;
  avatar?: string;
  user_id?: string;
  ownerEmail?: string;
  hasPaid?: boolean;
  paymentStatus?: 'paid' | 'pending' | 'cancelled';
  lat?: number;
  lng?: number;
  location?: { lat: number; lng: number };
  plan?: string;
  planPrice?: string;
  employeeLimit?: number;
  workers?: WorkerProfile[];
}

export interface ReviewItem {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  meritType: string;
  tipAmount: number;
  reviewText?: string;
  businessName?: string;
  createdAt: string;
}

export interface ActivityFeedItem {
  id: string;
  fromUserName: string;
  toWorkerName: string;
  businessName: string;
  meritType: string;
  tipAmount: number;
  timeAgo: string;
  reviewId?: string;
  createdAt?: string;
}

export interface ThankYouNoteItem {
  id: string;
  reviewId: string;
  fromWorkerName: string;
  toUserName: string;
  message: string;
  createdAt: string;
}

export interface ClaimedCouponItem {
  id: string;
  userId: string;
  couponId: string;
  code: string;
  gemsAwarded: number;
  claimedAt: string;
}

// Initial Data Seeds
// Seed workers are pinned to their workplace's real geocoded coordinates so a
// worker's map pin lands on the establishment, not near it.
export const DEFAULT_WORKERS: WorkerProfile[] = [
  { 
    id: 'worker_m8qn5xe', 
    name: 'Julio M', 
    position: 'Runner / Doorman', 
    category: 'Valet', 
    workplace: 'Valet Parking Luigi', 
    businessId: 'biz_jwjbmsk',
    level: 1, 
    initials: 'JM', 
    lat: 41.8893, 
    lng: -87.6277, 
    role: 'Worker', 
    isAvailable: true,
    isVerifiedStaff: true,
    rosterStatus: 'active'
  },
  { 
    id: 'worker_jacob_valet', 
    name: 'Jacob', 
    position: 'Valet Attendant', 
    category: 'Valet', 
    workplace: 'Valet Parking Luigi', 
    businessId: 'biz_jwjbmsk',
    level: 1, 
    initials: 'J', 
    lat: 41.8893, 
    lng: -87.6277, 
    role: 'Worker', 
    isAvailable: true,
    isVerifiedStaff: true,
    rosterStatus: 'active'
  },
  { 
    id: 'worker_sw_staff', 
    name: 'Marcus Vance', 
    position: 'Lead Valet & Host', 
    category: 'Valet', 
    workplace: 'Smith & Wollensky', 
    businessId: 'biz_smith_wollensky',
    level: 2, 
    initials: 'MV', 
    lat: 41.8885, 
    lng: -87.6281, 
    role: 'Worker', 
    isAvailable: true,
    isVerifiedStaff: true,
    rosterStatus: 'active'
  },
  { 
    id: 'worker_hc_staff', 
    name: 'Leo Santana', 
    position: 'Valet Supervisor', 
    category: 'Valet', 
    workplace: "Harry Caray's", 
    businessId: 'biz_harry_caray',
    level: 2, 
    initials: 'LS', 
    lat: 41.8891, 
    lng: -87.6293, 
    role: 'Worker', 
    isAvailable: true,
    isVerifiedStaff: true,
    rosterStatus: 'active'
  },
  { id: 'worker_2', name: 'Jordan Chen', position: 'Customer Support Lead', category: 'Support', workplace: 'Target Metro Hub', businessId: 'biz_2', level: 7, initials: 'JC', lat: 41.8814632, lng: -87.6272684, role: 'Worker', isAvailable: true },
  { id: 'worker_3', name: 'Taylor Swift', position: 'Service Specialist', category: 'Waiters', workplace: 'Marriott Downtown', level: 9, initials: 'TS', lat: 41.8921, lng: -87.6240, role: 'Worker', isAvailable: true },
  { id: 'worker_5', name: 'Elena Rostova', position: 'Senior Hair Stylist', category: 'Stylists', workplace: 'Glamour Salon & Spa', businessId: 'biz_3', level: 8, initials: 'ER', lat: 41.8920926, lng: -87.6248689, role: 'Worker', isAvailable: true }
];

// Coordinates are the real geocoded locations of the listed street addresses.
// (Never invent fallback positions — a wrong pin on the map is worse than no pin.)
export const DEFAULT_BUSINESSES: BusinessProfile[] = [
  {
    id: 'biz_jwjbmsk',
    name: 'Valet Parking Luigi',
    category: 'Valet parking',
    address: '33 East Kinzie Street, Chicago, Illinois',
    rating: 5.0,
    lat: 41.8893,
    lng: -87.6277,
    location: { lat: 41.8893, lng: -87.6277 },
    plan: 'Business',
    planPrice: '$499 USD / year',
    employeeLimit: 15,
    qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://www.feetrust.com/business/biz_jwjbmsk',
    workers: [
      { id: 'worker_m8qn5xe', name: 'Julio M', position: 'Runner / Doorman', workplace: 'Valet Parking Luigi', level: 1, initials: 'JM', lat: 41.8893, lng: -87.6277, role: 'Worker', isAvailable: true, isVerifiedStaff: true, rosterStatus: 'active' },
      { id: 'worker_jacob_valet', name: 'Jacob', position: 'Valet Attendant', workplace: 'Valet Parking Luigi', level: 1, initials: 'J', lat: 41.8893, lng: -87.6277, role: 'Worker', isAvailable: true, isVerifiedStaff: true, rosterStatus: 'active' }
    ]
  },
  {
    id: 'biz_smith_wollensky',
    name: 'Smith & Wollensky',
    category: 'Steakhouse & Fine Dining',
    address: '318 N State St, Chicago, IL 60654',
    rating: 4.9,
    lat: 41.8885,
    lng: -87.6281,
    location: { lat: 41.8885, lng: -87.6281 },
    plan: 'Business',
    planPrice: '$499 USD / year',
    employeeLimit: 15,
    qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://www.feetrust.com/business/biz_smith_wollensky',
    workers: [
      { id: 'worker_sw_staff', name: 'Marcus Vance', position: 'Lead Valet & Host', workplace: 'Smith & Wollensky', level: 2, initials: 'MV', lat: 41.8885, lng: -87.6281, role: 'Worker', isAvailable: true, isVerifiedStaff: true, rosterStatus: 'active' }
    ]
  },
  {
    id: 'biz_harry_caray',
    name: "Harry Caray's",
    category: 'Italian Steakhouse',
    address: '33 W Kinzie St, Chicago, IL 60654',
    rating: 4.8,
    lat: 41.8891,
    lng: -87.6293,
    location: { lat: 41.8891, lng: -87.6293 },
    plan: 'Business',
    planPrice: '$499 USD / year',
    employeeLimit: 15,
    qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://www.feetrust.com/business/biz_harry_caray',
    workers: [
      { id: 'worker_hc_staff', name: 'Leo Santana', position: 'Valet Supervisor', workplace: "Harry Caray's", level: 2, initials: 'LS', lat: 41.8891, lng: -87.6293, role: 'Worker', isAvailable: true, isVerifiedStaff: true, rosterStatus: 'active' }
    ]
  },
  { id: 'biz_2', name: 'Target Metro Hub', category: 'Retail & Grocery', address: '1 S State St, Chicago, IL', rating: 4.8, lat: 41.8814632, lng: -87.6272684, location: { lat: 41.8814632, lng: -87.6272684 }, qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://www.feetrust.com/business/biz_2' },
  { id: 'biz_3', name: 'Glamour Salon & Spa', category: 'Personal Care & Beauty', address: '540 N Michigan Ave, Chicago, IL', rating: 5.0, lat: 41.8920926, lng: -87.6248689, location: { lat: 41.8920926, lng: -87.6248689 }, qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://www.feetrust.com/business/biz_3' },
  {
    id: 'biz_valet_kitchen_koctails',
    name: 'VALET Kitchen + Koctails',
    category: 'Restaurant & Bar',
    address: '339 North Dearborn Street, Chicago, Illinois',
    rating: 5.0,
    lat: 41.8885135,
    lng: -87.6293075,
    location: { lat: 41.8885135, lng: -87.6293075 },
    plan: 'Business',
    planPrice: '$499 USD / year',
    employeeLimit: 15,
    qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://www.feetrust.com/business/biz_valet_kitchen_koctails',
    workers: []
  }
];

// Create the Postgres schema (and seed defaults on first boot), then hydrate the local
// read cache from the durable store so cold starts see everything persisted in Postgres.
// Best-effort — never crashes the server on a DB outage (falls back to local JSON).
let schemaReady: Promise<void> = (async () => {
  await ensureSchema();
  await hydrateLocalFromDb();
})().catch((err) => console.warn("[PG] schema/hydrate notice:", err));

export function whenSchemaReady(): Promise<void> {
  return schemaReady;
}

export const DEFAULT_ACTIVITY: ActivityFeedItem[] = [
  { id: 'act_2', fromUserName: 'Sarah K.', toWorkerName: 'Jordan Chen', businessName: 'Target Metro Hub', meritType: 'Legend', tipAmount: 10, timeAgo: '8m ago' },
  { id: 'act_3', fromUserName: 'David R.', toWorkerName: 'Elena Rostova', businessName: 'Glamour Salon & Spa', meritType: 'Excellent', tipAmount: 15, timeAgo: '15m ago' }
];

// Local JSON Storage Paths (/tmp is writable in Vercel Serverless environment)
const STORAGE_DIR = process.env.VERCEL ? "/tmp" : process.cwd();
const USERS_FILE = path.join(STORAGE_DIR, "users.json");
const DATA_FILE = path.join(STORAGE_DIR, "data.json");
const ROOT_USERS_FILE = path.join(process.cwd(), "users.json");
const ROOT_DATA_FILE = path.join(process.cwd(), "data.json");

/**
 * When a durable database is configured it is the single source of truth.
 * The local JSON files then act purely as an in-process read cache and must never
 * be seeded from repository files (which historically shipped stale seed rows and
 * local test artifacts straight into production).
 */
function isDbConfigured(): boolean {
  return Boolean(getActiveDatabaseUrl());
}

// In-Memory Runtime Store Cache
let memoryDataStore: {
  workers: WorkerProfile[];
  businesses: BusinessProfile[];
  reviews: ReviewItem[];
  activityFeed: ActivityFeedItem[];
  thankYouNotes: ThankYouNoteItem[];
  claimedCoupons: ClaimedCouponItem[];
} | null = null;

let memoryUsersDb: Record<string, any> | null = null;

function ensureStorageFilesExist() {
  try {
    const dbMode = isDbConfigured();
    if (!fs.existsSync(USERS_FILE)) {
      // With a database configured, never inherit repository users.json.
      if (!dbMode && fs.existsSync(ROOT_USERS_FILE)) {
        fs.copyFileSync(ROOT_USERS_FILE, USERS_FILE);
      } else {
        fs.writeFileSync(USERS_FILE, JSON.stringify({}, null, 2));
      }
    }
    if (!fs.existsSync(DATA_FILE)) {
      if (!dbMode && fs.existsSync(ROOT_DATA_FILE)) {
        fs.copyFileSync(ROOT_DATA_FILE, DATA_FILE);
      } else {
        const initialData = {
          workers: DEFAULT_WORKERS,
          businesses: DEFAULT_BUSINESSES,
          reviews: [],
          activityFeed: DEFAULT_ACTIVITY,
          thankYouNotes: [],
          claimedCoupons: [],
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
      }
    }
  } catch (err) {
    console.warn("Storage files init notice:", err);
  }
}

ensureStorageFilesExist();

export function getLocalDataStore(): {
  workers: WorkerProfile[];
  businesses: BusinessProfile[];
  reviews: ReviewItem[];
  activityFeed: ActivityFeedItem[];
  thankYouNotes: ThankYouNoteItem[];
  claimedCoupons: ClaimedCouponItem[];
} {
  if (memoryDataStore) {
    return memoryDataStore;
  }

  ensureStorageFilesExist();
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(content);
      
      // Deduplicate reviews by ID
      const seenReviewIds = new Set<string>();
      const dedupedReviews: ReviewItem[] = [];
      for (const r of (parsed.reviews || [])) {
        if (r && r.id && !seenReviewIds.has(r.id)) {
          seenReviewIds.add(r.id);
          dedupedReviews.push(r);
        }
      }

      // Deduplicate activity feed by ID
      const seenActivityIds = new Set<string>();
      const dedupedActivity: ActivityFeedItem[] = [];
      for (const a of (parsed.activityFeed || [])) {
        if (a && a.id && !seenActivityIds.has(a.id)) {
          seenActivityIds.add(a.id);
          dedupedActivity.push(a);
        }
      }

      memoryDataStore = {
        workers: (parsed.workers && parsed.workers.length > 0) ? parsed.workers : DEFAULT_WORKERS,
        businesses: (parsed.businesses && parsed.businesses.length > 0) ? parsed.businesses : DEFAULT_BUSINESSES,
        reviews: dedupedReviews,
        activityFeed: dedupedActivity.length > 0 ? dedupedActivity : DEFAULT_ACTIVITY,
        thankYouNotes: parsed.thankYouNotes || [],
        claimedCoupons: parsed.claimedCoupons || [],
      };
      return memoryDataStore;
    }
  } catch {
    // Fallback
  }

  memoryDataStore = {
    workers: DEFAULT_WORKERS,
    businesses: DEFAULT_BUSINESSES,
    reviews: [],
    activityFeed: DEFAULT_ACTIVITY,
    thankYouNotes: [],
    claimedCoupons: [],
  };
  return memoryDataStore;
}

export function saveLocalDataStore(data: any) {
  memoryDataStore = data;
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.warn("Data store save skipped:", err);
  }
}

// User Accounts Storage
export function getUsersDb(): Record<string, any> {
  if (memoryUsersDb) return memoryUsersDb;
  ensureStorageFilesExist();
  try {
    if (fs.existsSync(USERS_FILE)) {
      memoryUsersDb = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
      return memoryUsersDb || {};
    }
  } catch {
    return {};
  }
  return {};
}

export function saveUsersDb(db: Record<string, any>) {
  memoryUsersDb = db;
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(db, null, 2));
  } catch (err) {
    console.warn("Users DB save skipped:", err);
  }
}

// ========================================================
// DATABASE OPERATIONS LAYER (POSTGRES WITH LOCAL FALLBACK)
// ========================================================

/**
 * Actively checks database connectivity.
 * Used by /api/health to truthfully report database status.
 */
export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  provider: "postgres" | "local";
  latencyMs?: number;
  error?: string;
}> {
  const pool = getPool();
  if (!pool) {
    return {
      connected: false,
      provider: "local",
      error: "DATABASE_URL not configured.",
    };
  }

  const start = Date.now();
  try {
    await Promise.race([
      pool.query("SELECT 1"),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Database probe timed out after 3000ms")), 3000)
      ),
    ]);
    return {
      connected: true,
      provider: "postgres",
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      connected: false,
      provider: "postgres",
      latencyMs: Date.now() - start,
      error: err.message || String(err),
    };
  }
}

/**
 * Looks up a user account by email from persistent storage (Postgres / local store).
 */
export async function findUserByEmail(email: string): Promise<any | null> {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail) return null;

  // 1. Query Postgres if configured (durable source of truth)
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query(
        `SELECT id,name,email,role,password_hash,avatar_url,level,gems,created_at,status
         FROM users WHERE email = $1 LIMIT 1`,
        [cleanEmail]
      );
      if (rows.length) {
        const r = rows[0];
        const userObj = {
          uid: r.id,
          name: r.name,
          email: r.email,
          role: r.role,
          passwordHash: r.password_hash,
          avatar: r.avatar_url,
          level: r.level,
          gems: r.gems,
          status: r.status || "active",
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
        };
        // Synchronize in local memory cache
        const local = getUsersDb();
        local[userObj.uid] = userObj;
        memoryUsersDb = local;
        return userObj;
      }
    } catch (err) {
      console.warn("[PG] findUserByEmail query notice:", err);
    }
  }

  // 2. Query local store (fallback cache)
  const localDb = getUsersDb();
  const found = Object.values(localDb).find((u: any) => u?.email && u.email.trim().toLowerCase() === cleanEmail);
  return found || null;
}

/**
 * Looks up a user account by uid from persistent storage (Postgres / local store).
 */
export async function findUserById(uid: string): Promise<any | null> {
  const cleanUid = (uid || "").trim();
  if (!cleanUid) return null;

  // 1. Check local memory cache first
  const localDb = getUsersDb();
  if (localDb[cleanUid]) {
    return localDb[cleanUid];
  }

  // 2. Query Postgres if configured (durable source of truth)
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query(
        `SELECT id,name,email,role,password_hash,avatar_url,level,gems,created_at,status
         FROM users WHERE id = $1 LIMIT 1`,
        [cleanUid]
      );
      if (rows.length) {
        const r = rows[0];
        const userObj = {
          uid: r.id,
          name: r.name,
          email: r.email,
          role: r.role,
          passwordHash: r.password_hash,
          avatar: r.avatar_url,
          level: r.level,
          gems: r.gems,
          status: r.status || "active",
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
        };
        localDb[userObj.uid] = userObj;
        memoryUsersDb = localDb;
        return userObj;
      }
    } catch (err) {
      console.warn("[PG] findUserById query notice:", err);
    }
  }

  return null;
}

/**
 * Creates or updates a user account in persistent storage (Postgres / local store).
 */
export async function createOrUpdateUserInDb(user: any): Promise<void> {
  if (!user || !user.email) return;
  const cleanEmail = user.email.trim().toLowerCase();
  const uid = user.uid || ("usr_" + crypto.randomBytes(6).toString("hex"));

  // Normalise before writing so the local store and the database agree:
  // a new account is level 1 with 0 gems, and an omitted value never resets an
  // existing account's progress.
  const localDb = getUsersDb();
  const existingLocal = localDb[uid] || Object.values(localDb).find((u: any) => u?.email && u.email.trim().toLowerCase() === cleanEmail);
  const normalized = {
    ...existingLocal,
    ...user,
    uid: existingLocal?.uid || uid,
    email: cleanEmail,
    role: user.role || existingLocal?.role || "Customer",
    passwordHash: user.passwordHash || existingLocal?.passwordHash || "",
    level: typeof user.level === "number" ? user.level : (existingLocal?.level ?? 1),
    gems: typeof user.gems === "number" ? user.gems : (existingLocal?.gems ?? 0),
  };

  // 1. Sync to local memory and storage
  localDb[uid] = normalized;
  saveUsersDb(localDb);

  // 2. Persist to Postgres if configured (one uid per email — on conflict keep existing id)
  const pool = getPool();
  if (pool) {
    try {
      // A new account starts with 0 gems and level 1 — the old `|| 150` default
      // invented a starting balance that the UI never showed, so a returning user
      // would "gain" 150 gems (or have a real balance clobbered) on every profile
      // upsert. Only write these columns when the caller actually supplied them.
      const gemsProvided = typeof user.gems === "number";
      const levelProvided = typeof user.level === "number";
      await pool.query(
        `INSERT INTO users (id,email,name,role,password_hash,avatar_url,level,gems,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (email) DO UPDATE SET
           name = COALESCE(NULLIF(EXCLUDED.name, ''), users.name),
           role = CASE WHEN EXCLUDED.role IS NOT NULL AND EXCLUDED.role <> '' THEN EXCLUDED.role ELSE users.role END,
           password_hash = CASE WHEN EXCLUDED.password_hash IS NOT NULL AND EXCLUDED.password_hash <> '' THEN EXCLUDED.password_hash ELSE users.password_hash END,
           avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url, ''), users.avatar_url),
           level = CASE WHEN $11::boolean THEN EXCLUDED.level ELSE users.level END,
           gems  = CASE WHEN $10::boolean THEN EXCLUDED.gems  ELSE users.gems  END`,
        [
          uid,
          cleanEmail,
          user.name || cleanEmail.split("@")[0],
          user.role || "Customer",
          user.passwordHash || "",
          user.avatar || user.photoURL || null,
          levelProvided ? Number(user.level) : 1,
          gemsProvided ? Number(user.gems) : 0,
          user.createdAt || new Date().toISOString(),
          gemsProvided,
          levelProvided,
        ]
      );
    } catch (err) {
      console.warn("[PG] createOrUpdateUserInDb upsert notice:", err);
    }
  }
}

// ========================================================
// AUTHORIZATION HELPERS
// ========================================================

export function isAdminRole(role?: string): boolean {
  return (role || "").toLowerCase() === "admin";
}

/** True if the given user owns (or administers) the worker record. */
export async function userOwnsWorker(
  uid: string | undefined,
  userName: string | undefined,
  workerId: string
): Promise<boolean> {
  if (!uid && !userName) return false;
  const worker: any = await fetchWorkerById(workerId);
  if (!worker) return false;
  if (uid && worker.user_id && String(worker.user_id) === String(uid)) return true;
  if (uid && worker.id === uid) return true;
  if (userName && worker.name && worker.name.trim().toLowerCase() === userName.trim().toLowerCase()) return true;
  return false;
}

/** True if the given user owns (or administers) the business record. */
export async function userOwnsBusiness(
  uid: string | undefined,
  userName: string | undefined,
  bizId?: string,
  bizName?: string
): Promise<boolean> {
  const businesses = await fetchBusinesses();
  const biz = businesses.find(
    b =>
      (bizId && b.id === bizId) ||
      (bizName && b.name && b.name.trim().toLowerCase() === bizName.trim().toLowerCase())
  );
  if (!biz) return false;
  const payload = biz as any;
  if (uid && (payload.user_id === uid || payload.userId === uid)) return true;
  if (userName && biz.name && biz.name.trim().toLowerCase() === userName.trim().toLowerCase()) return true;
  return false;
}

// 1. WORKERS
export async function fetchWorkers(): Promise<WorkerProfile[]> {
  // Read straight from the database on every call. A once-per-instance cache means
  // two warm instances (or a cold start) can serve different worlds — the classic
  // "I saved it but the other side doesn't see it" symptom.
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query("SELECT * FROM workers ORDER BY name ASC");
      const workers = rows.map(mapWorkerRow);
      // Merge with DEFAULT_WORKERS so essential staff are never missing if DB is partially populated
      const combinedWorkers = [...workers];
      for (const dw of DEFAULT_WORKERS) {
        if (!combinedWorkers.some(cw => cw.id === dw.id || (cw.name && dw.name && cw.name.toLowerCase().trim() === dw.name.toLowerCase().trim()))) {
          combinedWorkers.push(dw);
        }
      }
      const store = getLocalDataStore();
      store.workers = combinedWorkers;
      saveLocalDataStore(store);
      return combinedWorkers;
    } catch (err) {
      console.warn("[PG] fetchWorkers notice (falling back to local cache):", err);
    }
  }
  await whenSchemaReady();
  const localWorkers = getLocalDataStore().workers;
  return (localWorkers && localWorkers.length > 0) ? localWorkers : DEFAULT_WORKERS;
}

export async function fetchWorkerById(id: string): Promise<WorkerProfile | null> {
  const workers = await fetchWorkers();
  return workers.find(w => w.id === id) || null;
}

export async function updateWorkerAvailability(id: string, isAvailable: boolean): Promise<WorkerProfile | null> {
  const store = getLocalDataStore();
  const index = store.workers.findIndex(w => w.id === id);
  if (index === -1) return null;

  store.workers[index].isAvailable = isAvailable;
  saveLocalDataStore(store);

  // Persist: without this the change is reverted by the next cold-start hydration.
  const pool = getPool();
  if (pool) {
    try {
      await pool.query("UPDATE workers SET is_available = $2 WHERE id = $1", [id, isAvailable]);
    } catch (err) {
      console.warn("[PG] updateWorkerAvailability notice:", err);
    }
  }

  return store.workers[index];
}

export async function createOrUpdateWorker(worker: Partial<WorkerProfile>): Promise<WorkerProfile> {
  const store = getLocalDataStore();
  const existingIndex = store.workers.findIndex(
    w => w.id === worker.id || (worker.name && w.name.toLowerCase().trim() === worker.name.toLowerCase().trim())
  );

  const existingWorker = existingIndex >= 0 ? store.workers[existingIndex] : null;

  const cleanWorker: WorkerProfile = {
    id: worker.id || existingWorker?.id || ('worker_' + Math.random().toString(36).substring(2, 9)),
    name: worker.name || existingWorker?.name || 'Staff Member',
    position: worker.position || existingWorker?.position || 'Staff',
    category: worker.category || existingWorker?.category || 'Staff',
    workplace: worker.workplace || existingWorker?.workplace || '',
    level: Number(worker.level || existingWorker?.level || 1),
    initials: worker.initials || existingWorker?.initials || (worker.name ? worker.name.substring(0, 2).toUpperCase() : 'WK'),
    lat: typeof worker.lat === 'number' ? worker.lat : (existingWorker?.lat || 41.8781),
    lng: typeof worker.lng === 'number' ? worker.lng : (existingWorker?.lng || -87.6298),
    role: worker.role || existingWorker?.role || 'Worker',
    isAvailable: worker.isAvailable ?? existingWorker?.isAvailable ?? true,
    avatar: worker.avatar || existingWorker?.avatar,
    address: worker.address || existingWorker?.address,
    merits: typeof worker.merits === 'number' ? worker.merits : (existingWorker?.merits || 0),
    rating: typeof worker.rating === 'number' ? worker.rating : (existingWorker?.rating || 5.0),
    registeredViaInvite: typeof worker.registeredViaInvite === 'boolean' ? worker.registeredViaInvite : (existingWorker?.registeredViaInvite ?? false),
    invitedByBusinessId: worker.invitedByBusinessId || existingWorker?.invitedByBusinessId,
    businessId: worker.businessId || existingWorker?.businessId,
    isVerifiedStaff: typeof worker.isVerifiedStaff === 'boolean' ? worker.isVerifiedStaff : (existingWorker?.isVerifiedStaff ?? false),
    rosterStatus: worker.rosterStatus || existingWorker?.rosterStatus || (worker.registeredViaInvite ? 'pending' : 'active'),
    user_id: (worker as any).user_id || (existingWorker as any)?.user_id,
  };

  if (existingIndex >= 0) {
    store.workers[existingIndex] = { ...store.workers[existingIndex], ...cleanWorker };
  } else {
    store.workers.unshift(cleanWorker);
  }

  // Also attach to matching business in store.businesses ONLY IF officially manager-invited
  const isManagerInvited = Boolean(cleanWorker.registeredViaInvite || cleanWorker.isVerifiedStaff);
  if (isManagerInvited && cleanWorker.workplace && cleanWorker.role !== 'Business') {
    const bizIdx = store.businesses.findIndex(
      b => (cleanWorker.invitedByBusinessId && b.id === cleanWorker.invitedByBusinessId) ||
           (cleanWorker.businessId && b.id === cleanWorker.businessId) ||
           b.name.toLowerCase().trim() === cleanWorker.workplace.toLowerCase().trim()
    );
    if (bizIdx >= 0) {
      const bWorkers = (store.businesses[bizIdx].workers || []).filter(
        w => w && w.role !== 'Business' && (w.name || '').toLowerCase().trim() !== store.businesses[bizIdx].name.toLowerCase().trim()
      );
      const isAlreadyIncluded = bWorkers.some(
        w => w.id === cleanWorker.id || (w.name && w.name.toLowerCase().trim() === cleanWorker.name.toLowerCase().trim())
      );
      const limit = store.businesses[bizIdx].employeeLimit || 4;

      if (isAlreadyIncluded) {
        store.businesses[bizIdx].workers = bWorkers.map(w => 
          (w.id === cleanWorker.id || (w.name && w.name.toLowerCase().trim() === cleanWorker.name.toLowerCase().trim()))
            ? { ...w, ...cleanWorker }
            : w
        );
      } else if (bWorkers.length < limit) {
        store.businesses[bizIdx].workers = [...bWorkers, cleanWorker];
      }
    }
  }

  saveLocalDataStore(store);

  const pool = getPool();
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO workers
           (id,name,position,category,workplace,level,initials,lat,lng,role,is_available,avatar,address,merits,rating,registered_via_invite,invited_by_business_id,business_id,is_verified_staff,roster_status,user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         ON CONFLICT (id) DO UPDATE SET
           name=EXCLUDED.name, position=EXCLUDED.position, category=EXCLUDED.category,
           workplace=EXCLUDED.workplace, level=EXCLUDED.level, initials=EXCLUDED.initials,
           lat=EXCLUDED.lat, lng=EXCLUDED.lng, role=EXCLUDED.role, is_available=EXCLUDED.is_available,
           avatar=EXCLUDED.avatar, address=EXCLUDED.address, merits=EXCLUDED.merits,
           rating=EXCLUDED.rating, registered_via_invite=EXCLUDED.registered_via_invite,
           invited_by_business_id=EXCLUDED.invited_by_business_id, business_id=EXCLUDED.business_id,
           is_verified_staff=EXCLUDED.is_verified_staff, roster_status=EXCLUDED.roster_status,
           user_id=COALESCE(EXCLUDED.user_id, workers.user_id)`,
        [
          cleanWorker.id,
          cleanWorker.name,
          cleanWorker.position,
          cleanWorker.category,
          cleanWorker.workplace,
          cleanWorker.level,
          cleanWorker.initials,
          cleanWorker.lat,
          cleanWorker.lng,
          cleanWorker.role,
          cleanWorker.isAvailable,
          cleanWorker.avatar || null,
          cleanWorker.address || null,
          cleanWorker.merits || 0,
          cleanWorker.rating || 5.0,
          cleanWorker.registeredViaInvite || false,
          cleanWorker.invitedByBusinessId || null,
          cleanWorker.businessId || null,
          cleanWorker.isVerifiedStaff || false,
          cleanWorker.rosterStatus || 'active',
          cleanWorker.user_id || null,
        ]
      );
    } catch (err) {
      console.warn("[PG] createOrUpdateWorker upsert notice:", err);
    }
  }

  return cleanWorker;
}

export async function syncWorkerAvatar(userIdOrName: string | string[], avatar: string): Promise<void> {
  if (!userIdOrName || !avatar) return;
  const store = getLocalDataStore();
  const searchTerms = (Array.isArray(userIdOrName) ? userIdOrName : [userIdOrName])
    .filter(Boolean)
    .map(s => s.toLowerCase().trim());
  if (searchTerms.length === 0) return;

  let modified = false;

  for (const w of store.workers) {
    if (w) {
      const match = searchTerms.some(search => 
        (w.id && w.id.toLowerCase() === search) ||
        (w.name && w.name.toLowerCase().trim() === search) ||
        ((w as any).user_id && String((w as any).user_id).toLowerCase() === search)
      );
      if (match) {
        w.avatar = avatar;
        modified = true;
      }
    }
  }

  for (const b of store.businesses) {
    for (const w of (b.workers || [])) {
      if (w) {
        const match = searchTerms.some(search =>
          (w.id && w.id.toLowerCase() === search) ||
          (w.name && w.name.toLowerCase().trim() === search) ||
          ((w as any).user_id && String((w as any).user_id).toLowerCase() === search)
        );
        if (match) {
          w.avatar = avatar;
          modified = true;
        }
      }
    }
  }

  if (modified) {
    saveLocalDataStore(store);
  }

  const pool = getPool();
  if (pool) {
    try {
      for (const term of searchTerms) {
        await pool.query(
          `UPDATE workers SET avatar = $1 WHERE user_id = $2 OR LOWER(id) = LOWER($2) OR LOWER(name) = LOWER($2)`,
          [avatar, term]
        );
      }
    } catch (e) {
      console.warn("[PG] syncWorkerAvatar notice:", e);
    }
  }
}

// 2. BUSINESSES
export async function fetchBusinesses(): Promise<BusinessProfile[]> {
  // Load the durable rows directly (never a once-per-instance snapshot).
  const pool = getPool();
  let baseBusinesses: BusinessProfile[];
  if (pool) {
    try {
      const { rows } = await pool.query("SELECT * FROM businesses ORDER BY name ASC");
      baseBusinesses = rows.map(mapBusinessRow);
      // Merge with DEFAULT_BUSINESSES so key workplaces never vanish
      for (const db of DEFAULT_BUSINESSES) {
        if (!baseBusinesses.some(bb => bb.id === db.id || (bb.name && db.name && bb.name.toLowerCase().trim() === db.name.toLowerCase().trim()))) {
          baseBusinesses.push(db);
        }
      }
      const store = getLocalDataStore();
      store.businesses = baseBusinesses;
      saveLocalDataStore(store);
    } catch (err) {
      console.warn("[PG] fetchBusinesses notice (falling back to local cache):", err);
      await whenSchemaReady();
      baseBusinesses = getLocalDataStore().businesses;
      if (!baseBusinesses || baseBusinesses.length === 0) {
        baseBusinesses = DEFAULT_BUSINESSES;
      }
    }
  } else {
    await whenSchemaReady();
    baseBusinesses = getLocalDataStore().businesses;
    if (!baseBusinesses || baseBusinesses.length === 0) {
      baseBusinesses = DEFAULT_BUSINESSES;
    }
  }

  const workers = await fetchWorkers();

  // Index ONLY officially manager-invited/verified workers for the business management roster
  const invitedWorkersByWorkplace = new Map<string, WorkerProfile[]>();
  const invitedWorkersByBizId = new Map<string, WorkerProfile[]>();

  for (const worker of workers) {
    if (worker.registeredViaInvite || worker.isVerifiedStaff) {
      if (worker.workplace) {
        const key = worker.workplace.trim().toLowerCase();
        const existing = invitedWorkersByWorkplace.get(key) || [];
        existing.push(worker);
        invitedWorkersByWorkplace.set(key, existing);
      }
      const bId = worker.invitedByBusinessId || worker.businessId;
      if (bId) {
        const existing = invitedWorkersByBizId.get(bId) || [];
        existing.push(worker);
        invitedWorkersByBizId.set(bId, existing);
      }
    }
  }

  return baseBusinesses.map(b => {
    const fromWorkplace = invitedWorkersByWorkplace.get(b.name.trim().toLowerCase()) || [];
    const fromBizId = invitedWorkersByBizId.get(b.id) || [];
    const existing = b.workers || [];
    // 1. Refresh any existing business workers with latest avatar & details from authoritative workers list
    const merged = existing.map(m => {
      const authoritative = workers.find(w => w.id === m.id || (w.name && m.name && w.name.toLowerCase().trim() === m.name.toLowerCase().trim()));
      return authoritative ? { ...m, ...authoritative, avatar: authoritative.avatar || m.avatar } : m;
    });

    // 2. Merge invited workers by workplace or business ID, updating existing workers or adding new ones
    for (const w of [...fromWorkplace, ...fromBizId]) {
      const matchIdx = merged.findIndex(m => m.id === w.id || (m.name && w.name && m.name.toLowerCase().trim() === w.name.toLowerCase().trim()));
      if (matchIdx === -1) {
        merged.push(w);
      } else {
        merged[matchIdx] = {
          ...merged[matchIdx],
          ...w,
          avatar: w.avatar || merged[matchIdx].avatar,
        };
      }
    }
    return {
      ...b,
      workers: merged,
    };
  });
}

export async function createOrUpdateBusiness(biz: Partial<BusinessProfile>): Promise<BusinessProfile> {
  const store = getLocalDataStore();
  const existingIndex = store.businesses.findIndex(
    b => b.id === biz.id || (biz.name && b.name.toLowerCase().trim() === biz.name.toLowerCase().trim())
  );

  const existingBiz = existingIndex >= 0 ? store.businesses[existingIndex] : null;

  // Merge workers
  const incomingWorkers = Array.isArray(biz.workers) ? biz.workers : [];
  const existingWorkers = existingBiz?.workers || [];
  const mergedWorkers = [...existingWorkers];
  for (const w of incomingWorkers) {
    if (w && w.name && !mergedWorkers.some(ew => ew && ew.name && ew.name.toLowerCase().trim() === w.name.toLowerCase().trim())) {
      mergedWorkers.push(w);
    }
  }

  const cleanBiz: BusinessProfile = {
    id: biz.id || existingBiz?.id || ('biz_' + Math.random().toString(36).substring(2, 9)),
    name: biz.name || existingBiz?.name || 'Establishment',
    category: biz.category || existingBiz?.category || 'Business',
    address: biz.address || existingBiz?.address || 'Chicago, IL',
    rating: Number(biz.rating || existingBiz?.rating || 5.0),
    qrCodeUrl: biz.qrCodeUrl || existingBiz?.qrCodeUrl || '',
    lat: typeof biz.lat === 'number' ? biz.lat : existingBiz?.lat,
    lng: typeof biz.lng === 'number' ? biz.lng : existingBiz?.lng,
    location: (biz.lat && biz.lng) ? { lat: biz.lat, lng: biz.lng } : existingBiz?.location,
    plan: (biz.plan || existingBiz?.plan || 'Starter'),
    planPrice: biz.planPrice || existingBiz?.planPrice || ((biz.plan || existingBiz?.plan || '').toLowerCase().includes('business') ? '$499 USD / year' : (biz.plan || existingBiz?.plan || '').toLowerCase().includes('growth') ? '$349 USD / year' : '$5 USD / year'),
    employeeLimit: Math.max(
      Number(biz.employeeLimit || existingBiz?.employeeLimit || ((biz.plan || existingBiz?.plan || '').toLowerCase().includes('business') ? 15 : (biz.plan || existingBiz?.plan || '').toLowerCase().includes('growth') ? 8 : 4)),
      (biz.plan || existingBiz?.plan || '').toLowerCase().includes('business') ? 15 : (biz.plan || existingBiz?.plan || '').toLowerCase().includes('growth') ? 8 : 4
    ),
    avatar: biz.avatar || existingBiz?.avatar,
    user_id: biz.user_id || (biz as any).userId || (existingBiz as any)?.user_id || (existingBiz as any)?.userId,
    ownerEmail: biz.ownerEmail || existingBiz?.ownerEmail || (biz as any).owner_email || (existingBiz as any)?.owner_email,
    hasPaid: typeof biz.hasPaid === 'boolean' ? biz.hasPaid : (existingBiz && typeof existingBiz.hasPaid === 'boolean' ? existingBiz.hasPaid : true),
    paymentStatus: biz.paymentStatus || existingBiz?.paymentStatus || 'paid',
    workers: mergedWorkers,
  };

  if (existingIndex >= 0) {
    store.businesses[existingIndex] = cleanBiz;
  } else {
    store.businesses.unshift(cleanBiz);
  }

  // Also sync merged workers into global store.workers
  for (const w of mergedWorkers) {
    if (w && w.name && !store.workers.some(sw => sw && sw.name && sw.name.toLowerCase().trim() === w.name.toLowerCase().trim())) {
      store.workers.unshift(w);
    }
  }

  saveLocalDataStore(store);

  const pool = getPool();
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO businesses
           (id,name,category,address,rating,qr_code_url,lat,lng,plan,plan_price,employee_limit,avatar,user_id,has_paid,payment_status,owner_email)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (id) DO UPDATE SET
           name=EXCLUDED.name, category=EXCLUDED.category, address=EXCLUDED.address,
           rating=EXCLUDED.rating, qr_code_url=EXCLUDED.qr_code_url, lat=EXCLUDED.lat,
           lng=EXCLUDED.lng, plan=EXCLUDED.plan, plan_price=EXCLUDED.plan_price,
           employee_limit=EXCLUDED.employee_limit, avatar=EXCLUDED.avatar, user_id=EXCLUDED.user_id,
           has_paid=EXCLUDED.has_paid, payment_status=EXCLUDED.payment_status, owner_email=EXCLUDED.owner_email`,
        [
          cleanBiz.id,
          cleanBiz.name,
          cleanBiz.category,
          cleanBiz.address,
          cleanBiz.rating,
          cleanBiz.qrCodeUrl || "",
          typeof cleanBiz.lat === "number" ? cleanBiz.lat : null,
          typeof cleanBiz.lng === "number" ? cleanBiz.lng : null,
          cleanBiz.plan || "Starter",
          cleanBiz.planPrice || "$5 USD / year",
          cleanBiz.employeeLimit || 4,
          cleanBiz.avatar || null,
          cleanBiz.user_id || null,
          cleanBiz.hasPaid ?? true,
          cleanBiz.paymentStatus || 'paid',
          cleanBiz.ownerEmail || null,
        ]
      );
    } catch (err) {
      console.warn("[PG] createOrUpdateBusiness upsert notice:", err);
    }
  }

  return cleanBiz;
}

export async function deleteBusiness(id: string): Promise<boolean> {
  const store = getLocalDataStore();
  const idx = store.businesses.findIndex(b => b.id === id);
  if (idx === -1) return false;

  const deletedBiz = store.businesses[idx];
  store.businesses.splice(idx, 1);

  // Unassign staff members as per decision D3
  const bizNameLower = (deletedBiz.name || '').trim().toLowerCase();
  for (let i = 0; i < store.workers.length; i++) {
    if (store.workers[i].workplace && store.workers[i].workplace.trim().toLowerCase() === bizNameLower) {
      store.workers[i].workplace = 'Unassigned';
    }
  }

  saveLocalDataStore(store);

  // Persist the deletion. Without this the row survives and reappears on the
  // next cold start when the local cache is re-hydrated from the database.
  const pool = getPool();
  if (pool) {
    try {
      await pool.query("DELETE FROM businesses WHERE id = $1", [id]);
      await pool.query("UPDATE workers SET workplace = 'Unassigned' WHERE lower(workplace) = $1", [bizNameLower]);
    } catch (err) {
      console.warn("[PG] deleteBusiness notice:", err);
    }
  }

  return true;
}

export async function deleteWorker(id: string): Promise<boolean> {
  const store = getLocalDataStore();
  const idx = store.workers.findIndex(w => w.id === id);
  if (idx === -1) return false;

  const deletedWorker = store.workers[idx];
  store.workers.splice(idx, 1);

  // Remove from any business's workers list
  for (const b of store.businesses) {
    if (b.workers && Array.isArray(b.workers)) {
      b.workers = b.workers.filter(w => w.id !== id && (deletedWorker.name && w.name ? w.name.toLowerCase().trim() !== deletedWorker.name.toLowerCase().trim() : true));
    }
  }

  saveLocalDataStore(store);

  // Persist the deletion (otherwise it is restored on the next cold start).
  const pool = getPool();
  if (pool) {
    try {
      await pool.query("DELETE FROM workers WHERE id = $1", [id]);
    } catch (err) {
      console.warn("[PG] deleteWorker notice:", err);
    }
  }

  return true;
}

/** Owner approval of a pending invitee: moves them onto the active roster. */
export async function approveWorkerInBusiness(bizId: string, workerId: string): Promise<boolean> {
  const store = getLocalDataStore();
  const worker = store.workers.find(w => w.id === workerId);
  if (worker) {
    worker.rosterStatus = 'active';
    if (!worker.businessId) worker.businessId = bizId;
    if (!worker.invitedByBusinessId) worker.invitedByBusinessId = bizId;
  }
  saveLocalDataStore(store);

  const pool = getPool();
  if (pool) {
    try {
      await pool.query(
        "UPDATE workers SET roster_status = 'active', business_id = COALESCE(business_id, $2), invited_by_business_id = COALESCE(invited_by_business_id, $2) WHERE id = $1",
        [workerId, bizId]
      );
    } catch (err) {
      console.warn("[PG] approveWorkerInBusiness notice:", err);
    }
  }
  return !!worker;
}

export async function removeWorkerFromBusiness(bizId: string, workerId: string): Promise<boolean> {
  const store = getLocalDataStore();
  const biz = store.businesses.find(b => b.id === bizId);
  if (biz && biz.workers && Array.isArray(biz.workers)) {
    biz.workers = biz.workers.filter(w => w.id !== workerId);
  }

  const worker = store.workers.find(w => w.id === workerId);
  if (worker) {
    worker.workplace = 'Unassigned';
  }

  saveLocalDataStore(store);

  // Persist (otherwise the assignment is restored on the next cold start).
  const pool = getPool();
  if (pool) {
    try {
      await pool.query("UPDATE workers SET workplace = 'Unassigned' WHERE id = $1", [workerId]);
    } catch (err) {
      console.warn("[PG] removeWorkerFromBusiness notice:", err);
    }
  }

  return true;
}

// 3. REVIEWS & MERITS
export async function fetchReviews(): Promise<ReviewItem[]> {
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query("SELECT * FROM reviews ORDER BY created_at DESC NULLS LAST LIMIT 50");
      return rows.map(mapReviewRow);
    } catch (err) {
      console.warn("[PG] fetchReviews notice:", err);
    }
  }
  await whenSchemaReady();
  return getLocalDataStore().reviews.slice(0, 50);
}

export async function createReview(review: Omit<ReviewItem, "id" | "createdAt"> & { id?: string }): Promise<{ review: ReviewItem; activity: ActivityFeedItem }> {
  const reviewId = review.id || ("rev_" + crypto.randomBytes(4).toString("hex"));
  const store = getLocalDataStore();

  // Idempotency check: prevent duplicate reviews and repeated level bumps
  const existingReview = store.reviews.find(r => r.id === reviewId);
  if (existingReview) {
    const existingActivity = store.activityFeed.find(a => a.reviewId === reviewId) || {
      id: "act_" + reviewId,
      reviewId: reviewId,
      fromUserName: existingReview.fromUserName,
      toWorkerName: "Team Member",
      businessName: "FeeTrust Establishment",
      meritType: existingReview.meritType,
      tipAmount: existingReview.tipAmount,
      timeAgo: "Just now",
      createdAt: existingReview.createdAt,
    };
    return { review: existingReview, activity: existingActivity };
  }

  const createdAt = new Date().toISOString();
  const newReview: ReviewItem = { ...review, id: reviewId, createdAt };

  const workers = await fetchWorkers();
  const targetWorker = workers.find(w => w.id === review.toUserId);
  const workerName = targetWorker ? targetWorker.name : "Team Member";
  const businessName = targetWorker ? targetWorker.workplace : "FeeTrust Establishment";

  const activityId = "act_" + crypto.randomBytes(4).toString("hex");
  const newActivity: ActivityFeedItem = {
    id: activityId,
    reviewId: reviewId,
    fromUserName: review.fromUserName || "Customer",
    toWorkerName: workerName,
    businessName: businessName,
    meritType: review.meritType,
    tipAmount: review.tipAmount || 0,
    timeAgo: "Just now",
    createdAt,
  };

  // Update local data store
  store.reviews.unshift(newReview);
  store.activityFeed.unshift(newActivity);
  if (targetWorker) {
    const wIdx = store.workers.findIndex(w => w.id === targetWorker.id);
    if (wIdx !== -1) {
      store.workers[wIdx].level += 1;
    }
  }
  saveLocalDataStore(store);

  // Persist durably to Postgres
  const pool = getPool();
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO reviews (id,from_user_id,from_user_name,to_user_id,merit_type,tip_amount,review_text,business_name,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
        [newReview.id, newReview.fromUserId || null, newReview.fromUserName || "Customer", newReview.toUserId || null,
         newReview.meritType, newReview.tipAmount || 0, newReview.reviewText || null, newReview.businessName || null, createdAt]
      );
      await pool.query(
        `INSERT INTO activity_feed (id,review_id,from_user_name,to_worker_name,business_name,merit_type,tip_amount,time_ago,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
        [newActivity.id, reviewId, newActivity.fromUserName, newActivity.toWorkerName, newActivity.businessName,
         newActivity.meritType, newActivity.tipAmount, newActivity.timeAgo, createdAt]
      );
      if (targetWorker) {
        await pool.query("UPDATE workers SET level = COALESCE(level,1) + 1 WHERE id = $1", [targetWorker.id]);
      }
    } catch (err) {
      console.warn("[PG] createReview persist notice:", err);
    }
  }

  return { review: newReview, activity: newActivity };
}

// 4. ACTIVITY FEED
export async function fetchActivityFeed(): Promise<ActivityFeedItem[]> {
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query("SELECT * FROM activity_feed ORDER BY created_at DESC NULLS LAST LIMIT 50");
      return rows.map(mapActivityRow);
    } catch (err) {
      console.warn("[PG] fetchActivityFeed notice:", err);
    }
  }
  await whenSchemaReady();
  return getLocalDataStore().activityFeed.slice(0, 50);
}

// 5. THANK YOU NOTES
export async function fetchThankYouNotes(): Promise<ThankYouNoteItem[]> {
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query("SELECT * FROM thank_you_notes ORDER BY created_at DESC NULLS LAST LIMIT 50");
      return rows.map(mapThankYouRow);
    } catch (err) {
      console.warn("[PG] fetchThankYouNotes notice:", err);
    }
  }
  await whenSchemaReady();
  return getLocalDataStore().thankYouNotes.slice(0, 50);
}

export async function createThankYouNote(reviewId: string, fromWorkerName: string, toUserName: string, message: string, id?: string): Promise<ThankYouNoteItem> {
  const noteId = id || ("tn_" + crypto.randomBytes(4).toString("hex"));
  const createdAt = new Date().toISOString();
  const note: ThankYouNoteItem = { id: noteId, reviewId, fromWorkerName, toUserName, message, createdAt };

  const store = getLocalDataStore();
  store.thankYouNotes.unshift(note);
  saveLocalDataStore(store);

  const pool = getPool();
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO thank_you_notes (id,review_id,from_worker_name,to_user_name,message,created_at)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
        [noteId, reviewId, fromWorkerName, toUserName, message, createdAt]
      );
    } catch (err) {
      console.warn("[PG] createThankYouNote persist notice:", err);
    }
  }

  return note;
}

// 6. COUPONS & REWARDS
export async function claimCoupon(userId: string, couponId: string, code: string, gemsAwarded: number): Promise<ClaimedCouponItem> {
  // Idempotency: a user may only claim a given coupon once.
  const store = getLocalDataStore();
  const existing = (store.claimedCoupons || []).find(
    c => c.userId === userId && (c.couponId === couponId || c.code === code)
  );
  if (existing) {
    return existing;
  }

  const isSpend = gemsAwarded < 0;

  // Spending gems must be authorised against the real balance — never go negative.
  if (isSpend) {
    const pool = getPool();
    let currentGems = 0;
    let resolved = false;
    if (pool) {
      try {
        const { rows } = await pool.query("SELECT gems FROM users WHERE id = $1 LIMIT 1", [userId]);
        if (rows.length) {
          currentGems = Number(rows[0].gems || 0);
          resolved = true;
        }
      } catch (err) {
        console.warn("[PG] claimCoupon balance lookup notice:", err);
      }
    }
    if (!resolved) {
      const users = getUsersDb();
      currentGems = Number(users[userId]?.gems || 0);
    }
    if (currentGems + gemsAwarded < 0) {
      throw new Error(
        `Insufficient gems: this reward costs ${Math.abs(gemsAwarded)} but the account holds ${currentGems}.`
      );
    }
  }

  const id = "clm_" + crypto.randomBytes(4).toString("hex");
  const claimedAt = new Date().toISOString();
  const claim: ClaimedCouponItem = { id, userId, couponId, code, gemsAwarded, claimedAt };

  store.claimedCoupons.push(claim);
  saveLocalDataStore(store);

  // Local user gems update
  const users = getUsersDb();
  if (users[userId]) {
    users[userId].gems = Math.max(0, (users[userId].gems || 0) + gemsAwarded);
    saveUsersDb(users);
  }

  const pool = getPool();
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO claimed_coupons (id,user_id,coupon_id,code,gems_awarded,claimed_at)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
        [id, userId, couponId, code, gemsAwarded, claimedAt]
      );
      if (userId) {
        await pool.query(
          "UPDATE users SET gems = GREATEST(0, COALESCE(gems,0) + $2) WHERE id = $1",
          [userId, gemsAwarded]
        );
      }
    } catch (err) {
      console.warn("[PG] claimCoupon persist notice:", err);
    }
  }

  return claim;
}

/** Durable list of a user's coupon claims. */
export async function fetchCouponClaims(userId?: string): Promise<ClaimedCouponItem[]> {
  await whenSchemaReady();
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = userId
        ? await pool.query("SELECT * FROM claimed_coupons WHERE user_id = $1 ORDER BY claimed_at DESC NULLS LAST LIMIT 100", [userId])
        : await pool.query("SELECT * FROM claimed_coupons ORDER BY claimed_at DESC NULLS LAST LIMIT 100");
      return rows.map(mapCouponRow);
    } catch (err) {
      console.warn("[PG] fetchCouponClaims notice:", err);
    }
  }
  const local = getLocalDataStore().claimedCoupons || [];
  return userId ? local.filter(c => c.userId === userId) : local;
}

// 7. MODERATION (admin)
export async function setUserStatus(uid: string, status: string): Promise<boolean> {
  // Local cache (also the sole store when DATABASE_URL is absent)
  const users = getUsersDb();
  if (users[uid]) {
    users[uid].status = status;
    saveUsersDb(users);
  }
  const pool = getPool();
  if (pool) {
    try {
      await pool.query("UPDATE users SET status = $2 WHERE id = $1", [uid, status]);
    } catch (err) {
      console.warn("[PG] setUserStatus notice:", err);
    }
  }
  return true;
}

export async function setBusinessStatus(bizId: string, status: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  await pool.query("UPDATE businesses SET status = $2 WHERE id = $1", [bizId, status]);
  return true;
}

export async function setBusinessVerified(bizId: string, verified: boolean): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  await pool.query("UPDATE businesses SET verified = $2 WHERE id = $1", [bizId, verified]);
  return true;
}

/** Removes a merit/review and its activity entry (moderation). */
export async function deleteReviewById(reviewId: string): Promise<boolean> {
  const store = getLocalDataStore();
  const before = store.reviews.length;
  store.reviews = store.reviews.filter(r => r.id !== reviewId);
  store.activityFeed = store.activityFeed.filter(a => a.reviewId !== reviewId);
  saveLocalDataStore(store);

  const pool = getPool();
  if (pool) {
    try {
      await pool.query("DELETE FROM reviews WHERE id = $1", [reviewId]);
      await pool.query("DELETE FROM activity_feed WHERE review_id = $1", [reviewId]);
    } catch (err) {
      console.warn("[PG] deleteReviewById notice:", err);
    }
  }
  return store.reviews.length < before;
}

/** Pulls the full user list for the admin console. */
export async function fetchAllUsers(): Promise<any[]> {
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query(
        "SELECT id,name,email,role,status,level,gems,created_at FROM users ORDER BY created_at DESC NULLS LAST LIMIT 500"
      );
      return rows.map(r => ({
        uid: r.id,
        name: r.name,
        email: r.email,
        role: r.role,
        status: r.status || "active",
        level: r.level,
        gems: r.gems,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
      }));
    } catch (err) {
      console.warn("[PG] fetchAllUsers notice:", err);
    }
  }
  return Object.values(getUsersDb()) as any[];
}

// 8. PERMANENT ACCOUNT & DATA DELETION
export async function deleteUserData(
  userId?: string, 
  email?: string, 
  businessId?: string, 
  businessName?: string
): Promise<{ success: boolean; message: string }> {
  const users = getUsersDb();
  let deletedUser: any = null;

  if (userId && users[userId]) {
    deletedUser = users[userId];
    delete users[userId];
  }

  if (email) {
    const cleanEmail = email.trim().toLowerCase();
    for (const [uid, u] of Object.entries(users)) {
      if ((u as any)?.email && (u as any).email.trim().toLowerCase() === cleanEmail) {
        if (!deletedUser) deletedUser = u;
        delete users[uid];
      }
    }
  }
  saveUsersDb(users);

  const store = getLocalDataStore();
  const userName = deletedUser?.name?.trim().toLowerCase();
  const userEmail = deletedUser?.email?.trim().toLowerCase() || (email ? email.trim().toLowerCase() : '');
  const userWorkplace = deletedUser?.workplace ? deletedUser.workplace.trim().toLowerCase() : '';
  const cleanBizName = (businessName || userWorkplace || (deletedUser?.role === 'Business' ? userName : '') || '').trim().toLowerCase();
  const targetBizId = businessId || (userId ? `biz_${userId}` : '');

  // 1. Remove business owned by or matching this user
  store.businesses = store.businesses.filter(b => {
    if (businessId && b.id === businessId) return false;
    if (targetBizId && b.id === targetBizId) return false;
    if (userId && (b.id === userId || (b as any).user_id === userId)) return false;
    if (cleanBizName && b.name && b.name.trim().toLowerCase() === cleanBizName) return false;
    if (userWorkplace && b.name && b.name.trim().toLowerCase() === userWorkplace) return false;
    return true;
  });

  // 2. Remove worker and business map pins matching this user or business
  store.workers = store.workers.filter(w => {
    if (userId && w.id === userId) return false;
    if (businessId && w.id === businessId) return false;
    if (targetBizId && w.id === targetBizId) return false;
    if (userName && w.name && w.name.trim().toLowerCase() === userName) return false;
    if (cleanBizName && (
      (w.role === 'Business' && w.name && w.name.trim().toLowerCase() === cleanBizName) ||
      (w.workplace && w.workplace.trim().toLowerCase() === cleanBizName)
    )) return false;
    return true;
  });

  // 3. Remove user or unassigned business workers from remaining business rosters
  store.businesses = store.businesses.map(b => ({
    ...b,
    workers: (b.workers || []).filter(w => {
      if (userId && w.id === userId) return false;
      if (userName && w.name && w.name.trim().toLowerCase() === userName) return false;
      if (cleanBizName && w.workplace && w.workplace.trim().toLowerCase() === cleanBizName) return false;
      return true;
    })
  }));

  // 4. Remove reviews associated with this business or user
  store.reviews = store.reviews.filter(r => {
    if (userId && (r.fromUserId === userId || r.toUserId === userId)) return false;
    if (cleanBizName && r.businessName && r.businessName.trim().toLowerCase() === cleanBizName) return false;
    return true;
  });

  // 5. Remove activity feed items associated with this business or user
  store.activityFeed = store.activityFeed.filter(a => {
    if (cleanBizName && a.businessName && a.businessName.trim().toLowerCase() === cleanBizName) return false;
    if (userName && (a.fromUserName?.trim().toLowerCase() === userName || a.toWorkerName?.trim().toLowerCase() === userName)) return false;
    return true;
  });

  // 6. Remove claimed coupons
  if (userId) {
    store.claimedCoupons = (store.claimedCoupons || []).filter(c => c.userId !== userId);
  }

  saveLocalDataStore(store);

  const pool = getPool();
  if (pool) {
    try {
      if (userId) {
        await pool.query("DELETE FROM users WHERE id = $1", [userId]);
        await pool.query("DELETE FROM businesses WHERE user_id = $1", [userId]);
        // Workers are linked to their account via user_id (their own id is a
        // generated worker_* value), so purge by BOTH — otherwise an account
        // deletion leaves the worker profile behind.
        await pool.query("DELETE FROM workers WHERE id = $1 OR user_id = $1", [userId]);
        await pool.query("DELETE FROM reviews WHERE from_user_id = $1 OR to_user_id = $1", [userId]);
        await pool.query("DELETE FROM claimed_coupons WHERE user_id = $1", [userId]);
      }
      if (email) {
        await pool.query("DELETE FROM users WHERE email = $1", [email.trim().toLowerCase()]);
      }
      if (businessId) {
        await pool.query("DELETE FROM businesses WHERE id = $1", [businessId]);
      }
      if (cleanBizName) {
        const bizRes = await pool.query("SELECT id FROM businesses WHERE lower(name) = $1", [cleanBizName]);
        if (bizRes.rows.length) {
          await pool.query("DELETE FROM businesses WHERE lower(name) = $1", [cleanBizName]);
        }
        await pool.query("DELETE FROM workers WHERE lower(workplace) = $1", [cleanBizName]);
        await pool.query("DELETE FROM reviews WHERE lower(business_name) = $1", [cleanBizName]);
        await pool.query("DELETE FROM activity_feed WHERE lower(business_name) = $1", [cleanBizName]);
      }
    } catch (err) {
      console.warn("[PG] deleteUserData notice:", err);
    }
  }

  return { success: true, message: "Account, business establishment, and all associated records permanently purged." };
}
