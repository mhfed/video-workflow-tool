# Web App

React + Vite AI directing room using local shadcn UI components. The Node server owns the local API and serves the production build; renderer implementation details remain behind the renderer adapters.

From the repository root:

```bash
npm run web
```

`npm run web` builds the client into `apps/web/dist` before starting the local server at `http://127.0.0.1:4173`.

Choose the renderer for a new production in its creation dialog. Existing productions expose their renderer beside the render actions; switching it preserves narration and illustrations while invalidating only rendered video, clips, and the final cut. The Settings dialog controls the default renderer for future productions.

Inside a project, the v2 workspace combines storyboard, best-available preview,
Director proposals, focused scene editing, and the cut timeline. Natural-language
Director requests are planned before mutation and list the affected stages. Mock
mode provides deterministic local proposals, keeping the complete review loop
available without API access.

Provider Settings can connect the owner's ChatGPT subscription without opening a terminal. The server runs Codex App Server locally, the UI opens the official ChatGPT sign-in URL, and connection status updates automatically. Selecting **ChatGPT subscription** uses the authenticated Codex CLI only for writing, semantic scene planning, and Director proposals; image and voice providers remain independently configurable.
