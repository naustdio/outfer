# Outfit Composition Specification

## Purpose

Defines the `outfit` entity: garment links (M:N to `prenda`), and its two derived, never-writable values — `estado` and `nombre_sugerido`.

## Requirements

### Requirement: Outfit Fields
An `outfit` MUST record a name (user-provided or defaulted to `nombre_sugerido`), an optional `imagen_inspiracion`, its derived `estado`, and its set of linked garments.

#### Scenario: Create outfit with linked garments
- GIVEN an authenticated owner creating an outfit
- WHEN they link two existing garments and save
- THEN the outfit is created with both garments linked

### Requirement: Derived Outfit Status
`outfit.estado` MUST be one of `Disponible`, `Incompleto`, or `Sin prendas`, computed from the current availability (`prenda.disponible`) of its linked garments, and MUST NOT be directly writable.

#### Scenario: All linked garments available yields Disponible
- GIVEN an outfit linked to garments that are all currently `disponible = true`
- WHEN the outfit is read
- THEN `estado` MUST be `Disponible`

#### Scenario: Some linked garments unavailable yields Incompleto
- GIVEN an outfit with at least one linked garment `disponible = false` and at least one `disponible = true`
- WHEN the outfit is read
- THEN `estado` MUST be `Incompleto`

#### Scenario: No linked garments yields Sin prendas
- GIVEN an outfit with zero linked garments
- WHEN the outfit is read
- THEN `estado` MUST be `Sin prendas`

#### Scenario: Estado updates when a linked garment's availability changes
- GIVEN an outfit with `estado = Disponible`
- WHEN one of its linked garments transitions to `disponible = false`
- THEN re-reading the outfit MUST return `estado = Incompleto` without any explicit outfit update

#### Scenario: Direct write to estado is rejected
- GIVEN any client request
- WHEN it attempts to set `outfit.estado` directly
- THEN the system MUST reject or ignore the write

### Requirement: Derived Suggested Name
`outfit.nombre_sugerido` MUST be derived from the distinct `tipo_prenda` values of the outfit's currently linked garments, and MUST NOT be directly writable.

#### Scenario: Suggested name reflects distinct garment types
- GIVEN an outfit linked to a "camisa" and a "pantalon"
- WHEN `nombre_sugerido` is computed
- THEN it MUST be derived from the distinct set {camisa, pantalon}

#### Scenario: Suggested name updates when links change
- GIVEN an outfit whose `nombre_sugerido` reflects its current links
- WHEN a garment of a new `tipo_prenda` is linked to the outfit
- THEN re-reading `nombre_sugerido` MUST reflect the updated distinct set

### Requirement: Outfit CRUD and Garment Linking
The owner MUST be able to create, read, update, and delete outfits, and to link/unlink garments to/from an outfit, scoped to their own data.

#### Scenario: Unlink a garment from an outfit
- GIVEN an outfit linked to a garment
- WHEN the owner unlinks that garment
- THEN the outfit's link list, `estado`, and `nombre_sugerido` MUST reflect the removal on next read

#### Scenario: Delete an outfit
- GIVEN an existing outfit
- WHEN the owner deletes it
- THEN it MUST no longer appear in any list, and its garment/tip links MUST be removed
