<div align="center">

# NPC-DataConverter

### A Flexible Workspace for Structured Data Conversion

Convert, inspect, organize, and transform structured data across multiple formats.

[Live Demo](https://dataconverter.x0u0x.xyz) · [GitHub Repository](https://github.com/newDDF/NPC-DataConverter) · [Report an Issue](https://github.com/newDDF/NPC-DataConverter/issues)

</div>

* * *

## Overview

NPC-DataConverter is a web-based data conversion workspace designed to simplify structured data transformation.

It brings single-file conversion, batch processing, nested JSON field management, SQL conversion, and editable code previews together in one interface.

## Features

### Multi-format Conversion

| Format | File extension |
| --- | --- |
| JSON | `.json` |
| CSV | `.csv` |
| Excel | `.xlsx` |
| XML | `.xml` |
| YAML | `.yaml`, `.yml` |
| Markdown | `.md` |
| SQL | `.sql` |

Input formats can be detected automatically or selected manually.

### Single-file Conversion

* Import files or paste data directly.
* Select input and output formats.
* Preview source and converted data.
* Select fields to include in the output.
* Reorder fields where supported.
* Edit data in the code preview.
* Download converted results.

### Batch Conversion

* Add multiple files to a task queue.
* Track individual conversion statuses.
* Select the target output format.
* Preview individual conversion results.
* Download converted files separately.
* Manage batch tasks independently from single-file conversion.

### Nested JSON Field Management

* Navigate nested objects and arrays.
* Inspect fields at different nesting levels.
* Select or deselect individual fields.
* Manage parent and descendant field visibility.
* Preserve nested structures when filtering JSON data.
* Reorder fields within the same hierarchy level.
* Distinguish identically named fields through their full paths.
* Merge field structures across multiple records and array elements.

### SQL Conversion

Convert supported structured data into SQL INSERT statements, or parse supported INSERT statements into other formats.

* Explicit column lists.
* Multiple rows in VALUES clauses.
* Schema-qualified table names.
* Quoted identifiers and escaped strings.
* NULL, TRUE/FALSE, and numeric values.
* Configurable table names.
* Optional SQL formatting.

SQL conversion focuses on INSERT statements rather than general-purpose SQL parsing. The application does not connect to databases or execute SQL queries.

### Code Preview

* Prism.js-powered syntax highlighting.
* Highlighting for JSON, CSV, XML, YAML, Markdown, and SQL.
* Editable code preview.
* Synchronized editing and highlighted presentation.

## Live Demo

Try NPC-DataConverter online:

**https://dataconverter.x0u0x.xyz**

## Getting Started

### Requirements

* Node.js compatible with the installed Next.js version.
* npm.

### Clone the Repository

    git clone https://github.com/newDDF/NPC-DataConverter.git
    cd NPC-DataConverter

### Install Dependencies

    npm install

### Start the Development Server

    npm run dev

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

    npm run build

### Start the Production Server

    npm run start

## Development Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npx tsc --noEmit` | Check TypeScript types |

## Technology Stack

| Technology | Purpose |
| --- | --- |
| Next.js 16 | Application framework |
| React 19 | User interface |
| TypeScript | Type safety |
| Tailwind CSS 4 | Styling |
| Prism.js | Syntax highlighting |
| PapaParse | CSV processing |
| SheetJS (xlsx) | Excel processing |
| js-yaml | YAML processing |
| JSZip | ZIP archive utilities |
| Lucide React | Interface icons |
| react-grid-layout | Grid layout support |

## Project Structure

    npc-dataconverter/
    ├── public/
    ├── src/
    │   ├── app/
    │   ├── components/
    │   │   ├── batch/
    │   │   ├── inspector/
    │   │   ├── CodePreview.tsx
    │   │   └── JsonFieldManager.tsx
    │   ├── hooks/
    │   │   └── useBatchTasks.ts
    │   ├── lib/
    │   │   ├── batch/
    │   │   └── json-fields/
    │   ├── types/
    │   └── utils/
    │       ├── parsers.ts
    │       └── sql.ts
    ├── AGENTS.md
    ├── package.json
    └── README.md

This is a high-level overview; individual files and folders may evolve.

## Limitations

* SQL support focuses on supported INSERT statements.
* SQL statements are not executed against a database.
* Unsupported SQL syntax may not be parsed.
* Conversion results depend on the structure and validity of the input data.
* Some format-specific features may not have direct equivalents in other formats.

## Contributing

Suggestions, bug reports, and contributions are welcome.

For bug reports and feature requests, use [GitHub Issues](https://github.com/newDDF/NPC-DataConverter/issues).

For code contributions:

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Run relevant validation commands.
5. Submit a pull request with a clear description.

Please keep changes focused and preserve the separation between single-file and batch conversion workflows.

## License

No license has currently been specified for this repository. Please contact the repository owner regarding usage and redistribution permissions.

* * *

<div align="center">

**NPC-DataConverter**

Making structured data conversion simpler.

[Visit the Website](https://dataconverter.x0u0x.xyz)

</div>
