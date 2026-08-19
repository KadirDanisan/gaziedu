import pool from "../../db/pool.js";

const publishDueEducationCalendarItems = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const due = await client.query(
      `SELECT *
       FROM education_calendar
       WHERE calendar_date <= NOW()
       ORDER BY calendar_date ASC
       FOR UPDATE`,
    );

    for (const item of due.rows) {
      await client.query(
        `INSERT INTO educations
          (name, institution_id, instructor_id, description, image_url, code, duration, content, content_doc_path, content_doc_name, category_id, topic_headings, sales_filter)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12::jsonb, '[]'::jsonb),$13)`,
        [
          item.education_name,
          item.institution_id,
          item.instructor_id,
          item.description,
          item.image_url,
          item.code,
          item.duration,
          item.content || null,
          item.content_doc_path,
          item.content_doc_name,
          item.category_id,
          item.topic_headings ? JSON.stringify(item.topic_headings) : null,
          item.sales_filter,
        ],
      );
      await client.query(`DELETE FROM education_calendar WHERE id = $1`, [item.id]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    // eslint-disable-next-line no-console
    console.error("Education calendar publish failed:", error.message);
  } finally {
    client.release();
  }
};

export { publishDueEducationCalendarItems };
