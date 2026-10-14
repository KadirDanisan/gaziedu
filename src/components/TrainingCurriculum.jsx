import { useEffect, useMemo, useRef, useState } from "react";
import {
  countResourcesByKind,
  describeVideoSource,
  fixUploadedFileName,
  formatFileSize,
  resolveAssetUrl,
} from "../utils/moduleResources";

const PREVIEW_SECONDS = 30;

/** Eski kayıtlarda içerik modül üstündeki `items` alanındaydı; onu da bir metin bloğu gibi göster. */
function moduleBlocks(moduleRow) {
  const resources = Array.isArray(moduleRow?.resources) ? moduleRow.resources : [];
  const legacyItems = Array.isArray(moduleRow?.items) ? moduleRow.items.filter(Boolean) : [];
  if (!legacyItems.length) return resources;
  return [{ kind: "text", title: "", items: legacyItems, body: "" }, ...resources];
}

function extractExtension(value) {
  let raw = String(value || "").trim();
  if (!raw) return "";
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }
  raw = raw.split("?")[0].split("#")[0].replace(/\/+$/, "").toLowerCase();
  const match = raw.match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

function fileExtension(resource) {
  for (const value of [resource?.path, resource?.url, resource?.fileName]) {
    const ext = extractExtension(value);
    if (ext) return ext;
  }
  return "";
}

function isOfficeDocument(ext) {
  return ["ppt", "pptx", "doc", "docx", "xls", "xlsx"].includes(ext);
}

function isPdfResource(resource) {
  return fileExtension(resource) === "pdf";
}

function previewEmbedSrc(src) {
  try {
    const url = new URL(src);
    if (url.hostname.includes("youtube.com") || url.hostname.includes("youtube-nocookie.com")) {
      url.searchParams.set("start", "0");
      url.searchParams.set("end", String(PREVIEW_SECONDS));
    }
    return url.toString();
  } catch {
    return src;
  }
}

/**
 * OpenResty Range isteklerini 416 ile kesiyor; ileri sarma da Range kullanır.
 * Bu yüzden kendi sunucumuzdaki videoları Range'siz indirip blob URL ile oynatıyoruz.
 */
async function fetchVideoAsObjectUrl(url, { signal, onProgress } = {}) {
  const response = await fetch(url, { signal, cache: "force-cache" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const total = Number(response.headers.get("content-length")) || 0;
  if (!response.body || !response.body.getReader) {
    const blob = await response.blob();
    onProgress?.(100);
    return URL.createObjectURL(blob);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    if (total > 0) onProgress?.(Math.min(99, Math.round((received / total) * 100)));
  }
  onProgress?.(100);
  const blob = new Blob(chunks, { type: response.headers.get("content-type") || "video/mp4" });
  return URL.createObjectURL(blob);
}

function PreviewEndedOverlay({ onLoginClick }) {
  return (
    <div className="curriculum-player__notice curriculum-player__preview-end">
      <p>Önizleme süresi doldu. Videonun tamamı için giriş yapmanız gerekir.</p>
      {typeof onLoginClick === "function" ? (
        <button type="button" className="btn" onClick={onLoginClick}>
          Giriş yap
        </button>
      ) : null}
    </div>
  );
}

function VideoBlock({ resource, preview = false, onLoginClick }) {
  const [open, setOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [playback, setPlayback] = useState({ status: "idle", src: "", progress: 0 });
  const [previewEnded, setPreviewEnded] = useState(false);
  const objectUrlRef = useRef("");
  const videoRef = useRef(null);
  const source = useMemo(() => describeVideoSource(resource), [resource]);
  const title = resource.title || "Video ders";
  const needsBlobPlayback = source.type === "file" && !preview;
  const embedSrc = preview && source.type === "embed" ? previewEmbedSrc(source.src) : source.src;

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!open) setPreviewEnded(false);
  }, [open]);

  useEffect(() => {
    if (!open || !preview || source.type !== "embed") return undefined;
    const timer = window.setTimeout(() => setPreviewEnded(true), PREVIEW_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [open, preview, source.type, embedSrc]);

  useEffect(() => {
    if (!open || !needsBlobPlayback) return undefined;

    if (objectUrlRef.current) {
      setPlayback({ status: "ready", src: objectUrlRef.current, progress: 100 });
      return undefined;
    }

    const controller = new AbortController();
    setPlayback({ status: "loading", src: "", progress: 0 });

    fetchVideoAsObjectUrl(source.src, {
      signal: controller.signal,
      onProgress: (progress) => setPlayback((prev) => (prev.status === "loading" ? { ...prev, progress } : prev)),
    })
      .then((objectUrl) => {
        if (controller.signal.aborted) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        objectUrlRef.current = objectUrl;
        setPlayback({ status: "ready", src: objectUrl, progress: 100 });
      })
      .catch((error) => {
        if (error?.name === "AbortError") return;
        setPlayback({ status: "failed", src: "", progress: 0 });
      });

    return () => controller.abort();
  }, [open, needsBlobPlayback, source.src, reloadToken]);

  const clampPreviewTime = (el) => {
    if (!preview || !el) return;
    if (el.currentTime >= PREVIEW_SECONDS) {
      el.pause();
      el.currentTime = PREVIEW_SECONDS;
      setPreviewEnded(true);
    }
  };

  const retryBlobLoad = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = "";
    }
    setPlayback({ status: "idle", src: "", progress: 0 });
    setReloadToken((token) => token + 1);
  };

  if (source.type === "none") return null;

  if (source.type === "link") {
    if (preview) {
      return (
        <button type="button" className="curriculum-lesson curriculum-lesson--link" onClick={onLoginClick}>
          <span className="curriculum-lesson__icon curriculum-lesson__icon--video" aria-hidden>
            <i className="fa-solid fa-play" />
          </span>
          <span className="curriculum-lesson__body">
            <span className="curriculum-lesson__title">{title}</span>
            <span className="curriculum-lesson__meta">Harici bağlantı · Tamamı için giriş yapın</span>
          </span>
        </button>
      );
    }
    return (
      <a className="curriculum-lesson curriculum-lesson--link" href={source.src} target="_blank" rel="noopener noreferrer">
        <span className="curriculum-lesson__icon curriculum-lesson__icon--video" aria-hidden>
          <i className="fa-solid fa-play" />
        </span>
        <span className="curriculum-lesson__body">
          <span className="curriculum-lesson__title">{title}</span>
          <span className="curriculum-lesson__meta">Harici bağlantı</span>
        </span>
        <span className="curriculum-lesson__action" aria-hidden>
          <i className="fa-solid fa-arrow-up-right-from-square" />
        </span>
      </a>
    );
  }

  return (
    <div className={`curriculum-lesson-wrap${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="curriculum-lesson curriculum-lesson--video"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className="curriculum-lesson__icon curriculum-lesson__icon--video" aria-hidden>
          <i className={open ? "fa-solid fa-pause" : "fa-solid fa-play"} />
        </span>
        <span className="curriculum-lesson__body">
          <span className="curriculum-lesson__title">{title}</span>
          <span className="curriculum-lesson__meta">
            {preview
              ? `Önizleme · ilk ${PREVIEW_SECONDS} saniye`
              : `Video${resource.duration ? ` · ${resource.duration}` : ""}`}
          </span>
        </span>
        <span className="curriculum-lesson__action" aria-hidden>
          <i className={`fa-solid fa-chevron-${open ? "up" : "down"}`} />
        </span>
      </button>

      {open ? (
        <div className="curriculum-player">
          {previewEnded ? (
            <PreviewEndedOverlay onLoginClick={onLoginClick} />
          ) : source.type === "embed" ? (
            <iframe
              src={embedSrc}
              title={title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen={!preview}
            />
          ) : needsBlobPlayback && playback.status !== "ready" ? (
            playback.status === "failed" ? (
              <div className="curriculum-player__notice">
                <p>Video hazırlanamadı. Tekrar deneyin veya dosyayı indirin.</p>
                <button type="button" className="curriculum-player__retry" onClick={retryBlobLoad}>
                  Tekrar dene
                </button>
                <a href={source.src} target="_blank" rel="noopener noreferrer" download={fixUploadedFileName(resource.fileName) || undefined}>
                  Videoyu indir
                </a>
              </div>
            ) : (
              <div className="curriculum-player__notice curriculum-player__notice--spinner" aria-label="Yükleniyor">
                <i className="fa-solid fa-spinner fa-spin" aria-hidden />
              </div>
            )
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              ref={videoRef}
              key={playback.src || source.src}
              src={needsBlobPlayback ? playback.src : source.src}
              controls
              playsInline
              preload="auto"
              controlsList={preview ? "nodownload noplaybackrate" : undefined}
              disablePictureInPicture={preview || undefined}
              onContextMenu={preview ? (event) => event.preventDefault() : undefined}
              onTimeUpdate={(event) => clampPreviewTime(event.currentTarget)}
              onSeeked={(event) => clampPreviewTime(event.currentTarget)}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

function FilePreviewDialog({ resource, href, onClose, onLoginClick }) {
  const title = resource.title?.trim() || fixUploadedFileName(resource.fileName) || "PDF";
  const embedHref = `${href}#toolbar=0`;

  return (
    <div
      className="promo-video-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="training-file-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-preview-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="training-file-preview-dialog__head">
          <h2 id="file-preview-title">{title}</h2>
          <button type="button" className="promo-video-modal__close" aria-label="Kapat" onClick={onClose}>
            <i className="fa-solid fa-xmark" aria-hidden />
          </button>
        </header>
        <div className="training-file-preview-dialog__body">
          {embedHref ? (
            <iframe title={title} src={embedHref} />
          ) : (
            <div className="training-file-preview-dialog__fallback">
              <p>Bu sunum dosyası tarayıcıda önizlenemiyor. Tam erişim ve indirme için giriş yapın.</p>
            </div>
          )}
        </div>
        <footer className="training-file-preview-dialog__foot">
          <p>Önizleme modunda dosya indirilemez.</p>
          {typeof onLoginClick === "function" ? (
            <button type="button" className="btn" onClick={onLoginClick}>
              Giriş yap
            </button>
          ) : (
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Kapat
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function FileBlock({ resource, preview = false, onLoginClick }) {
  const href = resolveAssetUrl(resource.path || resource.url);
  const [previewOpen, setPreviewOpen] = useState(false);
  if (!href) return null;
  if (preview && !isPdfResource(resource)) return null;
  const downloadName = fixUploadedFileName(resource.fileName);
  const ext = fileExtension(resource);
  const title = resource.title?.trim() || (isOfficeDocument(ext) ? "Sunum" : "PDF");
  const meta = formatFileSize(resource.size);
  const icon = isOfficeDocument(ext) ? "fa-regular fa-file-powerpoint" : "fa-regular fa-file-pdf";

  if (preview) {
    return (
      <>
        <button type="button" className="curriculum-lesson curriculum-lesson--file" onClick={() => setPreviewOpen(true)}>
          <span className="curriculum-lesson__icon curriculum-lesson__icon--file" aria-hidden>
            <i className={icon} />
          </span>
          <span className="curriculum-lesson__body">
            <span className="curriculum-lesson__title">{title}</span>
            <span className="curriculum-lesson__meta">{meta ? `${meta} · Önizleme` : "Önizleme · indirme kapalı"}</span>
          </span>
          <span className="curriculum-lesson__action curriculum-lesson__action--download">
            <i className="fa-regular fa-eye" aria-hidden /> Görüntüle
          </span>
        </button>
        {previewOpen ? (
          <FilePreviewDialog
            resource={resource}
            href={href}
            onClose={() => setPreviewOpen(false)}
            onLoginClick={onLoginClick}
          />
        ) : null}
      </>
    );
  }

  return (
    <a
      className="curriculum-lesson curriculum-lesson--file"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download={downloadName || undefined}
    >
      <span className="curriculum-lesson__icon curriculum-lesson__icon--file" aria-hidden>
        <i className={icon} />
      </span>
      <span className="curriculum-lesson__body">
        <span className="curriculum-lesson__title">{title}</span>
        {meta ? <span className="curriculum-lesson__meta">{meta}</span> : null}
      </span>
      <span className="curriculum-lesson__action curriculum-lesson__action--download">
        <i className="fa-solid fa-download" aria-hidden /> İndir
      </span>
    </a>
  );
}

function TextBlock({ resource }) {
  const items = Array.isArray(resource.items) ? resource.items.filter(Boolean) : [];
  const body = String(resource.body ?? "").trim();
  if (!items.length && !body && !resource.title) return null;

  return (
    <div className="curriculum-text">
      {resource.title ? <p className="curriculum-text__title">{resource.title}</p> : null}
      {items.length ? (
        <ul className="training-detail-bullets">
          {items.map((item, index) => (
            <li key={`${index}-${item}`}>{item}</li>
          ))}
        </ul>
      ) : null}
      {body ? <p className="curriculum-text__body">{body}</p> : null}
    </div>
  );
}

function ModuleSection({ moduleRow, index, defaultOpen, locked = false, preview = false, onLoginClick }) {
  const [open, setOpen] = useState(Boolean(defaultOpen) && !locked);
  const blocks = useMemo(() => moduleBlocks(moduleRow), [moduleRow]);
  const counts = useMemo(() => countResourcesByKind(blocks), [blocks]);
  const title = moduleRow.title || `Modül ${index + 1}`;

  const metaParts = [];
  if (counts.video) metaParts.push(`${counts.video} video`);
  if (counts.pdf) metaParts.push(`${counts.pdf} doküman`);
  if (counts.text) metaParts.push(`${counts.text} okuma`);

  return (
    <section className={`curriculum-module${open && !locked ? " is-open" : ""}${locked ? " is-locked" : ""}`}>
      <button
        type="button"
        className="curriculum-module__head"
        onClick={() => {
          if (locked) return;
          setOpen((prev) => !prev);
        }}
        aria-expanded={locked ? false : open}
        aria-disabled={locked || undefined}
        disabled={locked}
      >
        <span className="curriculum-module__index" aria-hidden>
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="curriculum-module__heading">
          <span className="curriculum-module__title">{title}</span>
          <span className="curriculum-module__meta">
            {locked ? "Kilitli içerik" : preview ? "Önizleme" : metaParts.join(" · ") || "İçerik hazırlanıyor"}
          </span>
        </span>
        <span className="curriculum-module__chevron" aria-hidden>
          <i className={`fa-solid ${locked ? "fa-lock" : `fa-chevron-${open ? "up" : "down"}`}`} />
        </span>
      </button>

      {!locked && open ? (
        <div className="curriculum-module__body">
          {!blocks.length ? (
            <p className="training-detail-empty-note">Bu modülün içeriği henüz yayınlanmadı.</p>
          ) : (
            blocks.map((resource, blockIndex) => {
              const key = `${index}-${blockIndex}-${resource.kind}`;
              if (resource.kind === "video") {
                return <VideoBlock key={key} resource={resource} preview={preview} onLoginClick={onLoginClick} />;
              }
              if (resource.kind === "pdf") {
                return <FileBlock key={key} resource={resource} preview={preview} onLoginClick={onLoginClick} />;
              }
              return <TextBlock key={key} resource={resource} />;
            })
          )}
        </div>
      ) : null}
    </section>
  );
}

function TrainingCurriculum({
  modules = [],
  locked = false,
  lockStatus = "none",
  guestPreview = false,
  onLoginClick,
  onApplyClick,
  onExamPortalClick,
  examPortalBusy = false,
}) {
  const list = Array.isArray(modules) ? modules : [];

  const totals = useMemo(
    () =>
      list.reduce(
        (acc, moduleRow) => {
          const counts = countResourcesByKind(moduleBlocks(moduleRow));
          acc.video += counts.video;
          acc.pdf += counts.pdf;
          acc.text += counts.text;
          return acc;
        },
        { video: 0, pdf: 0, text: 0 },
      ),
    [list],
  );

  if (!list.length) return null;

  const hasPreviewLocks = !locked && list.some((moduleRow) => moduleRow.locked);
  const showingGuestPreview = guestPreview && !locked;

  const lockMessage =
    lockStatus === "pending"
      ? "Başvurunuz inceleniyor. Onaylandıktan sonra bu hesapla giriş yaparak müfredata erişebilirsiniz."
      : lockStatus === "unpaid"
        ? "Başvurunuz kaydedildi ancak ödemeniz tamamlanmadı. Ödemeyi tamamladıktan sonra başvurunuz incelemeye alınır."
        : lockStatus === "login"
        ? "Müfredata erişmek için oturum açmanız gerekir."
        : "Ücretli eğitim müfredatı, başvurunuz onaylandıktan ve başvuru yaptığınız hesapla giriş yaptıktan sonra açılır.";

  return (
    <div className={`curriculum${locked ? " curriculum--locked" : ""}`}>
      <div className="curriculum__head">
        <div>
          <h3>Eğitim Müfredatı</h3>
          <p className="curriculum__subtitle">
            {list.length} modül
            {!locked && totals.video ? ` · ${totals.video} video` : ""}
            {!locked && totals.pdf ? ` · ${totals.pdf} doküman` : ""}
            {!locked && totals.text ? ` · ${totals.text} okuma` : ""}
            {locked ? " · Erişim kilitli" : showingGuestPreview ? " · İlk modül önizleme" : ""}
          </p>
        </div>
        {!locked ? (
          <div className="curriculum__legend" aria-hidden>
            <span className="curriculum__legend-item">
              <i className="fa-solid fa-play" /> Video
            </span>
            <span className="curriculum__legend-item">
              <i className="fa-regular fa-file-pdf" /> Doküman
            </span>
            <span className="curriculum__legend-item">
              <i className="fa-regular fa-file-lines" /> Okuma
            </span>
          </div>
        ) : (
          <div className="curriculum__lock-badge" aria-hidden>
            <i className="fa-solid fa-lock" />
            Kilitli
          </div>
        )}
      </div>

      {locked ? (
        <div className="curriculum__lock-panel">
          <div className="curriculum__lock-icon" aria-hidden>
            <i className="fa-solid fa-lock" />
          </div>
          <p>{lockMessage}</p>
          <div className="curriculum__lock-actions">
            {typeof onLoginClick === "function" ? (
              <button type="button" className="btn btn-outline" onClick={onLoginClick}>
                Giriş yap
              </button>
            ) : null}
            {typeof onApplyClick === "function" && lockStatus !== "pending" && lockStatus !== "login" ? (
              <button type="button" className="btn" onClick={onApplyClick}>
                {lockStatus === "unpaid" ? "Ödemeyi Tamamla" : "Başvuru Formunu Doldur"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={`curriculum__list${locked ? " curriculum__list--locked" : ""}`} aria-hidden={locked || undefined}>
        {list.map((moduleRow, index) => {
          const moduleLocked = Boolean(locked || moduleRow.locked);
          const modulePreview = Boolean(guestPreview && !moduleLocked && (moduleRow.preview || index === 0));
          return (
            <ModuleSection
              key={moduleRow.id || `module-${index}`}
              moduleRow={moduleRow}
              index={index}
              defaultOpen={!moduleLocked && index === 0}
              locked={moduleLocked}
              preview={modulePreview}
              onLoginClick={onLoginClick}
            />
          );
        })}
      </div>

      {showingGuestPreview || hasPreviewLocks ? (
        <div className="curriculum__lock-panel">
          <div className="curriculum__lock-icon" aria-hidden>
            <i className="fa-solid fa-lock" />
          </div>
          <p>
            {showingGuestPreview
              ? `İlk modül önizlemedir: videonun yalnızca ilk ${PREVIEW_SECONDS} saniyesi izlenebilir; PDF dosyaları indirilemez, yalnızca görüntülenir. Sunum dosyaları giriş yapılmadan görünmez. Tam video, indirme ve diğer modüller için giriş yapmanız gerekir.`
              : lockStatus === "pending" || lockStatus === "unpaid" || lockStatus === "none"
                ? lockMessage
                : "Diğer modüllere erişmek için oturum açmanız gerekir."}
          </p>
          <div className="curriculum__lock-actions">
            {typeof onLoginClick === "function" ? (
              <button type="button" className="btn btn-outline" onClick={onLoginClick}>
                Giriş yap
              </button>
            ) : null}
            {typeof onApplyClick === "function" && lockStatus !== "pending" ? (
              <button type="button" className="btn" onClick={onApplyClick}>
                {lockStatus === "unpaid" ? "Ödemeyi Tamamla" : "Başvuru Formunu Doldur"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!locked && !hasPreviewLocks && !showingGuestPreview && typeof onExamPortalClick === "function" ? (
        <div className="curriculum__exam-cta">
          <p className="curriculum__exam-cta-text">Müfredatı tamamladıktan sonra sınava başlayabilirsiniz.</p>
          <button type="button" className="btn curriculum__exam-cta-btn" disabled={examPortalBusy} onClick={onExamPortalClick}>
            {examPortalBusy ? "Hazırlanıyor…" : "Sınav Portalına Git"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default TrainingCurriculum;
