# Unified Search Specification

## Purpose

Defines a single search query that spans `prenda`, `outfit`, and `tip`, returning results grouped by type, always scoped by the searching owner's RLS visibility.

## Requirements

### Requirement: Cross-Entity Search
The system MUST support one search query returning matching results from `prenda`, `outfit`, and `tip` in a single operation, grouped by entity type.

#### Scenario: Query matches across all three types
- GIVEN garments, outfits, and tips exist that each contain the search term
- WHEN the owner searches for that term
- THEN the results MUST include matches from all three types, grouped by type

#### Scenario: Query with no matches returns empty groups, not an error
- GIVEN no entity contains the search term
- WHEN the owner searches for it
- THEN the system MUST return an empty result set (empty groups) rather than an error

#### Scenario: Query matching only one type omits or empties the others
- GIVEN the search term matches only tips
- WHEN the owner searches for it
- THEN the prenda and outfit groups MUST be empty while the tip group contains the matches

### Requirement: Search Respects Ownership Scope
Search results MUST only include rows the authenticated searcher owns, enforced the same way as every other query (via RLS, not application-level filtering alone).

#### Scenario: Search never returns another user's data
- GIVEN a search term that matches data belonging to a different user
- WHEN the current owner searches for it
- THEN the results MUST NOT include that other user's rows, because RLS restricts the underlying query
