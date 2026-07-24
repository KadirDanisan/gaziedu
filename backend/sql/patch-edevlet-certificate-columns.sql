-- ---------------------------------------------------------------------------
-- Sertifika listesi: e-Devlet işlendi + Excel export kolonları
-- Hata: column "edevlet_processed" of relation "exam_portal_best_scores" does not exist
--
-- Sunucuda:
--   sudo -u postgres psql -d gaziedu -v ON_ERROR_STOP=1 -f sql/patch-edevlet-certificate-columns.sql
-- (backend klasöründeyseniz)
-- ---------------------------------------------------------------------------

ALTER TABLE exam_portal_best_scores
  ADD COLUMN IF NOT EXISTS edevlet_processed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS exam_portal_best_scores_edevlet_processed_idx
  ON exam_portal_best_scores (edevlet_processed);

CREATE TABLE IF NOT EXISTS edevlet_excel_serial_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_serial BIGINT NOT NULL DEFAULT 4000003,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO edevlet_excel_serial_state (id, last_serial)
VALUES (1, 4000003)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE exam_portal_best_scores
  ADD COLUMN IF NOT EXISTS edevlet_excel_exported BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE exam_portal_best_scores
  ADD COLUMN IF NOT EXISTS edevlet_excel_row_id BIGINT;

ALTER TABLE exam_portal_best_scores
  ADD COLUMN IF NOT EXISTS edevlet_excel_uuid TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS exam_portal_best_scores_edevlet_excel_row_id_unique
  ON exam_portal_best_scores (edevlet_excel_row_id)
  WHERE edevlet_excel_row_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS exam_portal_best_scores_edevlet_excel_uuid_unique
  ON exam_portal_best_scores (edevlet_excel_uuid)
  WHERE edevlet_excel_uuid IS NOT NULL;

CREATE INDEX IF NOT EXISTS exam_portal_best_scores_edevlet_excel_exported_idx
  ON exam_portal_best_scores (edevlet_excel_exported);

-- Kontrol
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'exam_portal_best_scores'
  AND column_name IN (
    'edevlet_processed',
    'edevlet_excel_exported',
    'edevlet_excel_row_id',
    'edevlet_excel_uuid'
  )
ORDER BY column_name;
