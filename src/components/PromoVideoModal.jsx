import { useEffect, useMemo, useRef, useState } from "react";
import { describeVideoSource, fixUploadedFileName } from "../utils/moduleResources";

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

export default function PromoVideoModal({ open, onClose, resource, title = "Tanıtım videosu" }) {
  const [reloadToken, setReloadToken] = useState(0);
  const [playback, setPlayback] = useState({ status: "idle", src: "", progress: 0 });
  const objectUrlRef = useRef("");
  const source = useMemo(() => describeVideoSource(resource), [resource]);
  const needsBlobPlayback = source.type === "file";

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !needsBlobPlayback) {
      setPlayback({ status: "idle", src: "", progress: 0 });
      return undefined;
    }

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

  if (!open || source.type === "none") return null;

  if (source.type === "link") {
    return (
      <div className="promo-video-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
        <div className="promo-video-modal" role="dialog" aria-modal="true" aria-label={title}>
          <div className="promo-video-modal__head">
            <h2>{title}</h2>
            <button type="button" className="promo-video-modal__close" aria-label="Kapat" onClick={onClose}>
              <i className="fa-solid fa-xmark" aria-hidden />
            </button>
          </div>
          <div className="promo-video-modal__body">
            <p>Bu video harici bir bağlantıda açılır.</p>
            <a href={source.src} target="_blank" rel="noopener noreferrer" className="promo-video-modal__external">
              Videoyu aç
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="promo-video-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <div className="promo-video-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="promo-video-modal__head">
          <h2>{title}</h2>
          <button type="button" className="promo-video-modal__close" aria-label="Kapat" onClick={onClose}>
            <i className="fa-solid fa-xmark" aria-hidden />
          </button>
        </div>
        <div className="promo-video-modal__body">
          <div className="promo-video-modal__player curriculum-player">
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
                  <a href={source.src} target="_blank" rel="noopener noreferrer" download={fixUploadedFileName(resource?.fileName) || undefined}>
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
                key={playback.src || source.src}
                src={needsBlobPlayback ? playback.src : source.src}
                controls
                playsInline
                preload="auto"
                autoPlay
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
