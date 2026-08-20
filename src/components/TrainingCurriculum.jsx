import { useEffect, useMemo, useRef, useState } from "react";
import {
  countResourcesByKind,
  describeVideoSource,
  fixUploadedFileName,
  formatFileSize,
  resolveAssetUrl,
} from "../utils/moduleResources";

/** Eski kayıtlarda içerik modül üstündeki `items` alanındaydı; onu da bir metin bloğu gibi göster. */
function moduleBlocks(moduleRow) {
  const resources = Array.isArray(moduleRow?.resources) ? moduleRow.resources : [];
  const legacyItems = Array.isArray(moduleRow?.items) ? moduleRow.items.filter(Boolean) : [];
  if (!legacyItems.length) return resources;
  return [{ kind: "text", title: "", items: legacyItems, body: "" }, ...resources];
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

function VideoBlock({ resource }) {
  const [open, setOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [playback, setPlayback] = useState({ status: "idle", src: "", progress: 0 });
  const objectUrlRef = useRef("");
  const source = useMemo(() => describeVideoSource(resource), [resource]);
  const title = resource.title || "Video ders";
  const needsBlobPlayback = source.type === "file";

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

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
            Video{resource.duration ? ` · ${resource.duration}` : ""}
          </span>
        </span>
        <span className="curriculum-lesson__action" aria-hidden>
          <i className={`fa-solid fa-chevron-${open ? "up" : "down"}`} />
        </span>
      </button>

      {open ? (
        <div className="curriculum-player">
          {source.type === "embed" ? (
            <iframe
              src={source.src}
              title={title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
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
              <div className="curriculum-player__notice">
                <i className="fa-solid fa-spinner fa-spin" aria-hidden />
                <p>
                  Video indiriliyor
                  {playback.progress > 0 ? ` (%${playback.progress})` : ""}…
                </p>
                <p className="curriculum-player__hint">İleri sarma için dosya önce tamamen yüklenir.</p>
              </div>
            )
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              key={playback.src || source.src}
              src={needsBlobPlayback ? playback.src : source.src}
              controls
              playsInline
              preload="auto"
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

function FileBlock({ resource }) {
  const href = resolveAssetUrl(resource.path || resource.url);
  if (!href) return null;
  const downloadName = fixUploadedFileName(resource.fileName);
  const title = resource.title?.trim() || "PDF";
  const meta = formatFileSize(resource.size);

  return (
    <a
      className="curriculum-lesson curriculum-lesson--file"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download={downloadName || undefined}
    >
      <span className="curriculum-lesson__icon curriculum-lesson__icon--file" aria-hidden>
        <i className="fa-regular fa-file-pdf" />
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

function ModuleSection({ moduleRow, index, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const blocks = useMemo(() => moduleBlocks(moduleRow), [moduleRow]);
  const counts = useMemo(() => countResourcesByKind(blocks), [blocks]);
  const title = moduleRow.title || `Modül ${index + 1}`;

  const metaParts = [];
  if (counts.video) metaParts.push(`${counts.video} video`);
  if (counts.pdf) metaParts.push(`${counts.pdf} doküman`);
  if (counts.text) metaParts.push(`${counts.text} okuma`);

  return (
    <section className={`curriculum-module${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="curriculum-module__head"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className="curriculum-module__index" aria-hidden>
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="curriculum-module__heading">
          <span className="curriculum-module__title">{title}</span>
          <span className="curriculum-module__meta">{metaParts.join(" · ") || "İçerik hazırlanıyor"}</span>
        </span>
        <span className="curriculum-module__chevron" aria-hidden>
          <i className={`fa-solid fa-chevron-${open ? "up" : "down"}`} />
        </span>
      </button>

      {open ? (
        <div className="curriculum-module__body">
          {!blocks.length ? (
            <p className="training-detail-empty-note">Bu modülün içeriği henüz yayınlanmadı.</p>
          ) : (
            blocks.map((resource, blockIndex) => {
              const key = `${index}-${blockIndex}-${resource.kind}`;
              if (resource.kind === "video") return <VideoBlock key={key} resource={resource} />;
              if (resource.kind === "pdf") return <FileBlock key={key} resource={resource} />;
              return <TextBlock key={key} resource={resource} />;
            })
          )}
        </div>
      ) : null}
    </section>
  );
}

function TrainingCurriculum({ modules = [] }) {
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

  return (
    <div className="curriculum">
      <div className="curriculum__head">
        <div>
          <h3>Eğitim Müfredatı</h3>
          <p className="curriculum__subtitle">
            {list.length} modül
            {totals.video ? ` · ${totals.video} video` : ""}
            {totals.pdf ? ` · ${totals.pdf} indirilebilir doküman` : ""}
            {totals.text ? ` · ${totals.text} okuma` : ""}
          </p>
        </div>
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
      </div>

      <div className="curriculum__list">
        {list.map((moduleRow, index) => (
          <ModuleSection
            key={moduleRow.id || `module-${index}`}
            moduleRow={moduleRow}
            index={index}
            defaultOpen={index === 0}
          />
        ))}
      </div>
    </div>
  );
}

export default TrainingCurriculum;
