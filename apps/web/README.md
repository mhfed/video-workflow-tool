# Web App

React + Vite review desk using local shadcn UI components. The Node server owns the local API and serves the production build; renderer implementation details remain behind the renderer adapters.

From the repository root:

```bash
npm run web
```

`npm run web` builds the client into `apps/web/dist` before starting the local server at `http://127.0.0.1:4173`.

Choose the renderer for a new production in its creation dialog. Existing productions expose their renderer beside the render actions; switching it preserves narration and illustrations while invalidating only rendered video, clips, and the final cut. The Settings dialog controls the default renderer for future productions.
