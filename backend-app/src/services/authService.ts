import { firebaseSignInWithEmailPassword, firebaseVerifyIdToken } from '../stubs/firebaseAuth.js';
import { ensureSeedUser, getAccount, persistAccount } from '../store/memoryStore.js';
import type { UserAccount, UserProfile } from '../types/index.js';

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; user: UserProfile }> {
  await ensureSeedUser();
  const auth = await firebaseSignInWithEmailPassword(email, password);
  const account = await getAccount(auth.uid);
  // Keep profile fields in sync with auth stub
  account.user.email = auth.email;
  account.user.displayName = auth.displayName;
  await persistAccount(account);

  return {
    token: auth.idToken,
    user: account.user,
  };
}

export async function requireUser(authHeader: string | undefined): Promise<UserAccount> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Missing Bearer token'), { status: 401 });
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const { uid } = await firebaseVerifyIdToken(token);
  await ensureSeedUser();
  return getAccount(uid);
}
