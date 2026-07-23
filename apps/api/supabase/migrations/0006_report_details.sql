-- Issue #51: editable report metadata and saved recognition-review state.
--
-- Existing MVP rows remain readable: they receive the neutral display name
-- "Health report" and no printed report date. Metric confidence and
-- confirmation live in the existing jsonb payload; the API's shared schema
-- supplies `confidence: null`, `uncertaintyReason: null`, and
-- `confirmed: true` when reading legacy metric objects.

alter table health_report
  add column name text not null default 'Health report',
  add column report_date date;

alter table health_report
  add constraint health_report_name_length
    check (char_length(btrim(name)) between 1 and 120);
