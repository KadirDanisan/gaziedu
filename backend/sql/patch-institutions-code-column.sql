-- Uygulama DB kullanıcısı institutions tablosunun sahibi değilse migrateInstitutionCodeColumn atlanır.
-- Bir kez postgres süper kullanıcı ile çalıştırın; ardından tabloyu uygulama rolüne devredebilirsiniz.

ALTER TABLE institutions ADD COLUMN IF NOT EXISTS code TEXT;

-- İsteğe bağlı: uygulama kullanıcısına sahiplik (DATABASE_URL içindeki role göre değiştirin)
-- ALTER TABLE institutions OWNER TO gaziedu_app;
