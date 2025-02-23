export const DATABASE_NAME = 'db';
export const HERO_COLLECTION_NAME = 'hero';

export const SYNC_PORT = 10101;

/**
 * We assume that when no indexeddb is there,
 * we are in the server-side rendering nodejs process
 * of angular universal
 */
export const IS_SERVER_SIDE_RENDERING = !global.window || !global.window.indexedDB;
