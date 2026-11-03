# NPC-DataConverter - Agent Instructions

## Project Overview

NPC-DataConverter is a web-based structured data conversion application.

* Website: https://dataconverter.x0u0x.xyz
* Repository: https://github.com/newDDF/NPC-DataConverter

Core capabilities include multi-format conversion, single-file conversion, batch processing, nested JSON field management, SQL INSERT parsing and generation, editable code previews, and data inspection.

## Technology Stack

* Next.js 16, React 19, TypeScript
* Tailwind CSS 4
* Prism.js
* PapaParse, SheetJS (xlsx), js-yaml
* JSZip, Lucide React, react-grid-layout

Prefer existing dependencies. Do not add dependencies without a clear technical reason.

## Supported Formats

JSON, CSV, Excel (XLSX), XML, YAML, Markdown, and SQL.

Keep format detection, parsing, and serialization centralized in existing utility modules where practical.

## Project Structure

* `src/app/`: routes, layout, global styles, and main application page.
* `src/components/CodePreview.tsx`: editable code preview and syntax highlighting.
* `src/components/JsonFieldManager.tsx`: nested JSON field selection and ordering.
* `src/components/batch/`: batch conversion interface.
* `src/components/inspector/`: data inspection components.
* `src/hooks/useBatchTasks.ts`: batch task state and lifecycle.
* `src/lib/batch/`: batch conversion logic.
* `src/lib/json-fields/`: nested JSON field processing and filtering.
* `src/utils/parsers.ts`: format detection, parsing, and serialization.
* `src/utils/sql.ts`: SQL INSERT parsing and generation.
* `src/types/`: shared TypeScript definitions.

This is a high-level map, not an exhaustive listing. Inspect the actual source tree before creating files or changing module responsibilities.

## Critical Architecture Rules

### Keep Single-file and Batch Conversion Separate

Single-file conversion is the primary workflow. Batch conversion must remain a separate feature with its own components, hooks, and processing logic.

* Do not move the single-file conversion core into the batch feature.
* Do not make single-file conversion depend on batch-specific state.
* Reuse shared parsing and serialization utilities where appropriate.
* Keep batch-specific task management inside batch modules.
* Batch conversion must be removable without breaking single-file conversion.
* Avoid unnecessary coupling.

### Preserve Existing Conversion Behavior

Before changing parsing or serialization:

* Inspect the current implementation.
* Identify all affected formats.
* Preserve existing input and output behavior.
* Avoid unrelated conversion changes.
* Consider malformed input and empty datasets.

Do not replace working implementations with simplified alternatives that remove capabilities.

### Nested JSON Field Management

Preserve recursive support for nested objects and arrays, full-path identification of duplicate field names, field selection preferences, parent/descendant visibility behavior, nested filtering, same-level reordering, and schema merging across records and array elements.

Do not flatten nested JSON field behavior. Non-JSON formats should retain their existing field-management behavior.

### SQL Scope

SQL functionality focuses on INSERT statements. Supported capabilities include explicit column lists, multiple rows in VALUES clauses, schema-qualified table names, quoted identifiers, escaped strings, NULL, TRUE/FALSE, numeric values, configurable output table names, and optional formatting.

This is not a general-purpose SQL parser. Do not claim arbitrary SELECT, UPDATE, DELETE, subqueries, expressions, or database execution unless implemented and tested. The application does not connect to or execute queries against a database.

## UI and Design Guidelines

* Keep the interface clean, consistent, and responsive.
* Preserve existing light and dark theme behavior.
* Use the existing pink accent color: `#ff6be4`.
* Preserve established backgrounds, borders, spacing, and component styles unless a redesign is requested.
* Use Lucide React icons where appropriate.
* Avoid unnecessary visual effects.

### Code Preview

Preserve the existing preview layout and editable behavior. Maintain Prism.js highlighting and synchronization between editable text and highlighted presentation. Avoid visual regressions in input and output panels.

## Development Rules

* Use TypeScript and existing shared types/utilities.
* Avoid unnecessary dependencies and duplicated conversion logic.
* Keep components focused and maintainable.
* Handle errors explicitly; do not silently discard user data.
* Avoid unrelated refactoring during focused tasks.
* All source-code comments must be in English. Do not add Chinese comments.
* Use clear, descriptive names.

### File Editing

The project owner generally prefers copy-and-paste-ready terminal commands and complete file contents for replacements. Back up files before destructive modifications. Use Vim when explicitly requested.

## Validation

After code changes, run:

    npx tsc --noEmit
    npm run build

When relevant, also run `npm run lint`.

Do not claim validation passed unless the commands actually succeeded. Fix errors introduced by changes.

## Git Workflow

* Stay on the existing branch unless instructed otherwise.
* Do not create branches without permission.
* Do not commit or push unless explicitly requested.
* Do not delete backup files or directories.
* Do not include local backups in commits.
* Review `git status` before staging.
* Keep commits focused and descriptive.

## Change Workflow

1. Understand the requested change.
2. Inspect relevant files.
3. Identify dependencies and affected modules.
4. Briefly explain the plan.
5. Make the smallest appropriate change.
6. Run relevant validation.
7. Summarize changed files and results.

## Core Principles

Preserve working functionality, keep single-file conversion independent from batch conversion, treat nested JSON as structured data, keep SQL support within its implemented scope, prefer incremental improvements, and never invent features that do not exist in the source code.
