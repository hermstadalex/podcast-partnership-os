# Podcast Partnership OS

A multi-tenant podcast management platform enabling granular, client-specific routing to automated publishing pipelines, AI-driven artwork generation, and unified workflow orchestration across RSS hosting and YouTube.

## Tech Stack
- **Framework**: Next.js 16 (App Router), React 19
- **Database/Auth**: Supabase (PostgreSQL, Row Level Security)
- **Styling**: Tailwind CSS v4, Framer Motion, Radix UI
- **Testing**: Jest (Unit), Playwright (E2E)
- **Integrations**: Captivate (RSS Audio), Zernio (YouTube Distribution), Google Generative AI (Episode Art Processing)

## Local Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Duplicate `.env.example` to `.env.local` and populate the required API keys and Supabase credentials. Do not commit `.env.local`.
   ```bash
   cp .env.example .env.local
   ```

3. **Supabase Database Setup**
   If developing locally or against a staging instance, apply the sequential migrations in the `supabase/migrations/` directory directly to your Supabase SQL editor to ensure schema, trigger, and Row Level Security parity.

4. **Start Development Server**
   ```bash
   npm run dev
   ```
   *The application will boot on [http://localhost:3000](http://localhost:3000)*

## Development Commands
- `npm run dev` - Starts the Next.js development server.
- `npm run build` - Builds the application for production.
- `npm run lint` - Executes ESLint to check for stylistic errors.
- `npm run typecheck` - Compiles TypeScript types without emitting files (`tsc --noEmit`).

## Testing
The application employs a dual testing strategy. Test media and JSON mock payloads reside in `tests/fixtures/`.
- `npm run test` - Executes the Jest unit test suite.
- `npm run test:e2e` - Executes the Playwright end-to-end browser tests.
- `npm run test:all` - Executes both suites.

## Repository Structure
- `src/app` - Next.js App Router endpoints, including `(admin)` and `(client)` route groups.
- `src/lib/services` - Core logic integrations for third-party platforms (Captivate, Zernio).
- `src/lib/supabase` - Database initialization and SSR client abstractions.
- `supabase/migrations` - PostgreSQL schema definitions and table seeding scripts.
- `tests/` - Jest unit tests and Playwright E2E suites.
- `scripts/experimental` - Unstructured testing scratchpads and utility validation scripts.

## Known Limitations / Next Refactor Targets
- **Centralized Logic**: Server Action endpoints (e.g., `src/app/actions.ts`) currently blend database queries, external API fetch orchestration, and Next.js boundary returns. Future refactors should decouple these into discrete typed Repositories and Services.
- **Strict Data Validation**: External API boundaries utilize implicit any/unknown typing. Implementing `Zod` schemas for incoming webhooks and API payloads is highly recommended.
- **Dynamic Database Types**: Application uses inline mapped types for Supabase results. Transitioning to auto-generated `supabase-js` schema types will prevent type-drift.
