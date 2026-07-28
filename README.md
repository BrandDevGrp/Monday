# Monday Workroom

A lightweight monday.com-inspired project board prototype for planning and tracking work.

## Run locally

```bash
npm start
```

Then open `http://127.0.0.1:4173/`.

## Checks

```bash
npm run check
```

## monday.com credentials

Keep monday.com API credentials out of Git. Add them only to a local `.env.local` file when integration work begins.

```bash
MONDAY_API_TOKEN=your_token_here
```

## LiveNet import

The app imports the LiveNet monday.com workspace at runtime through the local Node server. Workspace data is not committed to this public repository.
