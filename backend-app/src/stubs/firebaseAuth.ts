/**
 * Legacy stub — auth is handled by services/authService + localDb.
 * Kept so older imports do not break during transition.
 */

export async function firebaseSignInWithEmailPassword(): Promise<never> {
  throw Object.assign(new Error('Use /auth/login with local username/password'), {
    status: 410,
  });
}

export async function firebaseVerifyIdToken(): Promise<never> {
  throw Object.assign(new Error('Use authService.requireUser'), { status: 410 });
}
