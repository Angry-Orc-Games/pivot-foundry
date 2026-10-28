export const CURRENT_SCHEMA_VERSION = 1;
export const LEGACY_SCHEMA_VERSION = 0;
export const SCHEMA_MIGRATION_ID = "M001";
export const SHEET_V2_SCHEMA_VERSION = 2;

/**
 * Versions M001 reads without a "newer than supported" error.
 * Explicit stamps (legacy, current, sheet-v2) so bumping a version constant fails
 * tests until this set is updated in the same change.
 */
export const ACCEPTED_SCHEMA_VERSIONS: ReadonlySet<number> = new Set([0, 1, 2]);
