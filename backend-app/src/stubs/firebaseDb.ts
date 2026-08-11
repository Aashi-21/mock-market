/**
 * Compatibility shims — persistence is now local CSV under local-db/.
 */

export {
  loadUserAccount,
  saveUserAccount,
} from '../localDb/userStore.js';
