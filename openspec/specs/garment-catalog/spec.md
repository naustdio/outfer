# Garment Catalog Specification

## Purpose

Defines the `prenda` (garment) entity: its fields, derived availability, damage tracking, and CRUD lifecycle, including reverse lookups to linked outfits and tips.

## Requirements

### Requirement: Garment Fields
A `prenda` MUST record: `categoria`, `tipo_prenda` (FK to a `tipo_prenda` lookup table, not an enum), 1–3 `colores` (from a fixed color catalog), `talla`, `fecha_ingreso` (a date, user-editable at any time), `cantidad` (integer ≥ 1), `temporada` (multi-select), `favorito` (boolean), and `estado`.

#### Scenario: Create garment with minimum required colors
- GIVEN an authenticated owner filling the garment form
- WHEN they submit with `categoria`, `tipo_prenda`, exactly 1 color, `talla`, `cantidad`, and `estado` set
- THEN the garment is created and persisted

#### Scenario: Reject more than three colors
- GIVEN an authenticated owner editing a garment
- WHEN they attempt to attach a 4th color
- THEN the system MUST reject the operation

#### Scenario: Edit fecha_ingreso after creation
- GIVEN an existing garment
- WHEN the owner changes `fecha_ingreso` to an earlier or later date
- THEN the update MUST be accepted and persisted

### Requirement: Damage Tracking
A `prenda` MUST carry `necesita_reparacion` (boolean). WHEN `necesita_reparacion` is true, the system MUST require at least one `tipo_dano` value (array) and MAY store free-text `detalle_dano`. WHEN `necesita_reparacion` is false, `tipo_dano` and `detalle_dano` MUST be empty or ignored.

#### Scenario: Flagging damage requires a damage type
- GIVEN a garment with `necesita_reparacion = false`
- WHEN the owner sets `necesita_reparacion = true` without selecting any `tipo_dano`
- THEN the system MUST reject the save

#### Scenario: Clearing damage flag clears damage detail
- GIVEN a garment with `necesita_reparacion = true`, `tipo_dano = [manchas]`, `detalle_dano = "mancha en manga"`
- WHEN the owner sets `necesita_reparacion = false` and saves
- THEN `tipo_dano` and `detalle_dano` MUST no longer be treated as active damage data

### Requirement: Derived Availability
`prenda.disponible` MUST be a derived value computed from `estado`, never directly writable by any client operation.

#### Scenario: Availability follows estado
- GIVEN a garment whose `estado` marks it as available for use
- WHEN the garment is read
- THEN `disponible` MUST reflect that state without any prior direct write to `disponible`

#### Scenario: Direct write to disponible is rejected
- GIVEN any client request
- WHEN it attempts to set `disponible` directly (e.g., via an UPDATE on that column)
- THEN the system MUST reject or ignore the write, since `disponible` is not a writable column

### Requirement: Garment CRUD
The owner MUST be able to create, read, update, and delete a `prenda` through the UI, scoped to their own data (see `owner-access`).

#### Scenario: Delete a garment
- GIVEN an existing garment owned by the authenticated user
- WHEN the owner deletes it
- THEN the garment and its outfit/tip links MUST no longer appear in any list or detail view

### Requirement: Reverse Lookups on Garment Detail
A garment's detail view MUST list every outfit that currently links to it and every tip attached to it.

#### Scenario: Garment detail shows linked outfits and tips
- GIVEN a garment linked to two outfits and one tip
- WHEN the owner opens that garment's detail page
- THEN both outfits and the tip MUST be listed

#### Scenario: Garment with no links shows empty lists
- GIVEN a garment with no outfit or tip links
- WHEN the owner opens its detail page
- THEN both the outfits and tips sections MUST render as empty, not as an error
