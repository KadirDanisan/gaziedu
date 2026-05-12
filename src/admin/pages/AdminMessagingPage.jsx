import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminApi } from "../api";
import { useAdminAuth } from "../context/AdminAuthContext";

const fmtShort = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(d);
};

const displayName = (u) => [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim() || u?.email || "—";

export default function AdminMessagingPage() {
  const { session } = useAdminAuth();
  const myId = session?.user?.id;
  const canLead = ["superadmin", "admin"].includes(session?.user?.roleCode);

  const [section, setSection] = useState("announce");
  const [error, setError] = useState("");
  const [admins, setAdmins] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [annPage, setAnnPage] = useState(1);
  const [annTotalPages, setAnnTotalPages] = useState(1);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annSending, setAnnSending] = useState(false);

  const [dmThreads, setDmThreads] = useState([]);
  const [dmPeer, setDmPeer] = useState(null);
  const [dmMessages, setDmMessages] = useState([]);
  const [dmDraft, setDmDraft] = useState("");
  const [dmSending, setDmSending] = useState(false);
  const [dmMobilePane, setDmMobilePane] = useState("list");
  const [dmPickerOpen, setDmPickerOpen] = useState(false);

  const [groups, setGroups] = useState([]);
  const [groupActive, setGroupActive] = useState(null);
  const [groupMessages, setGroupMessages] = useState([]);
  const [groupDraft, setGroupDraft] = useState("");
  const [groupSending, setGroupSending] = useState(false);
  const [groupMobilePane, setGroupMobilePane] = useState("list");
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMemberIds, setNewGroupMemberIds] = useState(() => new Set());
  const [groupCreating, setGroupCreating] = useState(false);
  const [announceModalOpen, setAnnounceModalOpen] = useState(false);

  const dmEndRef = useRef(null);
  const grpEndRef = useRef(null);

  const loadAdmins = useCallback(async () => {
    const res = await adminApi.getMessagingAdmins();
    setAdmins(res.data || []);
  }, []);

  const loadAnnouncements = useCallback(async () => {
    const res = await adminApi.getMessagingAnnouncements(annPage);
    setAnnouncements(res.data || []);
    setAnnTotalPages(res.pagination?.totalPages || 1);
  }, [annPage]);

  const loadDmThreads = useCallback(async () => {
    const res = await adminApi.getMessagingDmThreads();
    setDmThreads(res.data || []);
  }, []);

  const loadDmMessages = useCallback(async (peerId) => {
    if (!peerId) return;
    const res = await adminApi.getMessagingDmMessages(peerId);
    setDmMessages(res.data || []);
  }, []);

  const loadGroups = useCallback(async () => {
    const res = await adminApi.getMessagingGroups();
    setGroups(res.data || []);
  }, []);

  const loadGroupMessages = useCallback(async (gid) => {
    if (!gid) return;
    const res = await adminApi.getMessagingGroupMessages(gid);
    setGroupMessages(res.data || []);
  }, []);

  useEffect(() => {
    loadAdmins().catch((e) => setError(e.message));
  }, [loadAdmins]);

  useEffect(() => {
    if (section === "announce") loadAnnouncements().catch((e) => setError(e.message));
  }, [section, annPage, loadAnnouncements]);

  useEffect(() => {
    if (section === "dm") loadDmThreads().catch((e) => setError(e.message));
  }, [section, loadDmThreads]);

  useEffect(() => {
    if (section === "groups") loadGroups().catch((e) => setError(e.message));
  }, [section, loadGroups]);

  useEffect(() => {
    if (dmPeer?.id) loadDmMessages(dmPeer.id).catch((e) => setError(e.message));
  }, [dmPeer?.id, loadDmMessages]);

  useEffect(() => {
    if (groupActive?.id) loadGroupMessages(groupActive.id).catch((e) => setError(e.message));
  }, [groupActive?.id, loadGroupMessages]);

  useEffect(() => {
    dmEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dmMessages]);

  useEffect(() => {
    grpEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [groupMessages]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (section === "dm") {
        loadDmThreads().catch(() => {});
        if (dmPeer?.id) loadDmMessages(dmPeer.id).catch(() => {});
      }
      if (section === "groups") {
        loadGroups().catch(() => {});
        if (groupActive?.id) loadGroupMessages(groupActive.id).catch(() => {});
      }
      if (section === "announce") loadAnnouncements().catch(() => {});
    };
    const id = setInterval(tick, 6000);
    return () => clearInterval(id);
  }, [section, dmPeer?.id, groupActive?.id, loadAnnouncements, loadDmThreads, loadDmMessages, loadGroups, loadGroupMessages]);

  const peersForPicker = useMemo(() => admins.filter((a) => a.id !== myId), [admins, myId]);

  const openDmWith = (peer) => {
    setDmPeer(peer);
    setDmMobilePane("chat");
    setDmPickerOpen(false);
  };

  const sendDm = async () => {
    const text = dmDraft.trim();
    if (!text || !dmPeer?.id) return;
    setDmSending(true);
    setError("");
    try {
      await adminApi.postMessagingDmMessage(dmPeer.id, text);
      setDmDraft("");
      await loadDmMessages(dmPeer.id);
      await loadDmThreads();
    } catch (e) {
      setError(e.message || "Gönderilemedi.");
    } finally {
      setDmSending(false);
    }
  };

  const sendAnnouncement = async () => {
    const body = annBody.trim();
    if (!body) return;
    setAnnSending(true);
    setError("");
    try {
      const payload = { body };
      if (annTitle.trim()) payload.title = annTitle.trim();
      await adminApi.postMessagingAnnouncement(payload);
      setAnnBody("");
      setAnnTitle("");
      setAnnounceModalOpen(false);
      await loadAnnouncements();
    } catch (e) {
      setError(e.message || "Yayınlanamadı.");
    } finally {
      setAnnSending(false);
    }
  };

  const openAnnounceModal = () => {
    setAnnTitle("");
    setAnnBody("");
    setAnnounceModalOpen(true);
  };

  const sendGroup = async () => {
    const text = groupDraft.trim();
    if (!text || !groupActive?.id) return;
    setGroupSending(true);
    setError("");
    try {
      await adminApi.postMessagingGroupMessage(groupActive.id, text);
      setGroupDraft("");
      await loadGroupMessages(groupActive.id);
      await loadGroups();
    } catch (e) {
      setError(e.message || "Gönderilemedi.");
    } finally {
      setGroupSending(false);
    }
  };

  const createGroup = async () => {
    const name = newGroupName.trim();
    const memberIds = [...newGroupMemberIds];
    if (!name) return;
    setGroupCreating(true);
    setError("");
    try {
      await adminApi.postMessagingGroup({ name, memberIds });
      setNewGroupName("");
      setNewGroupMemberIds(new Set());
      setGroupModalOpen(false);
      await loadGroups();
    } catch (e) {
      setError(e.message || "Grup oluşturulamadı.");
    } finally {
      setGroupCreating(false);
    }
  };

  const toggleGroupMember = (id) => {
    setNewGroupMemberIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <section className="admin-page admin-messaging-page">
      <div className="admin-page-head">
        <div>
          <h2>Yönetici sohbeti</h2>
          <p>
            Tüm yöneticiler duyuruları görür. Özel mesajlar yalnızca ilgili kişiler arasındadır. Gruplarda üyeler birlikte yazışır.
            Duyuru ve grup oluşturma <strong>Süper Admin</strong> ve <strong>Admin</strong> rollerine aittir.
          </p>
        </div>
      </div>

      {error ? <p className="admin-form-error">{error}</p> : null}

      <div className="admin-messaging-tabs" role="tablist" aria-label="Sohbet bölümleri">
        <button
          type="button"
          role="tab"
          aria-selected={section === "announce"}
          className={section === "announce" ? "is-active" : ""}
          onClick={() => setSection("announce")}
        >
          <i className="fa-solid fa-bullhorn" aria-hidden />
          Duyurular
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === "dm"}
          className={section === "dm" ? "is-active" : ""}
          onClick={() => {
            setSection("dm");
            setDmMobilePane(dmPeer ? "chat" : "list");
          }}
        >
          <i className="fa-solid fa-user-group" aria-hidden />
          Mesajlar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === "groups"}
          className={section === "groups" ? "is-active" : ""}
          onClick={() => {
            setSection("groups");
            setGroupMobilePane(groupActive ? "chat" : "list");
          }}
        >
          <i className="fa-solid fa-users" aria-hidden />
          Gruplar
        </button>
      </div>

      {section === "announce" ? (
        <div className="admin-messaging-announce">
          <div className="admin-messaging-announce-toolbar">
            <p className="admin-messaging-announce-lead">
              <i className="fa-solid fa-circle-info" aria-hidden />
              En yeni duyuru üstte listelenir.
            </p>
            <div className="admin-messaging-announce-actions">
              <button type="button" className="btn btn-outline admin-messaging-announce-refresh" onClick={() => loadAnnouncements().catch((e) => setError(e.message))}>
                <i className="fa-solid fa-rotate-right" aria-hidden /> Yenile
              </button>
              {canLead ? (
                <button type="button" className="btn btn--modal-primary admin-messaging-announce-publish-btn" onClick={openAnnounceModal}>
                  <i className="fa-solid fa-bullhorn" aria-hidden />
                  Duyuru yayınla
                </button>
              ) : null}
            </div>
          </div>

          <div className="admin-messaging-feed admin-messaging-feed--announce">
            {announcements.length === 0 ? (
              <p className="admin-messaging-empty">Henüz duyuru yok.</p>
            ) : (
              announcements.map((a) => (
                <article key={a.id} className="admin-messaging-announce-card">
                  <div className="admin-messaging-announce-card__logo" aria-hidden="true">
                    <img src="/Gazi_Üniversitesi_logo.png" alt="" />
                  </div>
                  <div className="admin-messaging-announce-card__strip" aria-hidden="true" />
                  <div className="admin-messaging-announce-card__inner">
                    <header className="admin-messaging-announce-card__head">
                      <span className="admin-messaging-announce-card__badge">
                        <i className="fa-solid fa-bullhorn" aria-hidden />
                        Duyuru
                      </span>
                      <time dateTime={a.createdAt}>{fmtShort(a.createdAt)}</time>
                    </header>
                    {a.title ? <h3 className="admin-messaging-announce-card__title">{a.title}</h3> : null}
                    <p className="admin-messaging-announce-card__body">{a.body}</p>
                    <footer className="admin-messaging-announce-card__footer">
                      <span className="admin-messaging-announce-card__author">
                        <i className="fa-solid fa-user-pen" aria-hidden />
                        {a.author ? displayName(a.author) : "Bilinmeyen"}
                      </span>
                    </footer>
                  </div>
                </article>
              ))
            )}
          </div>
          {annTotalPages > 1 ? (
            <div className="admin-messaging-pager">
              <button type="button" className="btn btn-outline" disabled={annPage <= 1} onClick={() => setAnnPage((p) => p - 1)}>
                Önceki
              </button>
              <span>
                {annPage} / {annTotalPages}
              </span>
              <button type="button" className="btn btn-outline" disabled={annPage >= annTotalPages} onClick={() => setAnnPage((p) => p + 1)}>
                Sonraki
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {section === "dm" ? (
        <div className={`admin-messaging-split ${dmMobilePane === "chat" ? "is-chat-open" : ""}`}>
          <aside className="admin-messaging-sidebar">
            <div className="admin-messaging-sidebar-head">
              <h3>Sohbetler</h3>
              <button type="button" className="btn btn-outline admin-messaging-new-btn" onClick={() => setDmPickerOpen(true)}>
                <i className="fa-solid fa-plus" /> Yeni
              </button>
            </div>
            <ul className="admin-messaging-thread-list">
              {dmThreads.map((t) => (
                <li key={t.threadId}>
                  <button
                    type="button"
                    className={dmPeer?.id === t.peer.id ? "is-active" : ""}
                    onClick={() => {
                      openDmWith(t.peer);
                    }}
                  >
                    <span className="admin-messaging-avatar">{displayName(t.peer).slice(0, 1).toUpperCase()}</span>
                    <span className="admin-messaging-thread-meta">
                      <strong>{displayName(t.peer)}</strong>
                      <small>{t.lastPreview || "—"}</small>
                    </span>
                    <time>{fmtShort(t.lastMessageAt)}</time>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="admin-messaging-chat">
            {!dmPeer ? (
              <div className="admin-messaging-chat-empty">
                <i className="fa-solid fa-message" aria-hidden />
                <p>Bir sohbet seçin veya yeni mesaj başlatın.</p>
              </div>
            ) : (
              <>
                <header className="admin-messaging-chat-header">
                  <button type="button" className="admin-messaging-back" onClick={() => setDmMobilePane("list")} aria-label="Geri">
                    <i className="fa-solid fa-chevron-left" />
                  </button>
                  <span className="admin-messaging-avatar admin-messaging-avatar--lg">{displayName(dmPeer).slice(0, 1).toUpperCase()}</span>
                  <div>
                    <strong>{displayName(dmPeer)}</strong>
                    <small>{dmPeer.email}</small>
                  </div>
                </header>
                <div className="admin-messaging-bubbles">
                  {dmMessages.map((m) => {
                    const mine = m.senderId === myId;
                    return (
                      <div key={m.id} className={`admin-messaging-bubble-row ${mine ? "is-mine" : ""}`}>
                        <div className="admin-messaging-bubble">
                          {!mine ? <span className="admin-messaging-bubble-name">{displayName(m.sender)}</span> : null}
                          <p>{m.body}</p>
                          <time>{fmtShort(m.createdAt)}</time>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={dmEndRef} />
                </div>
                <footer className="admin-messaging-inputbar">
                  <textarea
                    placeholder="Mesaj yazın…"
                    value={dmDraft}
                    onChange={(e) => setDmDraft(e.target.value)}
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendDm();
                      }
                    }}
                  />
                  <button type="button" className="btn btn--success-fill" disabled={dmSending || !dmDraft.trim()} onClick={sendDm}>
                    {dmSending ? "…" : <i className="fa-solid fa-paper-plane" aria-label="Gönder" />}
                  </button>
                </footer>
              </>
            )}
          </div>
        </div>
      ) : null}

      {section === "groups" ? (
        <div className={`admin-messaging-split ${groupMobilePane === "chat" ? "is-chat-open" : ""}`}>
          <aside className="admin-messaging-sidebar">
            <div className="admin-messaging-sidebar-head">
              <h3>Gruplar</h3>
              {canLead ? (
                <button type="button" className="btn btn-outline admin-messaging-new-btn" onClick={() => setGroupModalOpen(true)}>
                  <i className="fa-solid fa-users-gear" /> Grup
                </button>
              ) : null}
            </div>
            <ul className="admin-messaging-thread-list">
              {groups.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    className={groupActive?.id === g.id ? "is-active" : ""}
                    onClick={() => {
                      setGroupActive(g);
                      setGroupMobilePane("chat");
                    }}
                  >
                    <span className="admin-messaging-avatar admin-messaging-avatar--group">
                      <i className="fa-solid fa-users" />
                    </span>
                    <span className="admin-messaging-thread-meta">
                      <strong>{g.name}</strong>
                      <small>{g.memberCount} üye</small>
                    </span>
                    <time>{fmtShort(g.updatedAt)}</time>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="admin-messaging-chat">
            {!groupActive ? (
              <div className="admin-messaging-chat-empty">
                <i className="fa-solid fa-comments" aria-hidden />
                <p>Bir grup seçin.</p>
              </div>
            ) : (
              <>
                <header className="admin-messaging-chat-header">
                  <button type="button" className="admin-messaging-back" onClick={() => setGroupMobilePane("list")} aria-label="Geri">
                    <i className="fa-solid fa-chevron-left" />
                  </button>
                  <span className="admin-messaging-avatar admin-messaging-avatar--lg admin-messaging-avatar--group">
                    <i className="fa-solid fa-users" />
                  </span>
                  <div>
                    <strong>{groupActive.name}</strong>
                    <small>{groupActive.memberCount} üye</small>
                  </div>
                </header>
                <div className="admin-messaging-bubbles">
                  {groupMessages.map((m) => {
                    const mine = m.senderId === myId;
                    return (
                      <div key={m.id} className={`admin-messaging-bubble-row ${mine ? "is-mine" : ""}`}>
                        <div className="admin-messaging-bubble">
                          {!mine ? <span className="admin-messaging-bubble-name">{displayName(m.sender)}</span> : null}
                          <p>{m.body}</p>
                          <time>{fmtShort(m.createdAt)}</time>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={grpEndRef} />
                </div>
                <footer className="admin-messaging-inputbar">
                  <textarea
                    placeholder="Gruba mesaj…"
                    value={groupDraft}
                    onChange={(e) => setGroupDraft(e.target.value)}
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendGroup();
                      }
                    }}
                  />
                  <button type="button" className="btn btn--success-fill" disabled={groupSending || !groupDraft.trim()} onClick={sendGroup}>
                    {groupSending ? "…" : <i className="fa-solid fa-paper-plane" aria-label="Gönder" />}
                  </button>
                </footer>
              </>
            )}
          </div>
        </div>
      ) : null}

      {announceModalOpen ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && !annSending && setAnnounceModalOpen(false)}
        >
          <div
            className="admin-modal admin-modal--detail admin-messaging-announce-modal"
            style={{ maxWidth: 520 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="announce-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="admin-modal__header admin-modal__header--detail">
              <div className="admin-modal__header-text">
                <h3 id="announce-modal-title" className="admin-modal__title">
                  Duyuru yayınla
                </h3>
                <p className="admin-modal__subtitle">Tüm yöneticiler bu duyuruyu görecek. Metin zorunludur.</p>
              </div>
              <button type="button" className="admin-modal__close" onClick={() => !annSending && setAnnounceModalOpen(false)} aria-label="Kapat" disabled={annSending}>
                ×
              </button>
            </header>
            <div className="admin-modal__body">
              <label className="admin-messaging-label">
                Başlık <small style={{ fontWeight: 500, color: "#64708d" }}>(isteğe bağlı)</small>
                <input
                  type="text"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  maxLength={200}
                  placeholder="Örn. Sistem bakımı"
                  disabled={annSending}
                />
              </label>
              <label className="admin-messaging-label" style={{ marginTop: 12 }}>
                Duyuru metni
                <textarea
                  placeholder="Duyuru metnini buraya yazın…"
                  value={annBody}
                  onChange={(e) => setAnnBody(e.target.value)}
                  rows={6}
                  disabled={annSending}
                />
              </label>
            </div>
            <footer className="admin-modal__footer">
              <button type="button" className="btn btn-outline btn--modal-secondary" onClick={() => !annSending && setAnnounceModalOpen(false)}>
                Vazgeç
              </button>
              <button type="button" className="btn btn--modal-primary" disabled={annSending || !annBody.trim()} onClick={sendAnnouncement}>
                {annSending ? "…" : "Yayınla"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {dmPickerOpen ? (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setDmPickerOpen(false)}>
          <div className="admin-modal admin-modal--detail" style={{ maxWidth: 420 }} role="dialog" aria-modal onMouseDown={(e) => e.stopPropagation()}>
            <header className="admin-modal__header admin-modal__header--detail">
              <div className="admin-modal__header-text">
                <h3 className="admin-modal__title">Yönetici seç</h3>
                <p className="admin-modal__subtitle">Özel mesaj göndermek için bir kişi seçin.</p>
              </div>
              <button type="button" className="admin-modal__close" onClick={() => setDmPickerOpen(false)} aria-label="Kapat">
                ×
              </button>
            </header>
            <div className="admin-modal__body" style={{ maxHeight: "60vh", overflow: "auto" }}>
              <ul className="admin-messaging-picker">
                {peersForPicker.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => openDmWith(a)}>
                      <span className="admin-messaging-avatar">{displayName(a).slice(0, 1).toUpperCase()}</span>
                      <span>
                        <strong>{displayName(a)}</strong>
                        <small>
                          {a.email} · {a.roleName}
                        </small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {groupModalOpen ? (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setGroupModalOpen(false)}>
          <div className="admin-modal admin-modal--detail" style={{ maxWidth: 480 }} role="dialog" aria-modal onMouseDown={(e) => e.stopPropagation()}>
            <header className="admin-modal__header admin-modal__header--detail">
              <div className="admin-modal__header-text">
                <h3 className="admin-modal__title">Yeni grup</h3>
                <p className="admin-modal__subtitle">Grup adı verin; en az bir yönetici seçin (siz otomatik eklenirsiniz).</p>
              </div>
              <button type="button" className="admin-modal__close" onClick={() => setGroupModalOpen(false)} aria-label="Kapat">
                ×
              </button>
            </header>
            <div className="admin-modal__body">
              <label className="admin-messaging-label">
                Grup adı
                <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} maxLength={120} placeholder="Örn. Proje A" />
              </label>
              <p className="admin-messaging-label" style={{ marginTop: 12 }}>
                Üyeler
              </p>
              <ul className="admin-messaging-checklist">
                {peersForPicker.map((a) => (
                  <li key={a.id}>
                    <label>
                      <input type="checkbox" checked={newGroupMemberIds.has(a.id)} onChange={() => toggleGroupMember(a.id)} />
                      <span>
                        {displayName(a)} <small>{a.roleName}</small>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            <footer className="admin-modal__footer">
              <button type="button" className="btn btn-outline btn--modal-secondary" onClick={() => setGroupModalOpen(false)}>
                Vazgeç
              </button>
              <button type="button" className="btn btn--modal-primary" disabled={groupCreating || !newGroupName.trim()} onClick={createGroup}>
                {groupCreating ? "…" : "Oluştur"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </section>
  );
}
