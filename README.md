# RLSY College ERP — Autonomous Institutional Management System

Full-stack institutional management platform for **Ram Lakhan Singh Yadav College**, built with **React 19**, **TypeScript**, **Tailwind CSS v4**, **Zustand**, **TanStack Query**, and an **Express + Vite** backend.

## Key Capabilities

- **Server-Hardened Authentication (`bcryptjs`)**: Per-user salted `bcrypt` password hashing (12 rounds), signed `HttpOnly` session cookies (`ERP_SESSION_SECRET`), zero plaintext fallback paths, and mandatory password reset on first login for all password-based seeded and newly onboarded accounts (the root Super Administrator account authenticates exclusively via Google Mail).
- **Canonical RBAC Policy Engine**: Shared role-based access control matrix enforced server-side via `requireAuth` / `requireRoles` middleware on Express API routes and across `<ProtectedRoute>`, Desktop Grouped Sidebar, and Mobile Bottom Navigation.
- **Sequential Financial-Year Receipt Engine**: Server-generated, collision-free receipt numbers (`RLSY/2026-27/REC/000001`) and HMAC-verified payment gateway webhook reconciliation with order/amount binding and replay protection.
- **Post-Declaration Grade Lock & Approval Workflow**: Time-bounded, single-use dual-custody lock on declared semester marksheets requiring formal unlock requests and Principal/Superadmin authorization before any post-declaration modification.
- **Immutable Server Audit Trail**: Tracks `who`, `when`, `oldValue`, and `newValue` across fee ledger updates, grade edits, and batch promotions.
- **Schema-Validated Backup & Restore (`zod` + `exceljs`)**: Export and import institutional datasets with strict Zod schema validation and `exceljs` workbook generation.

## Getting Started (npm)

```bash
# 1. Install dependencies
npm install

# 2. Start the full-stack Express + Vite server on port 3000
npm run dev

# 3. Run the Vitest automated test suite
npm test

# 4. Type-check and build for production
npm run lint
npm run build
```
