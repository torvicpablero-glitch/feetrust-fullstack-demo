import { get, set } from 'idb-keyval';
import { WorkerProfile, BusinessProfile } from './store';

const WORKERS_CACHE_KEY = 'feetrust_cached_workers';
const BUSINESSES_CACHE_KEY = 'feetrust_cached_businesses';

/**
 * Cache workers and businesses to IndexedDB & LocalStorage for offline PWA viewing
 */
export const cacheWorkersAndBusinesses = async (workers: WorkerProfile[], businesses: BusinessProfile[]) => {
  try {
    await set(WORKERS_CACHE_KEY, workers);
    await set(BUSINESSES_CACHE_KEY, businesses);
  } catch (err) {
    try {
      localStorage.setItem(WORKERS_CACHE_KEY, JSON.stringify(workers));
      localStorage.setItem(BUSINESSES_CACHE_KEY, JSON.stringify(businesses));
    } catch (e) {}
  }
};

/**
 * Load cached workers and businesses from IndexedDB & LocalStorage when offline or starting up
 */
export const loadCachedWorkersAndBusinesses = async (): Promise<{ workers: WorkerProfile[]; businesses: BusinessProfile[] }> => {
  try {
    const cachedWorkers = await get<WorkerProfile[]>(WORKERS_CACHE_KEY);
    const cachedBusinesses = await get<BusinessProfile[]>(BUSINESSES_CACHE_KEY);
    if (cachedWorkers || cachedBusinesses) {
      return {
        workers: cachedWorkers || [],
        businesses: cachedBusinesses || [],
      };
    }
  } catch (err) {}

  try {
    const w = localStorage.getItem(WORKERS_CACHE_KEY);
    const b = localStorage.getItem(BUSINESSES_CACHE_KEY);
    return {
      workers: w ? JSON.parse(w) : [],
      businesses: b ? JSON.parse(b) : [],
    };
  } catch (e) {
    return { workers: [], businesses: [] };
  }
};
