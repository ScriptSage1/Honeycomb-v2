# Honeycomb presentation migration

## Audit and ownership

The web entry (`apps/web/src/main.ts`) boots `client/web`; `ui-renderer` owns the sole root mount and binds Cordis observables to React. `ui-layout/AppFrame` owns the resizable three-column solve and desktop caption accommodations. `ui-sidebar` owns navigation chrome, with workspace/session browsing and settings supplied through slots. These services and registration boundaries remain the application foundation.

`ui-conversation` owns the resident Lexical composer, draft persistence, command/reference triggers, submission admission, queue/steer/stop, and the conversation factory. `ui-chat` and `ui-trajectory` separately project recorded events and live chunks. Tool, approval, plan, goal, subagent, and deliverable plugins contribute their existing nodes and controls. The migration changes presentation rather than event interpretation or transport.

Uploads use `client/file-upload` (there is no `ui-file-upload` package in this checkout). `ui-attachment` presents upload progress/retry/removal, galleries, drop invitations, and focus-restoring image previews. `ui-model-selection` owns the shared provider directory used by the composer and slash command. `ui-sidebar-right` owns persistent, dockable files/browser/terminal/preview surfaces. `ui-settings` retains its registered pages and persistence.

Honeycomb's reference is `frontend/index.html`, `src/styles.css`, `src/logo.svg`, and the UI portions of `src/app.js`. Its document ingestion, citations, sovereign-link reporting, query service, and telemetry are not Harness capabilities and are not imported. Its brown/cream/gold palette, translucent surfaces, hex pattern, Palatino display stack, orbit rings, pixel bee, ambient drift, raised starter buttons, and drawer easing are the visual source.

## Mapping

| Honeycomb concept | Harness owner |
|---|---|
| Workbench/sidebar | Existing sidebar slots, sessions, workspaces, global panels |
| Conversation/composer | Existing conversation factory and Lexical input |
| Welcome/actions | Empty-session hero and existing draft/workspace actions |
| Context/documents | Dockable right sidebar, workspace files and previews |
| Evidence | Recorded tool results, deliverables and changed-file review |
| Trace | Existing trajectory view over actual execution events |
| Upload | Existing file intake, attachment rail, drop and retry flows |
| Meter | Actual session/workspace state; no invented throughput or load |
| Bee | Decorative identity with activity driven by Session.running |
| Settings | Existing settings panel, registered pages and controls |

## Validation plan

Run focused client tests for theme, layout, sidebar, conversation/composer, primitives, attachments, model selection and right panels. Run the repository build, typecheck and web build, then keyless web replay where the host supports it. Compare desktop and narrow browser layouts, keyboard focus, reduced motion, context panels and welcome/composer placement. Live model calls require a configured provider; no successful live-flow claim is inferred from compilation.
