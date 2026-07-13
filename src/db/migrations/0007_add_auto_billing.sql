-- Custom SQL migration file, put your code below! --
ALTER TABLE users ADD COLUMN auto_billing_enabled integer DEFAULT 1 NOT NULL;
CREATE TABLE system_settings (
  key text PRIMARY KEY NOT NULL,
  value text NOT NULL,
  updated_at integer NOT NULL
);