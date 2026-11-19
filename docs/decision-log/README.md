# Pending decision-log entries

Each file here is one decision waiting to be folded into [../DECISION-LOG.md](../DECISION-LOG.md). Name it `YYYY-MM-DD-short-name.md` and put exactly one table row in it: `| Date | Kind | Decision | Ref |`.

- `npm run decision-log` validates every entry and prints the pending rows with a count.
- `npm run decision-log -- --fold` appends them to the log and deletes these files. Run it on `main`, in a commit of its own.

`npm test` fails if any entry here is malformed. This README is skipped.
