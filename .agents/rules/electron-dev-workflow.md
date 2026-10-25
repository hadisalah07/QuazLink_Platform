# Rule: Electron & Compiled App Dev & Release Workflow

When modifying source code (`src/`) for a compiled local application (like an Electron app running from a `dist/` or `out/` folder), keep in mind that restarting the application alone does not compile the new changes.

## Development Workflow
1. Always run the compilation script (e.g., `npm run build` or `tsc`) to build the source code into the output directory.
2. Only after compilation should you test or instruct the user to test the GUI application (`npm run dev:gui` or similar).

## Production Release Workflow
1. **Never release without packaging**: Updating code or API version tags without running `npm run dist:exe` will leave client installers pointing to stale builds.
2. **Atomic Distribution Order**: Always compile binary installers and patches (`npm run dist:exe` + patch zip), upload to the production downloads storage (`/data/downloads/`), verify HTTP headers (`curl -I`), and ONLY THEN update the server release endpoints.

