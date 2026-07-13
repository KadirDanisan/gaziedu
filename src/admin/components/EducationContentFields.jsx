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

export function EducationModulesEditor({ modules = [], onChange }) {
  const updateModule = (index, patch) => {
    onChange(modules.map((moduleRow, i) => (i === index ? { ...moduleRow, ...patch } : moduleRow)));
  };

  const removeModule = (index) => {
    onChange(modules.filter((_, i) => i !== index));
  };

  const addModule = () => {
    onChange([...(modules || []), { title: "", items: [] }]);
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
          <article key={moduleRow.id || `module-${index}`} className="admin-module-card">
            <div className="admin-module-card__head">
              <strong>Modül {index + 1}</strong>
              <button type="button" className="btn btn-outline btn--sm" onClick={() => removeModule(index)}>
                Sil
              </button>
            </div>
            <input
              type="text"
              value={moduleRow.title ?? ""}
              onChange={(event) => updateModule(index, { title: event.target.value })}
              placeholder="MODÜL 2 — Temel Tasarım Prensipleri"
            />
            <BulletListEditor
              label="Modül maddeleri"
              hint="Her satır listede bir madde olarak gösterilir."
              value={moduleRow.items || []}
              onChange={(items) => updateModule(index, { items })}
              rows={8}
            />
          </article>
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
