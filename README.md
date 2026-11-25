# PaisaTrack — AI-Powered Personal Finance Management Platform

**Tagline:** *Your Money. Your Goals. Your Future.*

PaisaTrack is a full-stack personal finance management platform built with React, TypeScript, Tailwind CSS, Recharts, Motion, Firebase Authentication, Cloud Firestore, Express, and the Google Gemini API.

## Core Modules
- **Landing Page:** Interactive hero financial preview, feature bento showcase, AI insights preview, security overview, sample testimonials, pricing, and FAQ.
- **Authentication:** Google Sign-In, Email/Password registration & login, forgot password & password reset, email verification gate, and protected workspace routes.
- **Overview Dashboard:** Real-time KPI cards with sparklines, date range filters (`Today`, `This Week`, `This Month`, `Last Month`, `This Year`, `Custom Range`), Income vs Expenses line chart, Monthly Spending bar chart, Expense Category donut chart, Net Savings area chart, Budget Utilization bars, and Recent Transactions.
- **Transaction Management:** Add, edit, delete, search, multi-facet filtering, sorting, CSV import with preview, and CSV export.
- **Smart Budgets:** Monthly category budgets with live transaction tracking and 50% / 75% / 90% / 100%+ alerts.
- **Savings Goals:** Animated circular progress, required monthly savings calculation, and atomic contribution logging.
- **EMI Calculator:** Reducing-balance Home/Personal/Car/Education loan calculator, principal vs interest chart, monthly/yearly amortization schedule, CSV export, and saved EMI reminders.
- **AI Financial Assistant:** Server-side Gemini API (`gemini-4-hydrogen`) chat grounded strictly in your stored financial records, clearly distinguishing recorded actuals from estimates.
- **Advanced Analytics & Settings:** Cash flow analysis, MoM comparison, printable PDF reports, multi-currency (`INR`, `USD`, `EUR`, `GBP`), Dark/Light themes, notification controls, JSON/CSV data export, and account deletion.

## Setup & Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment variables (`.env.example`):**
   - `GEMINI_API_KEY` — Required on the server for `/api/ai/chat` (never exposed to browser bundles).
   - `APP_URL` — Hosted application URL.

3. **Firebase Configuration:**
   - Ensure `firebase-applet-config.json` contains your provisioned Firebase Web App config and `firestoreDatabaseId`.
   - Deploy security rules from `firestore.rules`:
     ```bash
     npx eslint firestore.rules
     ```
   - Optional: Enable **Email/Password** sign-in in Firebase Console (`Authentication → Sign-in method`) alongside Google Sign-In.

4. **Run locally:**
   ```bash
   npm run dev
   ```

5. **Production build & start:**
   ```bash
   npm run build
   npm start
   ```
