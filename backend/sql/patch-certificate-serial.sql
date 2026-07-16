-- Sıralı sertifika belge numarası (UN_041243C00001, UN_041243C00002, …)

CREATE TABLE IF NOT EXISTS certificate_serial_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_serial BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO certificate_serial_state (id, last_serial)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE exam_portal_best_scores ADD COLUMN IF NOT EXISTS document_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS exam_portal_best_scores_document_number_unique
  ON exam_portal_best_scores (document_number)
  WHERE document_number IS NOT NULL;
