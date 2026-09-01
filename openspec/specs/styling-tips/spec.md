# Styling Tips Specification

## Purpose

Defines the `tip` entity and its dual many-to-many attachment to both `outfit` and `prenda`.

## Requirements

### Requirement: Tip Fields and CRUD
A `tip` MUST record at least a text body. The owner MUST be able to create, read, update, and delete tips, scoped to their own data.

#### Scenario: Create a standalone tip
- GIVEN an authenticated owner
- WHEN they create a tip with no outfit or garment attached
- THEN the tip is created and appears in the tips list

#### Scenario: Delete a tip
- GIVEN an existing tip attached to one outfit and one garment
- WHEN the owner deletes the tip
- THEN it MUST no longer appear in the tips list, the outfit's tip list, or the garment's tip list

### Requirement: Dual Attachment
A tip MUST be attachable to zero or more outfits and zero or more garments independently — the two relations are separate M:N join tables, not mutually exclusive.

#### Scenario: Attach a tip to both an outfit and a garment
- GIVEN an existing tip
- WHEN the owner attaches it to one outfit and one garment
- THEN both attachments MUST coexist and each entity's detail view MUST show the tip

#### Scenario: Detach from one relation leaves the other intact
- GIVEN a tip attached to both an outfit and a garment
- WHEN the owner detaches it from the garment only
- THEN the garment's tip list MUST no longer include it, while the outfit's tip list MUST still include it
