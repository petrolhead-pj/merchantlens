# Local replay API

Run `npm run backend` for the development API on loopback port 3001. Vite proxies /api. The exhibition command `npm run stall` serves both the built interface and the same API on port 4173. Replay state is in memory for one exhibition station. Use a separate process per laptop.

GET /api/health, /api/scenarios (example metadata), /api/capabilities and /api/replay inspect the local process. POST JSON to /api/replay for a synthetic payment or checkout record, /api/replay/decision for a reasoned analyst action, and /api/replay/reset to clear the station. Invalid input returns 400 without changing state. Immediate serial application on Node's event loop provides local ordering; a durable production queue is proposed. Browser-only mode uses the same transition functions.
