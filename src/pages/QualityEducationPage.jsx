import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { qualityApi } from "../api/qualityApi";
import { resolvePublicImageUrl } from "../api/publicApi";
import { describeVideoSource, fixUploadedFileName, resolveAssetUrl } from "../utils/moduleResources";

const resourceKey = (item) => `${item.moduleId}:${item.id || item.resourceIndex}:${item.kind}`;

const qualityAboutItems = (value) => {
  const plain = String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .trim();
  if (!plain) return ["İçerik bilgisi yakında eklenecektir."];
  const lines = plain
    .split(/\r?\n|[•●▪]\s*|;\s+/)
    .map((item) => item.replace(/^[-–—]\s*/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;
  const sentences = plain.match(/[^.!?]+[.!?]?/g)?.map((item) => item.trim()).filter(Boolean) || [];
  return sentences.length > 1 ? sentences : [plain];
};

function QualityBrand() {
  return (
    <div className="quality-brand-lockup">
      <span className="quality-brand-lockup__logo">
        <img src="/Guzem-05.png" alt="" />
      </span>
      <span className="quality-brand-lockup__text">
        <strong>Gazi Üniversitesi</strong>
        <span>Kalite Eğitim Programı</span>
      </span>
    </div>
  );
}

function QualityWatermarkBackground() {
  return (
    <div className="quality-watermarks" aria-hidden="true">
      {Array.from({ length: 96 }, (_, index) => <span key={index}>GAZİ ÜNİVERSİTESİ</span>)}
    </div>
  );
}

const flattenResources = (modules = []) => {
  const rows = [];
  modules.forEach((moduleRow, moduleIndex) => {
    const resources = Array.isArray(moduleRow.resources) ? moduleRow.resources : [];
    resources.forEach((resource) => {
      rows.push({
        ...resource,
        moduleId: moduleRow.id,
        moduleTitle: moduleRow.title || `Modül ${moduleIndex + 1}`,
        moduleIndex,
        resourceIndex: resource.resourceIndex,
        locked: Boolean(moduleRow.locked || resource.locked),
      });
    });
    if (Array.isArray(moduleRow.items) && moduleRow.items.length) {
      rows.push({
        kind: "text",
        title: `${moduleRow.title || `Modül ${moduleIndex + 1}`} Notları`,
        items: moduleRow.items,
        moduleId: moduleRow.id,
        moduleTitle: moduleRow.title || `Modül ${moduleIndex + 1}`,
        moduleIndex,
        resourceIndex: -1,
        locked: Boolean(moduleRow.locked),
      });
    }
  });
  return rows;
};

function QualityLogin({ onLoggedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ldapConfigured, setLdapConfigured] = useState(true);

  useEffect(() => {
    qualityApi
      .getAuthStatus()
      .then((result) => setLdapConfigured(Boolean(result?.ldapConfigured)))
      .catch(() => setLdapConfigured(false));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await qualityApi.login({ username, password });
      await onLoggedIn();
    } catch (e) {
      setError(e.message || "Giriş yapılamadı.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="quality-entry">
      <section className="quality-login-card">
        <div className="quality-login-card__brand">
          <QualityBrand />
        </div>
        <div>
          <p className="quality-eyebrow">Gazi Üniversitesi Personel Girişi</p>
          <h1>Kalite Eğitim Platformu</h1>
          <p className="quality-muted">
            Bu alan yalnızca Gazi Üniversitesi LDAP hesabı ile giriş yapan personele açıktır.
          </p>
        </div>
        {!ldapConfigured ? (
          <div className="quality-notice">
            <i className="fa-solid fa-circle-info" aria-hidden />
            LDAP bağlantı bilgileri henüz yapılandırılmadı. Arayüz ve eğitim altyapısı hazırdır.
          </div>
        ) : null}
        <form onSubmit={submit} className="quality-login-form">
          <label>
            <span>LDAP kullanıcı adı</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </label>
          <label>
            <span>Şifre</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error ? <p className="quality-error">{error}</p> : null}
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "Giriş yapılıyor…" : "LDAP ile Giriş Yap"}
          </button>
        </form>
      </section>
    </main>
  );
}

function QualityTrackedVideo({ item, educationId, onStateUpdated }) {
  const videoRef = useRef(null);
  const lastTimeRef = useRef(Number(item.progress?.lastPositionSeconds) || 0);
  const rangeStartRef = useRef(null);
  const rangeEndRef = useRef(null);
  const savingRef = useRef(false);
  const objectUrlRef = useRef("");
  const [src, setSrc] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const source = useMemo(() => describeVideoSource(item), [item]);

  const flush = useCallback(
    async (video, force = false) => {
      if (!video || savingRef.current) return;
      const rangeStart = rangeStartRef.current;
      const rangeEnd = rangeEndRef.current;
      const rangeLength = rangeStart != null && rangeEnd != null ? rangeEnd - rangeStart : 0;
      if (!force && rangeLength < 4) return;
      rangeStartRef.current = null;
      rangeEndRef.current = null;
      savingRef.current = true;
      try {
        const result = await qualityApi.saveProgress(educationId, {
          moduleId: item.moduleId,
          resourceId: item.id,
          resourceIndex: item.resourceIndex,
          positionSeconds: video.currentTime || 0,
          durationSeconds: Number.isFinite(video.duration) ? video.duration : 0,
          watchedFromSeconds: rangeStart ?? video.currentTime ?? 0,
          watchedToSeconds: rangeEnd ?? video.currentTime ?? 0,
        });
        onStateUpdated(result);
      } catch (e) {
        if (rangeLength > 0) {
          rangeStartRef.current =
            rangeStartRef.current == null ? rangeStart : Math.min(rangeStart, rangeStartRef.current);
          rangeEndRef.current =
            rangeEndRef.current == null ? rangeEnd : Math.max(rangeEnd, rangeEndRef.current);
        }
        setError(e.message || "İlerleme kaydedilemedi.");
      } finally {
        savingRef.current = false;
      }
    },
    [educationId, item.id, item.moduleId, item.resourceIndex, onStateUpdated],
  );

  useEffect(() => {
    let cancelled = false;
    setError("");
    setLoading(true);
    if (source.type !== "file") {
      setSrc(source.src);
      setLoading(false);
      return undefined;
    }
    const mediaRequest = item.path
      ? qualityApi.getMedia(item.moduleId, item.id)
      : fetch(source.src, { cache: "force-cache" }).then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.blob();
        });
    mediaRequest
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setSrc(url);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSrc(source.src);
        setLoading(false);
      });
    return () => {
      cancelled = true;
      const video = videoRef.current;
      if (video && rangeStartRef.current != null) flush(video, true);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = "";
    };
  }, [flush, item.id, item.moduleId, item.path, source.src, source.type]);

  if (source.type === "none") return <div className="quality-player-empty">Video kaynağı bulunamadı.</div>;

  if (source.type === "embed" || source.type === "link") {
    return (
      <div className="quality-player-empty">
        <i className="fa-solid fa-triangle-exclamation" aria-hidden />
        <h3>İlerleme takibi için yüklenen video gerekli</h3>
        <p>
          Bu içerik harici bir video bağlantısı kullanıyor. %90 izlenme takibi için videoyu yönetim panelinden dosya olarak
          yükleyin.
        </p>
        <a href={source.src} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
          Videoyu aç
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="quality-player-empty">
        <i className="fa-solid fa-spinner fa-spin" aria-hidden />
        <p>Video hazırlanıyor…</p>
      </div>
    );
  }

  return (
    <div className="quality-video-stage">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={src}
        controls
        autoPlay
        playsInline
        controlsList="nodownload"
        onLoadedMetadata={(event) => {
          const resume = Math.min(
            Number(item.progress?.lastPositionSeconds) || 0,
            Math.max(0, event.currentTarget.duration - 1),
          );
          if (resume > 0) event.currentTarget.currentTime = resume;
          lastTimeRef.current = resume;
        }}
        onSeeking={(event) => {
          flush(event.currentTarget, true);
          lastTimeRef.current = event.currentTarget.currentTime || 0;
        }}
        onTimeUpdate={(event) => {
          const current = event.currentTarget.currentTime;
          const delta = current - lastTimeRef.current;
          const previous = lastTimeRef.current;
          lastTimeRef.current = current;
          if (!event.currentTarget.paused && delta > 0 && delta <= 2) {
            if (rangeStartRef.current == null) rangeStartRef.current = previous;
            rangeEndRef.current = current;
            flush(event.currentTarget);
          }
        }}
        onPause={(event) => flush(event.currentTarget, true)}
        onEnded={(event) => flush(event.currentTarget, true)}
      />
      {error ? <p className="quality-player-error">{error}</p> : null}
    </div>
  );
}

function QualityDocumentView({ item }) {
  const [href, setHref] = useState(() => (item.path ? "" : resolveAssetUrl(item.url)));
  const [error, setError] = useState("");
  const title = item.title || fixUploadedFileName(item.fileName) || "Doküman";

  useEffect(() => {
    if (!item.path) {
      setHref(resolveAssetUrl(item.url));
      return undefined;
    }
    let cancelled = false;
    let objectUrl = "";
    setHref("");
    setError("");
    qualityApi.getMedia(item.moduleId, item.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setHref(objectUrl);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message || "Doküman yüklenemedi.");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [item.id, item.moduleId, item.path, item.url]);

  if (error) return <div className="quality-player-empty">{error}</div>;
  if (!href) return <div className="quality-player-empty">Doküman hazırlanıyor…</div>;
  return (
    <div className="quality-document-stage">
      <header>
        <h2>{title}</h2>
        <a href={href} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
          Yeni sekmede aç
        </a>
      </header>
      <iframe title={title} src={`${href}#toolbar=1`} />
    </div>
  );
}

function QualityResourceView({ item, educationId, onStateUpdated }) {
  if (!item) return <div className="quality-player-empty">İçerik seçin.</div>;
  if (item.kind === "video") {
    return (
      <QualityTrackedVideo
        key={resourceKey(item)}
        item={item}
        educationId={educationId}
        onStateUpdated={onStateUpdated}
      />
    );
  }
  if (item.kind === "pdf") {
    return <QualityDocumentView key={resourceKey(item)} item={item} />;
  }
  return (
    <article className="quality-text-stage">
      <h2>{item.title || "Ders Notları"}</h2>
      {item.body ? <p>{item.body}</p> : null}
      {Array.isArray(item.items) && item.items.length ? (
        <ul>
          {item.items.map((text, index) => <li key={`${index}-${text}`}>{text}</li>)}
        </ul>
      ) : null}
    </article>
  );
}

function QualityLearningRoom({ state, onStateChange, onClose, onExam }) {
  const resources = useMemo(() => flattenResources(state.modules), [state.modules]);
  const firstAvailable = resources.find((item) => !item.locked && item.kind === "video" && !item.progress?.completed)
    || resources.find((item) => !item.locked)
    || null;
  const [activeKey, setActiveKey] = useState(firstAvailable ? resourceKey(firstAvailable) : "");
  const handleStateUpdated = useCallback(
    (result) => onStateChange((current) => ({ ...current, ...result })),
    [onStateChange],
  );
  const active = resources.find((item) => resourceKey(item) === activeKey && !item.locked) || firstAvailable;

  useEffect(() => {
    if (!active && firstAvailable) setActiveKey(resourceKey(firstAvailable));
  }, [active, firstAvailable]);

  return (
    <div className="quality-learning">
      <header className="quality-learning__topbar">
        <button type="button" className="quality-icon-btn" onClick={onClose} aria-label="Eğitime dön">
          <i className="fa-solid fa-arrow-left" />
        </button>
        <div>
          <strong>{state.course.title}</strong>
          <span>{state.completedVideoCount}/{state.videoCount} video tamamlandı</span>
        </div>
        <div className="quality-learning__progress">
          <span style={{ width: `${state.completionPercent}%` }} />
        </div>
        <button
          type="button"
          className="quality-icon-btn"
          onClick={() => document.documentElement.requestFullscreen?.()}
          aria-label="Tam ekran"
        >
          <i className="fa-solid fa-expand" />
        </button>
      </header>

      <div className="quality-learning__layout">
        <main className="quality-learning__main">
          <QualityResourceView
            item={active}
            educationId={state.course.id}
            onStateUpdated={handleStateUpdated}
          />
        </main>
        <aside className="quality-playlist">
          <div className="quality-playlist__head">
            <h2>Eğitim İçerikleri</h2>
            <span>%{state.completionPercent}</span>
          </div>
          {state.modules.map((moduleRow, moduleIndex) => (
            <section key={moduleRow.id} className="quality-playlist__module">
              <h3>
                <span>{String(moduleIndex + 1).padStart(2, "0")}</span>
                {moduleRow.title || `Modül ${moduleIndex + 1}`}
              </h3>
              {flattenResources([moduleRow]).map((item) => {
                const key = resourceKey(item);
                const selected = active && resourceKey(active) === key;
                return (
                  <button
                    type="button"
                    key={key}
                    className={`quality-playlist__item${selected ? " is-active" : ""}${item.locked ? " is-locked" : ""}`}
                    disabled={item.locked}
                    onClick={() => setActiveKey(key)}
                  >
                    <span className="quality-playlist__icon">
                      <i
                        className={
                          item.locked
                            ? "fa-solid fa-lock"
                            : item.kind === "video" && item.progress?.completed
                              ? "fa-solid fa-circle-check"
                              : item.kind === "video"
                                ? "fa-solid fa-play"
                                : item.kind === "pdf"
                                  ? "fa-regular fa-file-pdf"
                                  : "fa-regular fa-file-lines"
                        }
                      />
                    </span>
                    <span>
                      <strong>{item.title || (item.kind === "video" ? "Video Ders" : "Ders İçeriği")}</strong>
                      <small>
                        {item.kind === "video"
                          ? item.progress?.completed
                            ? "Tamamlandı"
                            : `%${item.progress?.percent || 0} izlendi`
                          : item.kind === "pdf"
                            ? "Doküman"
                            : "Okuma"}
                      </small>
                    </span>
                  </button>
                );
              })}
            </section>
          ))}
          <div className="quality-playlist__exam">
            <button type="button" className="btn" disabled={!state.examUnlocked} onClick={onExam}>
              <i className={`fa-solid ${state.examUnlocked ? "fa-clipboard-check" : "fa-lock"}`} /> Değerlendirme Sınavına Git
            </button>
            {!state.examUnlocked ? <small>Tüm videoları en az %90 izleyin.</small> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function QualityEducationPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [state, setState] = useState(null);
  const [learning, setLearning] = useState(false);
  const [error, setError] = useState("");
  const [examBusy, setExamBusy] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    const existing = document.querySelector('meta[name="robots"]');
    const previousContent = existing?.getAttribute("content");
    const meta = existing || document.createElement("meta");
    if (!existing) {
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "noindex,nofollow,noarchive");
    document.title = "Kalite Eğitim | Gazi Üniversitesi";
    return () => {
      document.title = previousTitle;
      if (existing && previousContent != null) existing.setAttribute("content", previousContent);
      else meta.remove();
    };
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profile, result] = await Promise.all([qualityApi.me(), qualityApi.getCourses()]);
      setUser(profile);
      const list = result.courses || [];
      setCourses(list);
      setSelectedId((current) => current || list[0]?.id || "");
    } catch (e) {
      if (e.status === 401) {
        qualityApi.logout();
        setUser(null);
        setCourses([]);
      } else {
        setError(e.message || "Kalite Eğitim alanı yüklenemedi.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (qualityApi.hasToken()) bootstrap();
    else setLoading(false);
  }, [bootstrap]);

  useEffect(() => {
    if (!selectedId || !user) {
      setState(null);
      return;
    }
    setLoading(true);
    qualityApi
      .getCourse(selectedId)
      .then(setState)
      .catch((e) => setError(e.message || "Eğitim yüklenemedi."))
      .finally(() => setLoading(false));
  }, [selectedId, user]);

  const openExam = async () => {
    if (!state?.examUnlocked) return;
    setExamBusy(true);
    setError("");
    try {
      const result = await qualityApi.getExamLink(state.course.id);
      if (!result.path) throw new Error("Sınav bağlantısı oluşturulamadı.");
      window.open(result.path, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e.message || "Sınav bağlantısı oluşturulamadı.");
    } finally {
      setExamBusy(false);
    }
  };

  if (!user && !loading) return <QualityLogin onLoggedIn={bootstrap} />;
  if (loading && !user) return <main className="quality-entry"><div className="quality-page-loader">Yükleniyor…</div></main>;
  if (learning && state) {
    return (
      <QualityLearningRoom
        state={state}
        onStateChange={setState}
        onClose={() => setLearning(false)}
        onExam={openExam}
      />
    );
  }

  const selectedSummary = courses.find((course) => course.id === selectedId);
  const aboutItems = qualityAboutItems(state?.course?.content || state?.course?.description);
  return (
    <main className="quality-portal">
      <QualityWatermarkBackground />
      <header className="quality-portal__header">
        <div className="quality-portal__brand">
          <QualityBrand />
        </div>
        <div className="quality-portal__nav-title">
          <i className="fa-solid fa-graduation-cap" aria-hidden />
          <span>Personel Gelişim Portalı</span>
        </div>
        <div className="quality-portal__user">
          <span className="quality-portal__avatar" aria-hidden>
            <i className="fa-regular fa-user" />
          </span>
          <span className="quality-portal__user-name">{user?.displayName || user?.username}</span>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              qualityApi.logout();
              setUser(null);
              setState(null);
            }}
          >
            Çıkış
          </button>
        </div>
      </header>

      <section className="quality-portal__body">
        {courses.length > 1 ? (
          <nav className="quality-course-tabs">
            {courses.map((course) => (
              <button
                key={course.id}
                type="button"
                className={course.id === selectedId ? "is-active" : ""}
                onClick={() => setSelectedId(course.id)}
              >
                {course.title}
              </button>
            ))}
          </nav>
        ) : null}
        {error ? <p className="quality-error">{error}</p> : null}
        {!loading && !courses.length ? (
          <div className="quality-empty">
            <i className="fa-regular fa-folder-open" />
            <h1>Henüz Kalite Eğitimi yayınlanmadı</h1>
          </div>
        ) : null}
        {state ? (
          <>
            <section className="quality-course-hero">
              <div className="quality-course-hero__content">
                <p className="quality-eyebrow">{state.course.category || "Kalite Eğitim"}</p>
                <h1>{state.course.title}</h1>
                <p>{state.course.description || "Bu eğitim için açıklama henüz eklenmedi."}</p>
                <div className="quality-course-hero__meta">
                  <span><i className="fa-regular fa-clock" /> {state.course.duration} Saat</span>
                  <span><i className="fa-solid fa-layer-group" /> {state.modules.length} modül</span>
                  <span><i className="fa-solid fa-play" /> {state.videoCount} video</span>
                </div>
                <button type="button" className="btn quality-start-btn" onClick={() => setLearning(true)}>
                  <i className="fa-solid fa-circle-play" /> Eğitim İçeriklerini İzle
                </button>
              </div>
              <div className="quality-course-hero__image">
                <img src={resolvePublicImageUrl(state.course.image)} alt={state.course.title} />
                <div className="quality-course-progress">
                  <div>
                    <strong>%{state.completionPercent}</strong>
                    <span>Tamamlandı</span>
                  </div>
                  <span className="quality-course-progress__track">
                    <span style={{ width: `${state.completionPercent}%` }} />
                  </span>
                </div>
              </div>
            </section>

            <section className="quality-course-info">
              <article>
                <h2>Eğitim Hakkında</h2>
                <p className="quality-about-intro">Bu eğitim kapsamında ele alınan başlıklar:</p>
                <ul className="quality-about-list">
                  {aboutItems.map((item, index) => (
                    <li key={`${index}-${item}`}>
                      <i className="fa-solid fa-check" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
              <aside>
                <h3>Eğitim Durumu</h3>
                <ul>
                  <li><span>Videolar</span><strong>{state.completedVideoCount}/{state.videoCount}</strong></li>
                  <li><span>İlerleme</span><strong>%{state.completionPercent}</strong></li>
                  <li><span>Sınav</span><strong>{state.examUnlocked ? "Hazır" : "Kilitli"}</strong></li>
                </ul>
                <button type="button" className="btn btn-outline" disabled={!state.examUnlocked || examBusy} onClick={openExam}>
                  {examBusy ? "Hazırlanıyor…" : "Değerlendirme Sınavı"}
                </button>
              </aside>
            </section>
          </>
        ) : selectedSummary && loading ? <div className="quality-page-loader">Eğitim yükleniyor…</div> : null}
      </section>
    </main>
  );
}
