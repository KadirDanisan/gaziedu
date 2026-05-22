import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { publicApi } from "../api/publicApi";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const EXAM_FALLBACK_DURATION_SECONDS = 30 * 60;
const examStartCache = new Map();
const EXAM_PORTAL_TITLE = "Gazi Üniversitesi Sertifika Sınavı";

function decodePortalTokenParam(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function formatDurationHumanTr(seconds) {
  const sec = Math.max(0, Number(seconds) || 0);
  if (sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  if (r === 0) return `${m} dakika`;
  return `${m} dakika ${r} saniye`;
}

function formatTimer(seconds) {
  const sec = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function answerLetter(index) {
  return String.fromCharCode(65 + index);
}

export default function ExamPortalPage() {
  const { portalToken: portalParam } = useParams();
  const portalToken = useMemo(() => decodePortalTokenParam(portalParam), [portalParam]);

  const [identity, setIdentity] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [tokenError, setTokenError] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [exam, setExam] = useState(null);
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(0);
  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [flowStarted, setFlowStarted] = useState(false);
  const startRequestedRef = useRef(false);
  const submittedRef = useRef(false);
  const answersRef = useRef({});
  const examRef = useRef(null);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    examRef.current = exam;
  }, [exam]);

  useEffect(() => {
    setFlowStarted(false);
    setExam(null);
    setLoadError("");
    setStarted(false);
    setResult(null);
    setAnswers({});
    startRequestedRef.current = false;
    submittedRef.current = false;
  }, [portalToken]);

  useEffect(() => {
    if (!portalToken) {
      setTokenLoading(false);
      setTokenError("Sınav bağlantısı eksik veya geçersiz.");
      setIdentity(null);
      return;
    }
    let active = true;
    setTokenLoading(true);
    setTokenError("");
    publicApi
      .validateExamPortalToken({ portalToken })
      .then((data) => {
        if (!active) return;
        setIdentity({
          educationCode: data.educationCode,
          nationalId: data.nationalId,
          participantName: data.participantName || "—",
        });
      })
      .catch((err) => {
        if (!active) return;
        setIdentity(null);
        setTokenError(err?.message || "Bu sınav bağlantısı doğrulanamadı veya süresi dolmuş.");
      })
      .finally(() => {
        if (!active) return;
        setTokenLoading(false);
      });
    return () => {
      active = false;
    };
  }, [portalToken]);

  useEffect(() => {
    if (!flowStarted || startRequestedRef.current || !portalToken || !identity) return;
    startRequestedRef.current = true;
    let active = true;
    setLoading(true);
    setLoadError("");
    let startPromise = examStartCache.get(portalToken);
    if (!startPromise) {
      startPromise = publicApi.startExamPortal({ portalToken });
      examStartCache.set(portalToken, startPromise);
      startPromise.catch(() => null).finally(() => {
        window.setTimeout(() => examStartCache.delete(portalToken), 3000);
      });
    }
    startPromise
      .then((data) => {
        if (!active) return;
        setExam(data);
        setRemaining(data.durationSeconds ?? EXAM_FALLBACK_DURATION_SECONDS);
      })
      .catch((err) => {
        if (!active) return;
        examStartCache.delete(portalToken);
        startRequestedRef.current = false;
        setFlowStarted(false);
        setLoadError(err?.message || "Sınav başlatılamadı.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [flowStarted, portalToken, identity]);

  const submitExam = useCallback(
    async (reason = "manual") => {
      const currentExam = examRef.current;
      if (!currentExam?.attemptId || submittedRef.current) return null;
      submittedRef.current = true;
      setSubmitting(true);
      try {
        const data = await publicApi.submitExamPortal({
          attemptId: currentExam.attemptId,
          answers: answersRef.current,
          reason,
        });
        setResult(data);
        setStarted(false);
        return data;
      } catch (err) {
        submittedRef.current = false;
        setLoadError(err?.message || "Sınav sonucu kaydedilemedi.");
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!started || result) return undefined;
    const timer = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          submitExam("timeout");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [started, result, submitExam]);

  useEffect(() => {
    const onPageHide = () => {
      const currentExam = examRef.current;
      if (!started || result || submittedRef.current || !currentExam?.attemptId) return;
      submittedRef.current = true;
      const payload = JSON.stringify({ answers: answersRef.current, reason: "pagehide" });
      const url = `${API_BASE_URL}/public/exam-portal/${currentExam.attemptId}/submit`;
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
      } else {
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [started, result]);

  const questions = exam?.questions || [];
  const currentQuestion = questions[currentIndex];
  const answeredCount = useMemo(
    () => questions.filter((q) => Boolean(answers[q.id])).length,
    [questions, answers],
  );

  const ready = Boolean(exam && !started && !result);

  const handleStartExam = useCallback(() => {
    if (!questions.length) {
      setLoadError("Sorular yüklenemedi. Lütfen sayfayı yenileyin.");
      return;
    }
    if (portalToken) {
      publicApi
        .recordExamPortalVisit({ portalUrl: window.location.href, portalToken })
        .catch(() => {});
    }
    setLoadError("");
    setCurrentIndex(0);
    setStarted(true);
  }, [questions.length, portalToken]);

  if (tokenLoading) {
    return (
      <main className="exam-portal">
        <section className="exam-portal-card exam-portal-card--center">
          <div className="exam-portal-loader" />
          <h1>Bağlantı doğrulanıyor...</h1>
          <p>Güvenli sınav bağlantınız kontrol ediliyor.</p>
        </section>
      </main>
    );
  }

  if (tokenError || !identity) {
    return (
      <main className="exam-portal">
        <section className="exam-portal-card exam-portal-card--center">
          <img src="/Guzem-05.png" alt="Gazi Üniversitesi" className="exam-portal-logo" />
          <h1>Sınav bağlantısı geçersiz</h1>
          <p>{tokenError || "Bu adres ile sınav açılamaz."}</p>
          <small>İmzalı bağlantı bozulmuş, süresi dolmuş veya bu ortamda çözülemiyor.</small>
          <Link to="/" className="btn exam-start-btn" style={{ marginTop: 16 }}>
            Ana sayfaya git
          </Link>
        </section>
      </main>
    );
  }

  if (!flowStarted) {
    return (
      <main className="exam-portal">
        <section className="exam-portal-card exam-ready-card">
          <div className="exam-ready-brand">
            <img src="/Guzem-05.png" alt="Gazi Üniversitesi" className="exam-portal-logo" />
            <div>
              <p className="exam-portal-eyebrow">Gazi Üniversitesi Sertifikasyon Sınav Portalı</p>
              <h1>Hoş geldiniz</h1>
            </div>
          </div>
          <div className="exam-ready-grid">
            <div>
              <span>Ad Soyad</span>
              <strong>{identity.participantName}</strong>
            </div>
            <div>
              <span>Eğitim Kodu</span>
              <strong>{identity.educationCode}</strong>
            </div>
            <div>
              <span>T.C. Kimlik No</span>
              <strong>{identity.nationalId}</strong>
            </div>
            <div>
              <span>Süre ve soru sayısı</span>
              <strong>Sınavı başlattığınızda eğitim ayarlarından yüklenir</strong>
            </div>
          </div>
          <div className="exam-ready-warning">
            <i className="fa-solid fa-circle-info" aria-hidden />
            <p>
              Kurallar: Sınav başladığında süre başlar. Süre dolunca sınav otomatik tamamlanır.
              Sekmeyi kapatırsanız mevcut cevaplarınız kaydedilerek sınav tamamlanır.
            </p>
          </div>
          <button type="button" className="btn exam-start-btn" onClick={() => setFlowStarted(true)}>
            Sınav sistemini başlat
          </button>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="exam-portal">
        <section className="exam-portal-card exam-portal-card--center">
          <div className="exam-portal-loader" />
          <h1>Sınav hazırlanıyor...</h1>
          <p>Soru havuzu kontrol ediliyor ve size özel sorular hazırlanıyor.</p>
        </section>
      </main>
    );
  }

  if (loadError && !exam) {
    return (
      <main className="exam-portal">
        <section className="exam-portal-card exam-portal-card--center">
          <img src="/Guzem-05.png" alt="Gazi Üniversitesi" className="exam-portal-logo" />
          <h1>Sınav açılamadı</h1>
          <p>{loadError}</p>
          <small>Güvenli bağlantı doğrulandı; sınav oturumu başlatılamadı.</small>
        </section>
      </main>
    );
  }

  if (result) {
    return (
      <main className="exam-portal">
        <section className="exam-portal-card exam-result-card">
          <img src="/Guzem-05.png" alt="Gazi Üniversitesi" className="exam-portal-logo" />
          <p className="exam-portal-eyebrow">Sınav tamamlandı</p>
          <h1>{EXAM_PORTAL_TITLE}</h1>
          <div className="exam-result-score">{Math.round(result.score)}</div>
          <p className="exam-result-score-label">100 üzerinden puanınız</p>
          <div className="exam-result-grid">
            <span>
              Doğru <strong>{result.correctCount}</strong>
            </span>
            <span>
              Yanlış <strong>{result.wrongCount}</strong>
            </span>
            <span>
              Boş <strong>{result.blankCount}</strong>
            </span>
            <span>
              Süre <strong>{formatTimer(result.durationSeconds)}</strong>
            </span>
          </div>
          {Number(result.score) >= 60 ? (
            <p className="exam-result-note">
              <strong>Sertifika almaya hak kazandınız.</strong>
            </p>
          ) : (
            <p className="exam-result-note">Sertifika almak için en az 60 puan gereklidir.</p>
          )}
          <p className="exam-result-note">Sonucunuz eğitim kodu ve T.C. kimlik numaranız ile kaydedildi.</p>
          <Link to="/" className="btn exam-start-btn">
            Ana sayfaya git
          </Link>
        </section>
      </main>
    );
  }

  if (ready) {
    return (
      <main className="exam-portal">
        <section className="exam-portal-card exam-ready-card">
          <div className="exam-ready-brand">
            <img src="/Guzem-05.png" alt="Gazi Üniversitesi" className="exam-portal-logo" />
            <div>
              <p className="exam-portal-eyebrow">Sınav Portalı</p>
              <h1>{EXAM_PORTAL_TITLE}</h1>
            </div>
          </div>
          <div className="exam-ready-grid">
            <div>
              <span>Ad Soyad</span>
              <strong>{identity.participantName}</strong>
            </div>
            <div>
              <span>Eğitim Kodu</span>
              <strong>{exam.education.code}</strong>
            </div>
            <div>
              <span>T.C. Kimlik No</span>
              <strong>{identity.nationalId}</strong>
            </div>
            <div>
              <span>Soru sayısı</span>
              <strong>{exam.questionCount ?? questions.length} soru</strong>
            </div>
            <div>
              <span>Süre</span>
              <strong>{formatDurationHumanTr(exam.durationSeconds ?? 0)}</strong>
            </div>
          </div>
          <div className="exam-ready-warning">
            <i className="fa-solid fa-circle-info" aria-hidden />
            <p>Sınav başladıktan sonra sekmeyi kapatırsanız mevcut cevaplarınızla sınav tamamlanır ve sonucunuz kaydedilir.</p>
          </div>
          <button type="button" className="btn exam-start-btn" onClick={handleStartExam}>
            Hazırım, sınavı başlat
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="exam-portal exam-portal--active">
      <header className="exam-topbar">
        <div className="exam-topbar-brand">
          <img src="/Guzem-05.png" alt="Gazi Üniversitesi" />
          <div>
            <strong>{EXAM_PORTAL_TITLE}</strong>
            <span>
              {exam.education.code} · {identity.nationalId} · {identity.participantName}
            </span>
          </div>
        </div>
        <div className={`exam-timer ${remaining <= 300 ? "is-danger" : ""}`}>
          <i className="fa-regular fa-clock" aria-hidden />
          {formatTimer(remaining)}
        </div>
      </header>

      <section className="exam-workspace">
        <aside className="exam-question-nav">
          <div>
            <span>İlerleme</span>
            <strong>
              {answeredCount}/{questions.length}
            </strong>
          </div>
          <div className="exam-question-dots">
            {questions.map((q, index) => (
              <button
                key={q.id}
                type="button"
                className={`${index === currentIndex ? "is-current" : ""} ${answers[q.id] ? "is-answered" : ""}`}
                onClick={() => setCurrentIndex(index)}
                aria-label={`${index + 1}. soruya git`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </aside>

        <article className="exam-question-card">
          <div className="exam-question-head">
            <span>{currentIndex + 1}. Soru</span>
          </div>
          <h1>{currentQuestion?.question}</h1>
          <div className="exam-options">
            {(currentQuestion?.options || []).map((option, index) => {
              const letter = answerLetter(index);
              return (
                <button
                  key={`${currentQuestion.id}-${letter}`}
                  type="button"
                  className={answers[currentQuestion.id] === letter ? "is-selected" : ""}
                  onClick={() => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: letter }))}
                >
                  <span>{letter}</span>
                  {option}
                </button>
              );
            })}
          </div>
          <footer className="exam-question-actions">
            <button
              type="button"
              className="btn btn-outline"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            >
              Önceki
            </button>
            {currentIndex < questions.length - 1 ? (
              <button
                type="button"
                className="btn exam-next-btn"
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
              >
                Sonraki
              </button>
            ) : (
              <button
                type="button"
                className="btn exam-submit-btn"
                disabled={submitting}
                onClick={() => submitExam("manual")}
              >
                {submitting ? "Kaydediliyor..." : "Sınavı tamamla"}
              </button>
            )}
          </footer>
          {loadError ? <p className="exam-inline-error">{loadError}</p> : null}
        </article>
      </section>
    </main>
  );
}
