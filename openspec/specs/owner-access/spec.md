# Owner Access Specification

## Purpose

Defines authentication and row-level authorization for the single-owner catalog: a real Supabase Auth (email/password) session, per-row ownership, and deny-by-default RLS on every table.

## Requirements

### Requirement: Authenticated Session Required
Every catalog screen and operation (`prenda`, `outfit`, `tip`, and their join tables) MUST be unreachable without a valid Supabase Auth session. Passcode-only or client-side-only gating MUST NOT be used as a substitute for a real authenticated session.

#### Scenario: Unauthenticated user cannot reach catalog screens
- GIVEN a visitor with no active Supabase Auth session
- WHEN they attempt to open any catalog screen
- THEN the system MUST redirect them to sign-in and MUST NOT render catalog data

#### Scenario: Sign-in with valid credentials grants access
- GIVEN a registered owner with valid email/password credentials
- WHEN they sign in
- THEN a real Supabase Auth session MUST be established and catalog screens MUST become reachable

### Requirement: Row Ownership
Every table (`prenda`, `outfit`, `tip`, and all three M:N join tables) MUST carry an ownership column (e.g. `user_id`) populated with the creating user's `auth.uid()`.

#### Scenario: New row is stamped with the creator's ownership
- GIVEN an authenticated owner creating any catalog row
- WHEN the row is inserted
- THEN its ownership column MUST equal that owner's `auth.uid()`

### Requirement: Deny-by-Default RLS
Row Level Security MUST be enabled on every table listed above. A table with RLS enabled and no matching policy MUST deny all access — this is the required starting posture for every migration, not an incidental default.

#### Scenario: Table with RLS enabled and no policy denies all access
- GIVEN a table that has RLS enabled but no SELECT/INSERT/UPDATE/DELETE policy defined yet
- WHEN any client (authenticated or not) queries it
- THEN zero rows MUST be returned and no write MUST succeed

#### Scenario: Owner can access only their own rows
- GIVEN an authenticated owner with an active session
- WHEN they query any catalog table
- THEN they MUST only see and be able to modify rows where the ownership column equals their `auth.uid()`

### Requirement: Zero Access for the Anonymous Client
A Supabase client holding only the public anon key, with no authenticated session, MUST be able to read or write zero rows on any of the six tables (`prenda`, `outfit`, `tip`, and the three join tables).

#### Scenario: Anon client SELECT returns nothing
- GIVEN a Supabase client configured with only the anon key and no session
- WHEN it issues a SELECT against any catalog table
- THEN it MUST receive zero rows

#### Scenario: Anon client INSERT/UPDATE/DELETE is rejected
- GIVEN a Supabase client configured with only the anon key and no session
- WHEN it attempts an INSERT, UPDATE, or DELETE against any catalog table
- THEN the operation MUST fail or affect zero rows

### Requirement: RLS Verified per Migration
Every migration that creates or alters a catalog table MUST be verified with both an authenticated client (own-row access works) and an anonymous client (zero access) before being marked complete.

#### Scenario: Migration checklist includes both access tests
- GIVEN a new migration adding RLS policies to a table
- WHEN the migration is marked done
- THEN evidence MUST exist that both the authenticated-owner case and the anonymous zero-access case were tested
