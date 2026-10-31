# Account import specification

## Supported files and limits

- CSV (`.csv`, `text/csv`) and XLSX (`.xlsx`,
  `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).
- Maximum file size: 5 MiB.
- Maximum: 500 data rows and 30 unique, non-empty columns.
- XLSX must contain exactly one worksheet. The header row is the first row.
- Only masked identifiers may be included. Do not upload passwords, broker credentials, or full
  demat identifiers.

Both browser affordances and the API enforce limits. The Worker parses and validates the uploaded
file; file type is checked using the request content type and extension, while malformed data,
invalid encoding, invalid workbook structure, extra rows, and invalid mappings are reported as
errors.

## Workflow

1. Select and upload a file.
2. The API parses the header row and returns a sample; no account records are created.
3. Map columns to holder name, broker, depository, masked demat identifier, and optional fields.
4. The API validates every row and checks duplicates within the file and against the user's
   existing records.
5. Review the complete report. Each row remains visible as ready, duplicate, or invalid with
   row-specific details. No row is silently discarded.
6. Confirm the preview. Ready rows are inserted atomically; duplicate and invalid rows remain
   visible in the report and are not imported.
7. Review import history and download a CSV report of rows with errors or warnings.

Duplicate detection uses the user's depository and normalized masked demat identifier. Duplicate
rows are warnings that require the user to review before confirming; they are excluded from
insertion. Invalid rows retain validation messages. If a database failure occurs during confirm,
the transaction rolls back without a partially imported batch.

## Retry and reversal

Every preview is stored as an owned import-history record. Confirmation locks and transitions the
preview in a transaction. Retrying an already-confirmed import returns its original result, so the
same batch cannot create accounts twice.

Reversal is available for confirmed imports only. It archives the created accounts when every
record remains unchanged and unarchived. If an account has been edited or already archived, the
whole reversal is rejected with a clear error; the application does not partially reverse or
delete account history.

## Accessibility

Column-mapping controls have explicit labels. The row preview identifies row number, result, and
validation details. Status changes are announced, and mobile layouts remain readable without
requiring horizontal scrolling for each row.
