import pool from "../../db/pool.js";

const VERIFICATION_STATUSES = ["pending", "verified", "rejected"];

const formatVerificationRow = (row) =>
  row
    ? {
        id: row.id,
        status: VERIFICATION_STATUSES.includes(row.status) ? row.status : "pending",
        verificationEmail: row.verification_email || "",
        educationId: row.education_id || null,
        verifiedAt: row.verified_at || null,
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
      }
    : null;

const getInstructorVerification = async (userId) => {
  const result = await pool.query(
    `SELECT id, status, verification_email, education_id, verified_at, created_at, updated_at
     FROM instructor_verifications
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );
  return formatVerificationRow(result.rows[0]);
};

const isInstructorVerified = async (userId) => (await getInstructorVerification(userId))?.status === "verified";

/** Erişim endpoint'inin döndürdüğü durum: verified | verification_pending | verification_rejected | verification_required */
const instructorAccessStatus = (verification) => {
  if (!verification) return "verification_required";
  if (verification.status === "verified") return "verified";
  if (verification.status === "rejected") return "verification_rejected";
  return "verification_pending";
};

export { getInstructorVerification, isInstructorVerified, instructorAccessStatus, formatVerificationRow };
