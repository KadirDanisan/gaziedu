import JSZip from "jszip";
import { fetchCertificateRowContext } from "../exam/adminQueries.js";
import { allocateCertificateDocumentNumber } from "./serial.js";
import { resolveCertificateEducationLanguage } from "../../utils/nationalId.js";

const getIstanbulDayMonth = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  return day && month ? `${day}-${month}` : "sertifikalar";
};

/**
 * Seçili kayıtlardan ayrı PDF'ler üretir ve ZIP döner.
 * Dosya adları: {tc}.pdf — ZIP adı: 24-07.zip
 */
export async function buildCertificateBulkZip(ids = []) {
  const uniqueIds = [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || "").trim()).filter(Boolean))];
  if (!uniqueIds.length) {
    const error = new Error("Toplu indirme için en az bir kayıt seçin.");
    error.statusCode = 400;
    throw error;
  }

  const { buildCertificatePdf } = await import("../../certificatePdf.js");
  const { buildCertificateBilingualFields } = await import("../../certificateTranslation.js");

  const zip = new JSZip();
  const usedNames = new Set();
  const failures = [];
  const skipped = [];
  let successCount = 0;

  for (const id of uniqueIds) {
    try {
      const row = await fetchCertificateRowContext(id);
      if (!row) {
        failures.push({ id, message: "Kayıt bulunamadı veya sertifika için uygun değil." });
        continue;
      }
      if (row.edevlet_processed === true) {
        skipped.push({ id, nationalId: row.national_id, message: "E-devlete işlenmiş." });
        continue;
      }

      const participantName = String(row.participant_name || "").trim();
      const birthInfo = resolveCertificateEducationLanguage(row.participant_country);
      const educationCategory = String(row.education_category || "").trim() || "—";
      const bilingual = await buildCertificateBilingualFields({
        educationName: row.education_name || row.education_code,
        educationCategory,
        examTargetDifficulty: row.exam_target_difficulty,
      });
      const documentNumber = await allocateCertificateDocumentNumber(row.id);
      const { pdfBytes } = await buildCertificatePdf({
        id: row.id,
        nationalId: row.national_id,
        fullName: participantName || "—",
        birthInfo,
        educationCode: row.education_code,
        educationName: bilingual.educationNameLine,
        educationCategory: bilingual.educationCategoryLine,
        level: bilingual.levelLine,
        issuePlace: "Gazi Üniversitesi\nUzaktan Eğitim Uyg.\nve Arş. Merkezi",
        controlDate: row.best_recorded_at,
        programStartDate: row.education_created_at,
        programEndDate: row.last_attempt_at,
        duration: row.education_duration,
        documentNumber,
      });

      const tc = String(row.national_id || "").replace(/\D/g, "") || `kayit-${id.slice(0, 8)}`;
      let fileName = `${tc}.pdf`;
      if (usedNames.has(fileName.toLowerCase())) {
        fileName = `${tc}_${successCount + 1}.pdf`;
      }
      usedNames.add(fileName.toLowerCase());
      zip.file(fileName, pdfBytes);
      successCount += 1;
    } catch (error) {
      failures.push({ id, message: error?.message || "Sertifika oluşturulamadı." });
    }
  }

  if (!successCount) {
    const detail = [...skipped, ...failures]
      .slice(0, 5)
      .map((item) => item.message)
      .join(" · ");
    const error = new Error(detail || "Hiçbir sertifika PDF'i oluşturulamadı.");
    error.statusCode = 400;
    error.failures = failures;
    error.skipped = skipped;
    throw error;
  }

  const zipBytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return {
    zipBytes,
    fileName: `${getIstanbulDayMonth()}.zip`,
    successCount,
    failures,
    skipped,
  };
}
