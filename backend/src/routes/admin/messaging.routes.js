import { Router } from "express";
import pool from "../../db/pool.js";
import { auth, checkPermission, isAdminMessagingLead, isUuidParam } from "../../middleware/auth.js";

const router = Router();

router.get("/api/admin/messaging/admins", auth, checkPermission("adminMessaging", "can_view"), async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT a.id, a.first_name, a.last_name, a.email, r.code AS role_code, r.name AS role_name
      FROM admin_users a
      INNER JOIN roles r ON r.id = a.role_id
      WHERE a.is_active = TRUE
      ORDER BY a.first_name ASC, a.last_name ASC, a.email ASC
    `);
    return res.json({
      data: result.rows.map((row) => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        roleCode: row.role_code,
        roleName: row.role_name,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/api/admin/messaging/announcements", auth, checkPermission("adminMessaging", "can_view"), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = 30;
    const offset = (page - 1) * pageSize;
    const [countResult, listResult] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM admin_announcements`),
      pool.query(
        `SELECT an.id, an.title, an.body, an.created_at,
                u.first_name AS author_first_name, u.last_name AS author_last_name, u.email AS author_email
         FROM admin_announcements an
         LEFT JOIN admin_users u ON u.id = an.author_id
         ORDER BY an.created_at DESC
         LIMIT $1 OFFSET $2`,
        [pageSize, offset],
      ),
    ]);
    return res.json({
      data: listResult.rows.map((row) => ({
        id: row.id,
        title: row.title || "",
        body: row.body,
        createdAt: row.created_at,
        author: row.author_first_name
          ? {
              firstName: row.author_first_name,
              lastName: row.author_last_name,
              email: row.author_email,
            }
          : null,
      })),
      pagination: {
        page,
        pageSize,
        total: countResult.rows[0].total,
        totalPages: Math.max(1, Math.ceil(countResult.rows[0].total / pageSize)),
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/api/admin/messaging/announcements", auth, checkPermission("adminMessaging", "can_view"), async (req, res, next) => {
  try {
    if (!isAdminMessagingLead(req)) {
      return res.status(403).json({ message: "Duyuru yayinlamak icin Super Admin veya Admin rolu gerekir." });
    }
    const body = String(req.body?.body || "").trim();
    const titleRaw = String(req.body?.title || "").trim();
    const title = titleRaw.length ? titleRaw : null;
    if (!body) return res.status(400).json({ message: "Duyuru metni zorunludur." });
    const ins = await pool.query(
      `INSERT INTO admin_announcements (title, body, author_id) VALUES ($1, $2, $3::uuid) RETURNING id, title, body, created_at, author_id`,
      [title, body, req.user.id],
    );
    const row = ins.rows[0];
    await writeActivityLog({
      req,
      action: "create",
      moduleName: "adminMessaging",
      entityId: row.id,
      newData: { type: "announcement", title: row.title },
    });
    return res.status(201).json({
      id: row.id,
      title: row.title || "",
      body: row.body,
      createdAt: row.created_at,
      authorId: row.author_id,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/api/admin/messaging/dm/threads", auth, checkPermission("adminMessaging", "can_view"), async (req, res, next) => {
  try {
    const me = req.user.id;
    const result = await pool.query(
      `SELECT t.id AS thread_id, t.last_message_at,
              o.id AS peer_id, o.first_name AS peer_first_name, o.last_name AS peer_last_name, o.email AS peer_email,
              r.code AS peer_role_code,
              lm.body AS last_body
       FROM admin_dm_threads t
       INNER JOIN admin_users o ON o.id = CASE WHEN t.user_low_id = $1::uuid THEN t.user_high_id ELSE t.user_low_id END
       INNER JOIN roles r ON r.id = o.role_id
       LEFT JOIN LATERAL (
         SELECT m.body FROM admin_dm_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1
       ) lm ON TRUE
       WHERE (t.user_low_id = $1::uuid OR t.user_high_id = $1::uuid)
       ORDER BY t.last_message_at DESC NULLS LAST, t.created_at DESC`,
      [me],
    );
    return res.json({
      data: result.rows.map((row) => ({
        threadId: row.thread_id,
        lastMessageAt: row.last_message_at,
        lastPreview: row.last_body ? String(row.last_body).slice(0, 160) : "",
        peer: {
          id: row.peer_id,
          firstName: row.peer_first_name,
          lastName: row.peer_last_name,
          email: row.peer_email,
          roleCode: row.peer_role_code,
        },
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/api/admin/messaging/dm/peers/:peerId/messages", auth, checkPermission("adminMessaging", "can_view"), async (req, res, next) => {
  try {
    const me = req.user.id;
    const peerId = String(req.params.peerId || "").trim();
    if (!isUuidParam(peerId)) return res.status(400).json({ message: "Gecersiz kullanici." });
    if (peerId === me) return res.status(400).json({ message: "Kendinize mesaj gonderemezsiniz." });
    const peerOk = await pool.query(`SELECT id FROM admin_users WHERE id = $1::uuid AND is_active = TRUE LIMIT 1`, [peerId]);
    if (!peerOk.rows[0]) return res.status(404).json({ message: "Kullanici bulunamadi." });
    const sorted = [me, peerId].sort();
    const threadResult = await pool.query(
      `SELECT id FROM admin_dm_threads WHERE user_low_id = $1::uuid AND user_high_id = $2::uuid LIMIT 1`,
      [sorted[0], sorted[1]],
    );
    const threadId = threadResult.rows[0]?.id;
    if (!threadId) return res.json({ data: [] });
    const messages = await pool.query(
      `SELECT m.id, m.body, m.created_at, m.sender_id,
              s.first_name AS sender_first_name, s.last_name AS sender_last_name
       FROM admin_dm_messages m
       INNER JOIN admin_users s ON s.id = m.sender_id
       WHERE m.thread_id = $1::uuid
       ORDER BY m.created_at ASC
       LIMIT 400`,
      [threadId],
    );
    return res.json({
      data: messages.rows.map((row) => ({
        id: row.id,
        body: row.body,
        createdAt: row.created_at,
        senderId: row.sender_id,
        sender: {
          firstName: row.sender_first_name,
          lastName: row.sender_last_name,
        },
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/api/admin/messaging/dm/peers/:peerId/messages", auth, checkPermission("adminMessaging", "can_view"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const me = req.user.id;
    const peerId = String(req.params.peerId || "").trim();
    const body = String(req.body?.body || "").trim();
    if (!isUuidParam(peerId)) return res.status(400).json({ message: "Gecersiz kullanici." });
    if (peerId === me) return res.status(400).json({ message: "Kendinize mesaj gonderemezsiniz." });
    if (!body) return res.status(400).json({ message: "Mesaj metni zorunludur." });
    const peerOk = await client.query(`SELECT id FROM admin_users WHERE id = $1::uuid AND is_active = TRUE LIMIT 1`, [peerId]);
    if (!peerOk.rows[0]) return res.status(404).json({ message: "Kullanici bulunamadi." });
    const sorted = [me, peerId].sort();
    await client.query("BEGIN");
    const threadIns = await client.query(
      `INSERT INTO admin_dm_threads (user_low_id, user_high_id, last_message_at)
       VALUES ($1::uuid, $2::uuid, NOW())
       ON CONFLICT (user_low_id, user_high_id) DO UPDATE SET last_message_at = EXCLUDED.last_message_at
       RETURNING id`,
      [sorted[0], sorted[1]],
    );
    const threadId = threadIns.rows[0].id;
    const msgIns = await client.query(
      `INSERT INTO admin_dm_messages (thread_id, sender_id, body) VALUES ($1::uuid, $2::uuid, $3) RETURNING id, body, created_at, sender_id`,
      [threadId, me, body],
    );
    await client.query("COMMIT");
    const m = msgIns.rows[0];
    return res.status(201).json({
      id: m.id,
      body: m.body,
      createdAt: m.created_at,
      senderId: m.sender_id,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return next(error);
  } finally {
    client.release();
  }
});

router.get("/api/admin/messaging/groups", auth, checkPermission("adminMessaging", "can_view"), async (req, res, next) => {
  try {
    const me = req.user.id;
    const result = await pool.query(
      `SELECT g.id, g.name, g.created_at, g.updated_at,
              (SELECT COUNT(*)::int FROM admin_chat_group_members m WHERE m.group_id = g.id) AS member_count
       FROM admin_chat_groups g
       INNER JOIN admin_chat_group_members mem ON mem.group_id = g.id AND mem.admin_user_id = $1::uuid
       ORDER BY g.updated_at DESC`,
      [me],
    );
    return res.json({
      data: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        memberCount: row.member_count,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/api/admin/messaging/groups", auth, checkPermission("adminMessaging", "can_view"), async (req, res, next) => {
  try {
    if (!isAdminMessagingLead(req)) {
      return res.status(403).json({ message: "Grup olusturmak icin Super Admin veya Admin rolu gerekir." });
    }
    const name = String(req.body?.name || "").trim();
    const memberIds = Array.isArray(req.body?.memberIds) ? req.body.memberIds.map((x) => String(x).trim()).filter(isUuidParam) : [];
    if (!name || name.length > 120) return res.status(400).json({ message: "Grup adi 1-120 karakter olmalidir." });
    const finalMembers = [...new Set([...memberIds, req.user.id])];
    if (finalMembers.length < 2) {
      return res.status(400).json({ message: "Gruba en az bir diger yonetici ekleyin." });
    }
    const active = await pool.query(`SELECT id FROM admin_users WHERE id = ANY($1::uuid[]) AND is_active = TRUE`, [finalMembers]);
    if (active.rows.length !== finalMembers.length) {
      return res.status(400).json({ message: "Bazi kullanicilar bulunamadi veya pasif." });
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const gIns = await client.query(
        `INSERT INTO admin_chat_groups (name, created_by_id, updated_at) VALUES ($1, $2::uuid, NOW()) RETURNING id, name, created_at, updated_at`,
        [name, req.user.id],
      );
      const gid = gIns.rows[0].id;
      for (const uid of finalMembers) {
        await client.query(`INSERT INTO admin_chat_group_members (group_id, admin_user_id) VALUES ($1::uuid, $2::uuid)`, [gid, uid]);
      }
      await writeActivityLog({ req, action: "create", moduleName: "adminMessaging", entityId: gid, newData: { type: "group", name } });
      await client.query("COMMIT");
      return res.status(201).json({
        id: gIns.rows[0].id,
        name: gIns.rows[0].name,
        createdAt: gIns.rows[0].created_at,
        updatedAt: gIns.rows[0].updated_at,
        memberCount: finalMembers.length,
      });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    return next(error);
  }
});

router.get("/api/admin/messaging/groups/:groupId/messages", auth, checkPermission("adminMessaging", "can_view"), async (req, res, next) => {
  try {
    const me = req.user.id;
    const groupId = String(req.params.groupId || "").trim();
    if (!isUuidParam(groupId)) return res.status(400).json({ message: "Gecersiz grup." });
    const mem = await pool.query(
      `SELECT 1 FROM admin_chat_group_members WHERE group_id = $1::uuid AND admin_user_id = $2::uuid LIMIT 1`,
      [groupId, me],
    );
    if (!mem.rows[0]) return res.status(403).json({ message: "Bu grubun uyesi degilsiniz." });
    const messages = await pool.query(
      `SELECT m.id, m.body, m.created_at, m.sender_id,
              s.first_name AS sender_first_name, s.last_name AS sender_last_name
       FROM admin_chat_group_messages m
       INNER JOIN admin_users s ON s.id = m.sender_id
       WHERE m.group_id = $1::uuid
       ORDER BY m.created_at ASC
       LIMIT 400`,
      [groupId],
    );
    return res.json({
      data: messages.rows.map((row) => ({
        id: row.id,
        body: row.body,
        createdAt: row.created_at,
        senderId: row.sender_id,
        sender: { firstName: row.sender_first_name, lastName: row.sender_last_name },
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/api/admin/messaging/groups/:groupId/messages", auth, checkPermission("adminMessaging", "can_view"), async (req, res, next) => {
  try {
    const me = req.user.id;
    const groupId = String(req.params.groupId || "").trim();
    const body = String(req.body?.body || "").trim();
    if (!isUuidParam(groupId)) return res.status(400).json({ message: "Gecersiz grup." });
    if (!body) return res.status(400).json({ message: "Mesaj metni zorunludur." });
    const mem = await pool.query(
      `SELECT 1 FROM admin_chat_group_members WHERE group_id = $1::uuid AND admin_user_id = $2::uuid LIMIT 1`,
      [groupId, me],
    );
    if (!mem.rows[0]) return res.status(403).json({ message: "Bu grubun uyesi degilsiniz." });
    const msgIns = await pool.query(
      `INSERT INTO admin_chat_group_messages (group_id, sender_id, body) VALUES ($1::uuid, $2::uuid, $3) RETURNING id, body, created_at, sender_id`,
      [groupId, me, body],
    );
    await pool.query(`UPDATE admin_chat_groups SET updated_at = NOW() WHERE id = $1::uuid`, [groupId]);
    const m = msgIns.rows[0];
    return res.status(201).json({
      id: m.id,
      body: m.body,
      createdAt: m.created_at,
      senderId: m.sender_id,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
