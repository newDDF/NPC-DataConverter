# NPC-DataConverter — Agent Handoff

## Project
- Repository: `npc-dataconverter`
- Local path: `/Users/ddf/github/npc-dataconverter`
- Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- Current branch: `main`

## Current Development

Implemented a nested JSON field management system.

### New files
- `src/lib/json-fields/index.ts`
- `src/components/JsonFieldManager.tsx`

### Modified file
- `src/app/page.tsx`

### Features
1. Recursive JSON field tree.
2. Nested Object and Array field navigation.
3. Focus mode for individual nested levels.
4. Independent field selection state.
5. Parent deselection hides the entire descendant subtree without destroying child preferences.
6. Merged field schemas across multiple records and array elements.
7. Same-name fields distinguished by complete paths.
8. Recursive JSON filtering that preserves nested structures.
9. Same-level drag-and-drop ordering.
10. JSON field selection and ordering should trigger live output preview updates.
11. Non-JSON output formats retain the original flat field management interface.

## Known Implementation Details

- JSON tree ordering is stored in the node arrays.
- `filterJsonRows()` uses node order when constructing output objects.
- Array child paths use `[]`, for example `orders[].amount`.
- Ancestor selection checks need to handle array path notation correctly.
- Automatic conversion effect must depend on `jsonFieldTree` and `jsonFieldSelection`.

## Verification Required

Before committing:
- Run `npx tsc --noEmit`.
- Run `npm run build`.
- Test parent/child selection restoration.
- Test array field selection.
- Test drag ordering at root and nested levels.
- Test JSON live preview.
- Test CSV and other flat-field output modes.

## Git Workflow

- Keep changes on `main` unless explicitly requested otherwise.
- Do not remove backup files.
- Do not perform unrelated refactoring.
- Commit only after successful verification.
- Push to the configured `origin` remote.

## Next Steps

1. Verify current implementation.
2. Fix any TypeScript/build/runtime issues.
3. Test JSON nested selection and drag sorting.
4. Commit the verified changes.
5. Push to origin.
