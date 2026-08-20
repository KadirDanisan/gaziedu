import { useState } from "react";
import { adminApi } from "../api";
import {
  countResourcesByKind,
  describeVideoSource,
  fixUploadedFileName,
  formatFileSize,
  resourceIconClass,
  resourceKindLabel,
} from "../../utils/moduleResources";

export function BulletListEditor({ label, hint, value = [], onChange, rows = 6, placeholder = "Her satıra bir madde yazın" }) {
  const text = (Array.isArray(value) ? value : []).join("\n");

  return (
    <div className="admin-field-stack">
      {label ? <span className="admin-field-label">{label}</span> : null}
      <textarea
        rows={rows}
        value={text}
        onChange={(event) =>
          onChange(
            event.target.value
              .split(/\r?\n/)
              .map((line) => line.replace(/^\*\s*/, "").trim())
              .filter(Boolean),
          )
        }
        placeholder={placeholder}
      />
      {hint ? <small style={{ opacity: 0.85 }}>{hint}</small> : null}
    </div>
  );
}

const blankResource = (kind) => {
  if (kind === "text") return { kind, title: "", items: [], body: "" };
  if (kind === "pdf") return { kind, title: "", path: "", url: "", fileName: "" };
  return { kind, title: "", path: "", url: "", duration: "" };
};

function ResourceBlock({ resource, index, total, onPatch, onRemove, onMove, onUpload, uploading, error }) {
  const kind = resource.kind;

  return (
    <article className={`admin-resource-card admin-resource-card--${kind}`}>
      <header className="admin-resource-card__head">
        <span className="admin-resource-card__badge">
          <i className={resourceIconClass(kind)} aria-hidden /> {resourceKindLabel(kind)}
        </span>
        <div className="admin-resource-card__actions">
          <button
            type="button"
            className="btn btn-outline btn--sm"
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            aria-label="Yukarı taşı"
          >
            <i className="fa-solid fa-arrow-up" aria-hidden />
          </button>
          <button
            type="button"
            className="btn btn-outline btn--sm"
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1}
            aria-label="Aşağı taşı"
          >
            <i className="fa-solid fa-arrow-down" aria-hidden />
          </button>
          <button type="button" className="btn btn-outline btn--sm is-danger" onClick={() => onRemove(index)}>
            Kaldır
          </button>
        </div>
      </header>

      <input
        type="text"
        value={resource.title ?? ""}
        onChange={(event) => onPatch(index, { title: event.target.value })}
        placeholder={
          kind === "video" ? "Video başlığı (ör. Giriş dersi)" : kind === "pdf" ? "Doküman başlığı (ör. Ders notu)" : "Blok başlığı (isteğe bağlı)"
        }
      />

      {kind === "text" ? (
        <>
          <BulletListEditor
            label="Maddeler"
            hint="Her satır sitede madde işareti olarak gösterilir."
            value={resource.items || []}
            onChange={(items) => onPatch(index, { items })}
            rows={6}
          />
          <div className="admin-field-stack">
            <span className="admin-field-label">Paragraf (isteğe bağlı)</span>
            <textarea
              rows={4}
              value={resource.body ?? ""}
              onChange={(event) => onPatch(index, { body: event.target.value })}
              placeholder="Maddelerin altında gösterilecek serbest metin."
            />
          </div>
        </>
      ) : null}

      {kind === "pdf" ? (
        <div className="admin-field-stack">
          <span className="admin-field-label">Dosya</span>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
            onChange={(event) => onUpload(index, event.target.files?.[0], "pdf")}
            disabled={uploading}
          />
          {uploading ? <small>Yükleniyor...</small> : null}
          {resource.path ? (
            <small className="admin-resource-card__file">
              <i className="fa-regular fa-circle-check" aria-hidden /> {fixUploadedFileName(resource.fileName) || resource.path}
            </small>
          ) : null}
          <input
            type="text"
            value={resource.url ?? ""}
            onChange={(event) => onPatch(index, { url: event.target.value })}
            placeholder="Veya dış bağlantı (https://...)"
          />
          <small style={{ opacity: 0.85 }}>Dosya yüklerseniz bağlantı alanı boş kalabilir. En fazla 50 MB.</small>
        </div>
      ) : null}

      {kind === "video" ? (
        <div className="admin-field-stack">
          <span className="admin-field-label">Video kaynağı</span>
          <input
            type="text"
            value={resource.url ?? ""}
            onChange={(event) => onPatch(index, { url: event.target.value })}
            placeholder="YouTube / Vimeo bağlantısı veya .mp4 adresi"
          />
          <input
            type="file"
            accept="video/*"
            onChange={(event) => onUpload(index, event.target.files?.[0], "video")}
            disabled={uploading}
          />
          {uploading ? <small>Video yükleniyor, pencereyi kapatmayın...</small> : null}
          {resource.path ? (
            <small className="admin-resource-card__file">
              <i className="fa-regular fa-circle-check" aria-hidden /> Yüklendi: {fixUploadedFileName(resource.fileName) || resource.path}
              <button type="button" className="admin-resource-card__unlink" onClick={() => onPatch(index, { path: "", fileName: "" })}>
                kaldır
              </button>
            </small>
          ) : null}
          <input
            type="text"
            value={resource.duration ?? ""}
            onChange={(event) => onPatch(index, { duration: event.target.value })}
            placeholder="Süre (ör. 12:30)"
          />
          <small style={{ opacity: 0.85 }}>
            Yüklenen dosya varsa o oynatılır; yoksa bağlantı kullanılır. Dosya için en fazla 2 GB.
          </small>
        </div>
      ) : null}

      {error ? <p className="admin-form-error">{error}</p> : null}
    </article>
  );
}

function ModuleCard({ moduleRow, index, onPatch, onRemove }) {
  const [uploadingKey, setUploadingKey] = useState("");
  const [uploadError, setUploadError] = useState("");
  const resources = Array.isArray(moduleRow.resources) ? moduleRow.resources : [];
  const counts = countResourcesByKind(resources);

  const setResources = (next) => onPatch(index, { resources: next });

  const addResource = (kind) => setResources([...resources, blankResource(kind)]);

  const patchResource = (resourceIndex, patch) =>
    setResources(resources.map((item, i) => (i === resourceIndex ? { ...item, ...patch } : item)));

  const removeResource = (resourceIndex) => setResources(resources.filter((_, i) => i !== resourceIndex));

  const moveResource = (resourceIndex, delta) => {
    const target = resourceIndex + delta;
    if (target < 0 || target >= resources.length) return;
    const next = [...resources];
    [next[resourceIndex], next[target]] = [next[target], next[resourceIndex]];
    setResources(next);
  };

  const uploadResource = async (resourceIndex, file, kind) => {
    if (!file) return;
    setUploadError("");
    setUploadingKey(`${index}-${resourceIndex}`);
    try {
      const result =
        kind === "video" ? await adminApi.uploadEducationModuleVideo(file) : await adminApi.uploadEducationModuleFile(file);
      patchResource(resourceIndex, {
        path: result?.path || "",
        fileName: fixUploadedFileName(result?.fileName || file.name),
        size: result?.size || file.size,
      });
    } catch (err) {
      setUploadError(err?.message || "Dosya yüklenemedi.");
    } finally {
      setUploadingKey("");
    }
  };

  return (
    <article className="admin-module-card">
      <div className="admin-module-card__head">
        <strong>Modül {index + 1}</strong>
        <button type="button" className="btn btn-outline btn--sm" onClick={() => onRemove(index)}>
          Sil
        </button>
      </div>

      <input
        type="text"
        value={moduleRow.title ?? ""}
        onChange={(event) => onPatch(index, { title: event.target.value })}
        placeholder="MODÜL 2 — Temel Tasarım Prensipleri"
      />

      <div className="admin-module-card__toolbar">
        <button type="button" className="btn btn-outline btn--sm" onClick={() => addResource("text")}>
          <i className="fa-regular fa-file-lines" aria-hidden /> Modül maddeleri
        </button>
        <button type="button" className="btn btn-outline btn--sm" onClick={() => addResource("pdf")}>
          <i className="fa-regular fa-file-pdf" aria-hidden /> PDF ekle
        </button>
        <button type="button" className="btn btn-outline btn--sm" onClick={() => addResource("video")}>
          <i className="fa-solid fa-play" aria-hidden /> Video ekle
        </button>
        <span className="admin-module-card__counts">
          {counts.text} metin · {counts.pdf} doküman · {counts.video} video
        </span>
      </div>

      {!resources.length ? (
        <p className="admin-modal-panel__empty">
          Bu modüle henüz içerik eklenmedi. Yukarıdaki butonlarla metin, PDF veya video bloğu ekleyin.
        </p>
      ) : (
        <div className="admin-resource-list">
          {resources.map((resource, resourceIndex) => (
            <ResourceBlock
              key={`${index}-${resourceIndex}-${resource.kind}`}
              resource={resource}
              index={resourceIndex}
              total={resources.length}
              onPatch={patchResource}
              onRemove={removeResource}
              onMove={moveResource}
              onUpload={uploadResource}
              uploading={uploadingKey === `${index}-${resourceIndex}`}
              error={uploadingKey === "" && uploadError ? uploadError : ""}
            />
          ))}
        </div>
      )}
    </article>
  );
}

export function EducationModulesEditor({ modules = [], onChange }) {
  const patchModule = (index, patch) => {
    onChange(modules.map((moduleRow, i) => (i === index ? { ...moduleRow, ...patch } : moduleRow)));
  };

  const removeModule = (index) => {
    onChange(modules.filter((_, i) => i !== index));
  };

  const addModule = () => {
    onChange([...(modules || []), { title: "", items: [], resources: [] }]);
  };

  return (
    <div className="admin-modules-editor">
      <div className="admin-modules-editor__head">
        <span className="admin-field-label">Modüller</span>
        <button type="button" className="btn btn-outline btn--sm" onClick={addModule}>
          Modül ekle
        </button>
      </div>
      {!modules?.length ? (
        <p className="admin-modal-panel__empty">Henüz modül eklenmedi.</p>
      ) : (
        modules.map((moduleRow, index) => (
          <ModuleCard
            key={moduleRow.id || `module-${index}`}
            moduleRow={moduleRow}
            index={index}
            onPatch={patchModule}
            onRemove={removeModule}
          />
        ))
      )}
    </div>
  );
}

export function renderBulletPreview(items = [], emptyText = "Henüz madde eklenmedi.") {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return <p className="admin-modal-panel__empty">{emptyText}</p>;
  return (
    <ul className="training-detail-bullets">
      {list.map((item, index) => (
        <li key={`${index}-${item}`}>{item}</li>
      ))}
    </ul>
  );
}

export function renderModuleResourcesPreview(resources = [], emptyText = "Bu modülde içerik yok.") {
  const list = Array.isArray(resources) ? resources : [];
  if (!list.length) return <p className="admin-modal-panel__empty">{emptyText}</p>;
  return (
    <ul className="admin-resource-preview">
      {list.map((resource, index) => {
        const source = resource.kind === "video" ? describeVideoSource(resource) : null;
        return (
          <li key={`${index}-${resource.kind}`} className="admin-resource-preview__item">
            <i className={resourceIconClass(resource.kind)} aria-hidden />
            <span className="admin-resource-preview__title">
              {resource.title?.trim() || (resource.kind === "pdf" ? "PDF" : fixUploadedFileName(resource.fileName) || resourceKindLabel(resource.kind))}
            </span>
            <span className="admin-resource-preview__meta">
              {resource.kind === "text"
                ? `${(resource.items || []).length} madde`
                : resource.kind === "pdf"
                  ? formatFileSize(resource.size) || "PDF"
                  : [resource.duration, source?.type === "file" ? "Yüklenen video" : "Bağlantı"].filter(Boolean).join(" · ")}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
