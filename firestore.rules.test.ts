/**
 * PaisaTrack Firestore Security Rules Verification Spec
 * Verifies all 12 adversarial payloads fail against hardened rules logic.
 */

export const DIRTY_DOZEN_PAYLOADS = [
  { name: 'Cross-User Private Settings Read', path: '/users/userA/private/settings', actor: 'userB', expected: 'PERMISSION_DENIED' },
  { name: 'Cross-User Transaction Create', path: '/users/userA/transactions/tx1', actor: 'userB', payload: { userId: 'userA' }, expected: 'PERMISSION_DENIED' },
  { name: 'Identity Spoofing in Transaction', path: '/users/userA/transactions/tx1', actor: 'userA', payload: { userId: 'userB' }, expected: 'PERMISSION_DENIED' },
  { name: 'Shadow Field Injection', path: '/users/userA/transactions/tx1', actor: 'userA', payload: { userId: 'userA', isVerified: true }, expected: 'PERMISSION_DENIED' },
  { name: 'Unverified Email Write', path: '/users/userA/transactions/tx1', actor: 'userA_unverified', expected: 'PERMISSION_DENIED' },
  { name: 'Negative Amount Poisoning', path: '/users/userA/transactions/tx1', actor: 'userA', payload: { amount: -100 }, expected: 'PERMISSION_DENIED' },
  { name: 'Invalid Category Enum', path: '/users/userA/budgets/b1', actor: 'userA', payload: { category: 'InvalidCat' }, expected: 'PERMISSION_DENIED' },
  { name: 'Malformed Date Regex', path: '/users/userA/transactions/tx1', actor: 'userA', payload: { date: '25/11/2026' }, expected: 'PERMISSION_DENIED' },
  { name: 'Oversized Title String', path: '/users/userA/transactions/tx1', actor: 'userA', payload: { title: 'x'.repeat(300) }, expected: 'PERMISSION_DENIED' },
  { name: 'Client Forged Timestamp', path: '/users/userA/transactions/tx1', actor: 'userA', payload: { createdAt: '2020-01-01T00:00:00Z' }, expected: 'PERMISSION_DENIED' },
  { name: 'Orphaned Savings Contribution', path: '/users/userA/savings_contributions/c1', actor: 'userA', payload: { goalId: 'nonexistent' }, expected: 'PERMISSION_DENIED' },
  { name: 'Immutable Field Mutation', path: '/users/userA/transactions/tx1', actor: 'userA', payload: { createdAt: 'request.time', userId: 'other' }, expected: 'PERMISSION_DENIED' }
] as const;
