/**
 * Stub: Firebase Authentication.
 * Replace with Admin SDK / client token verification when IDAM/Firebase is wired.
 */

export interface FirebaseAuthResult {
  uid: string;
  email: string;
  displayName: string;
  idToken: string;
  provider: 'password' | 'firebase-stub';
}

const MOCK_USERS = [
  {
    email: 'trader@mockmarket.in',
    password: 'demo1234',
    uid: 'usr_mock_001',
    displayName: 'Aarav Mehta',
  },
] as const;

export async function firebaseSignInWithEmailPassword(
  email: string,
  password: string,
): Promise<FirebaseAuthResult> {
  // TODO(firebase-auth): admin.auth().verifyIdToken / signInWithEmailAndPassword
  const match = MOCK_USERS.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password,
  );
  if (!match) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  return {
    uid: match.uid,
    email: match.email,
    displayName: match.displayName,
    idToken: `stub-firebase-token.${match.uid}.${Date.now()}`,
    provider: 'firebase-stub',
  };
}

export async function firebaseVerifyIdToken(token: string): Promise<{ uid: string }> {
  // TODO(firebase-auth): return admin.auth().verifyIdToken(token)
  if (!token.startsWith('stub-firebase-token.') && !token.startsWith('mock-jwt-')) {
    throw Object.assign(new Error('Invalid auth token'), { status: 401 });
  }
  const parts = token.split('.');
  const uid = parts[1] ?? 'usr_mock_001';
  return { uid };
}
