# ClassPulse

A Chrome extension and React dashboard to track Google Meet attendance and student status.

## Folder Map

- `dashboard/`: React dashboard for instructors.
- `docs/`: Project documentation.
- `extension/`: Chrome extension for students.
- `scripts/`: Helper scripts.
- `supabase/`: Supabase database migrations and configuration.

## Simulating Data

You can run a simulation script to mock students joining and sending heartbeats.

```bash
# Run simulation for a specific class code
npm run simulate -- --code PUP-4821

# Options:
# --count N (Number of students to simulate, default 12)
# --interval N (Heartbeat interval in seconds, default 5)
# --roster (Tries to claim names from the session's existing roster)
```

See `docs/` for more details.
