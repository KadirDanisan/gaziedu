import { useMemo, useState } from "react";
import {
  countResourcesByKind,
  describeVideoSource,
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

function VideoBlock({ resource }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const source = useMemo(() => describeVideoSource(resource), [resource]);
  const title = resource.title || "Video ders";

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
          ) : failed ? (
            <div className="curriculum-player__error">
              <p>Video bu tarayıcıda oynatılamadı. Dosya biçimi desteklenmiyor olabilir.</p>
              <a href={source.src} target="_blank" rel="noopener noreferrer" download={resource.fileName || undefined}>
                Videoyu indir
              </a>
            </div>
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={source.src} controls playsInline preload="metadata" onError={() => setFailed(true)} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function FileBlock({ resource }) {
  const href = resolveAssetUrl(resource.path || resource.url);
  if (!href) return null;
  const title = resource.title || resource.fileName || "Doküman";
  const meta = [resource.fileName, formatFileSize(resource.size)].filter(Boolean).join(" · ");

  return (
    <a
      className="curriculum-lesson curriculum-lesson--file"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download={resource.fileName || undefined}
    >
      <span className="curriculum-lesson__icon curriculum-lesson__icon--file" aria-hidden>
        <i className="fa-regular fa-file-pdf" />
      </span>
      <span className="curriculum-lesson__body">
        <span className="curriculum-lesson__title">{title}</span>
        <span className="curriculum-lesson__meta">{meta || "İndirilebilir dosya"}</span>
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
