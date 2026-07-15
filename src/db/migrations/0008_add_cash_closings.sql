-- Custom SQL migration file, put your code below! --
ALTER TABLE expenses ADD COLUMN payment_method text;

CREATE TABLE cash_closings (
  id text PRIMARY KEY NOT NULL,
  closing_date integer NOT NULL,
  closed_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  zelle_expected real NOT NULL,
  zelle_actual real NOT NULL,
  binance_expected real NOT NULL,
  binance_actual real NOT NULL,
  efectivo_expected real NOT NULL,
  efectivo_actual real NOT NULL,
  bolivares_expected real NOT NULL,
  bolivares_actual real NOT NULL,
  notes text,
  created_at integer NOT NULL
);