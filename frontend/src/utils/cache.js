// Module-level global memory cache for SWR pattern
const memoryCache = {
  rooms: null,
  cmsContent: null,
  properties: null,
  services: null,
  ratePlans: null,
  coupons: null,
  roomDetails: {} // ID -> Room Object
};

/**
 * Get cached data by key
 * @param {string} key 
 * @returns {any}
 */
export const getCachedData = (key) => {
  return memoryCache[key];
};

/**
 * Set cached data by key
 * @param {string} key 
 * @param {any} data 
 */
export const setCachedData = (key, data) => {
  memoryCache[key] = data;
};

/**
 * Get a specific room from cache. If not found in specific details, look it up in rooms list.
 * @param {string} id 
 * @returns {any|null}
 */
export const getCachedRoom = (id) => {
  if (memoryCache.roomDetails[id]) {
    return memoryCache.roomDetails[id];
  }
  if (memoryCache.rooms) {
    return memoryCache.rooms.find(r => r.id === id) || null;
  }
  return null;
};

/**
 * Cache single room details
 * @param {string} id 
 * @param {any} data 
 */
export const setCachedRoom = (id, data) => {
  memoryCache.roomDetails[id] = data;
};

/**
 * Clear cached data by key, or clear everything if no key is provided
 * @param {string} [key] 
 */
export const clearCache = (key) => {
  if (key) {
    if (key === 'roomDetails') {
      memoryCache.roomDetails = {};
    } else {
      memoryCache[key] = null;
    }
  } else {
    memoryCache.rooms = null;
    memoryCache.cmsContent = null;
    memoryCache.properties = null;
    memoryCache.services = null;
    memoryCache.ratePlans = null;
    memoryCache.coupons = null;
    memoryCache.roomDetails = {};
  }
};
