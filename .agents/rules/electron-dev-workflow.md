# Rule: Electron & Compiled App Dev Workflow

When modifying source code (`src/`) for a compiled local application (like an Electron app running from a `dist/` or `out/` folder), keep in mind that restarting the application alone does not compile the new changes.

## Instructions
1. Always run the compilation script (e.g., `npm run build` or `tsc`) to build the source code into the output directory.
2. Only after compilation should you instruct the user to restart the GUI application (`npm run dev:gui` or similar).
