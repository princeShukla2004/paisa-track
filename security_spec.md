# PaisaTrack Firestore Security Specification

## 1. Data Invariants
1. Every document under `/users/{userId}` and its subcollections belongs exclusively to `request.auth.uid == userId` with `request.auth.token.email_verified == true`.
2. Every subcollection document (`transactions`, `recurring_transactions`, `budgets`, `savings_goals`, `savings_contributions`, `notifications`, `emi_plans`, `private/settings`) must carry `userId == request.auth.uid` and verify parent user document existence via `existsAfter(/databases/$(database)/documents/users/$(userId))`.
3. A `SavingsContribution` cannot exist without a valid parent `SavingsGoal` belonging to the same user (`existsAfter(.../savings_goals/$(incoming().goalId))`).
4. Immutable fields (`uid`, `userId`, `goalId`, `recurringId`, `createdAt`) cannot be altered after creation.
5. Temporal integrity: `createdAt == request.time` on create and `updatedAt == request.time` on update.
6. Strict field allowlists (`hasOnly`) and bounded numeric/string constraints prevent shadow fields and payload exhaustion.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Cross-User Read**: User B reads `/users/userA/private/settings` -> Denied.
2. **Cross-User Transaction Write**: User B writes `/users/userA/transactions/tx1` with `userId: "userA"` -> Denied.
3. **Identity Spoofing in Payload**: User A writes `/users/userA/transactions/tx1` with `userId: "userB"` -> Denied.
4. **Shadow Field Injection**: User A creates transaction with extra field `isVerified: true` -> Denied by `keys().hasOnly(...)`.
5. **Unverified Email Write**: Unverified auth token (`email_verified: false`) attempts write -> Denied.
6. **Negative / Zero Amount**: User A creates transaction with `amount: -500` or `amount: 0` -> Denied.
7. **Invalid Category Enum**: User A creates budget with `category: "Casino"` -> Denied.
8. **Malformed Date String**: User A creates transaction with `date: "25-11-2026"` -> Denied by regex `^\\d{4}-\\d{2}-\\d{2}$`.
9. **Oversized String Poisoning**: User A sets `title` to 500 chars (`> 120`) or doc ID `> 128` chars -> Denied.
10. **Client-Forged Timestamp**: User A passes `createdAt: Timestamp(2020-01-01)` instead of `request.time` -> Denied.
11. **Orphaned Savings Contribution**: User A creates contribution referencing nonexistent `goalId: "fake_goal"` -> Denied by `existsAfter(...)`.
12. **Immutable Field Mutation**: User A updates transaction changing `userId` or `createdAt` -> Denied by `affectedKeys().hasOnly(...)` and immutability gate.
