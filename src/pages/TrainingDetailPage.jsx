import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { publicApi, resolvePublicImageUrl, invalidateEducationReviewsCache } from "../api/publicApi";
import { userApi } from "../api/userApi";
import TrainingCurriculum from "../components/TrainingCurriculum";
import PromoVideoModal from "../components/PromoVideoModal";
import { describeVideoSource } from "../utils/moduleResources";
import { useAuth } from "../context/AuthContext";

const COURSE_ID_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeExternalUrl(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

/** Kurum kurs sayfası + eğitim kodu (örn. https://alfaanit.com/kurs/GZM-01-01-01). */
function buildInstitutionCourseUrl(rawWebsite, educationCode) {
  const base = normalizeExternalUrl(rawWebsite);
  if (!base) return "";
  const code = String(educationCode ?? "").trim();
  if (!code) return base;
  try {
    const url = new URL(base);
    const path = url.pathname.replace(/\/+$/, "");
    url.pathname = `${path}/${code}`;
    return url.href;
  } catch {
    return `${base.replace(/\/+$/, "")}/${code}`;
  }
}

const sectionTabs = [
  { id: "genel-bilgi", label: "Genel Bilgi" },
  { id: "egitim-icerigi", label: "Eğitim İçeriği" },
  { id: "egitmen", label: "Eğitmen" },
  { id: "kayit-bilgileri", label: "Kayıt Bilgileri" },
  { id: "yorumlar", label: "Yorumlar" },
];

function buildVisibleSectionTabs(course) {
  if (!course) return sectionTabs;
  return [
    { id: "genel-bilgi", label: "Genel Bilgi" },
    { id: "egitim-icerigi", label: "Eğitim İçeriği" },
    ...(Array.isArray(course.topicHeadings) && course.topicHeadings.length
      ? [{ id: "konu-basliklari", label: "Konu Başlıkları" }]
      : []),
    ...(Array.isArray(course.modules) && course.modules.length ? [{ id: "moduller", label: "Modüller" }] : []),
    { id: "egitmen", label: "Eğitmen" },
    { id: "kayit-bilgileri", label: "Kayıt Bilgileri" },
    { id: "yorumlar", label: "Yorumlar" },
  ];
}

function getSiteHeaderScrollOffsetPx() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--site-header-scroll-offset").trim();
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 140;
}

/** Sabit navbar altındaki görünür alanda hedef bloğu dikeyde ortalar; URL hash güncellenir. */
function scrollTrainingDetailSectionIntoView(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const headerOffset = getSiteHeaderScrollOffsetPx();
  const rect = el.getBoundingClientRect();
  const elementCenterY = rect.top + window.scrollY + rect.height / 2;
  const viewportContentMidY = headerOffset + (window.innerHeight - headerOffset) / 2;
  const targetY = elementCenterY - viewportContentMidY;
  window.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
  if (history.replaceState) {
    history.replaceState(null, "", `#${id}`);
  }
}

function formatReviewDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

function CourseRatingStars({ value, max = 5, variant }) {
  const v = Math.min(max, Math.max(0, Number(value) || 0));
  const stars = [];
  for (let i = 1; i <= max; i += 1) {
    const diff = v - (i - 1);
    if (diff >= 1) {
      stars.push(<i key={i} className="fa-solid fa-star" aria-hidden />);
    } else if (diff >= 0.5) {
      stars.push(<i key={i} className="fa-solid fa-star-half-stroke" aria-hidden />);
    } else {
      stars.push(<i key={i} className="fa-regular fa-star" aria-hidden />);
    }
  }
  const cls = variant === "hero" ? "course-rating-stars-row course-rating-stars-row--hero" : "course-rating-stars-row";
  return <span className={cls}>{stars}</span>;
}

function TrainingReviewsSection({ course, onRatingUpdated }) {
  const { isLoggedIn } = useAuth();
  const sourceType = course.sourceType || "education";
  const isCalendar = sourceType === "calendar";
  const targetId = course.id;
  const canSync = typeof targetId === "string" && COURSE_ID_UUID.test(String(targetId));

  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formOk, setFormOk] = useState("");
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(null);
  const [hoverStar, setHoverStar] = useState(0);

  useEffect(() => {
    if (!canSync) {
      setLoadingReviews(false);
      setReviews([]);
      return;
    }
    let active = true;
    setLoadingReviews(true);
    const promise = isCalendar
      ? publicApi.getEducationReviews({ calendarId: targetId })
      : publicApi.getEducationReviews({ educationId: targetId });
    promise
      .then((data) => {
        if (!active) return;
        setReviews(Array.isArray(data?.reviews) ? data.reviews : []);
      })
      .catch(() => {
        if (!active) return;
        setReviews([]);
      })
      .finally(() => {
        if (!active) return;
        setLoadingReviews(false);
      });
    return () => {
      active = false;
    };
  }, [canSync, isCalendar, targetId]);

  const displayStars = hoverStar || (rating ?? 5);

  const handleSubmitReview = async (event) => {
    event.preventDefault();
    setFormError("");
    setFormOk("");
    if (!canSync) return;
    if (!isLoggedIn) {
      setFormError("Yorum veya puan vermek için giriş yapmalısınız.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = { rating: rating ?? 5 };
      const text = comment.trim();
      if (text) payload.comment = text;
      if (isCalendar) payload.calendarId = targetId;
      else payload.educationId = targetId;
      const result = await userApi.submitEducationReview(payload);
      setFormOk("Değerlendirmeniz kaydedildi. Teşekkür ederiz.");
      onRatingUpdated?.({
        rating: result.rating ?? "",
        ratingAverage: result.ratingAverage ?? null,
        ratingCount: result.ratingCount ?? 0,
      });
      invalidateEducationReviewsCache(isCalendar ? { calendarId: targetId } : { educationId: targetId });
      const refreshed = isCalendar
        ? await publicApi.getEducationReviews({ calendarId: targetId })
        : await publicApi.getEducationReviews({ educationId: targetId });
      setReviews(Array.isArray(refreshed?.reviews) ? refreshed.reviews : []);
    } catch (err) {
      setFormError(err?.message || "Gönderilemedi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <h3>Katılımcı Yorumları</h3>
      {!canSync && (
        <p className="training-review-unavailable">
          Bu eğitim kaydı için değerlendirme listesi şu an kullanılamıyor. Lütfen listeden sayfayı yeniden açın.
        </p>
      )}

      {canSync ? (
        <div className="training-review-compose">
          <div className="training-review-compose-head">
            <span className="training-review-compose-title">Değerlendirme</span>
          </div>

          {isLoggedIn ? (
            <form className="training-review-form" onSubmit={handleSubmitReview}>
              <div className="training-review-stars-row">
                <span className="training-review-label">Puanınız</span>
                <div
                  className="training-review-stars-input"
                  role="group"
                  aria-label="Yıldız puanı"
                  onMouseLeave={() => setHoverStar(0)}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`training-review-star-btn${n <= displayStars ? " is-on" : ""}`}
                      onMouseEnter={() => setHoverStar(n)}
                      onClick={() => setRating(n)}
                      aria-label={`${n} yıldız`}
                    >
                      <i className="fa-solid fa-star" aria-hidden />
                    </button>
                  ))}
                </div>
              </div>

              <label className="training-review-field">
                <span className="training-review-label">Yorumunuz (isteğe bağlı)</span>
                <textarea
                  rows={4}
                  maxLength={4000}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Deneyiminizi paylaşın..."
                  className="training-review-textarea"
                />
              </label>

              {formError ? <p className="training-review-msg is-error">{formError}</p> : null}
              {formOk ? <p className="training-review-msg is-ok">{formOk}</p> : null}

              <button type="submit" className="btn training-review-submit" disabled={submitting}>
                {submitting ? "Gönderiliyor..." : "Gönder"}
              </button>
            </form>
          ) : (
            <p className="training-review-login-prompt">
              Değerlendirme yapmak için{" "}
              <Link to="/kullanici-islemleri" className="training-review-login-link">
                giriş yapın
              </Link>
              .
            </p>
          )}
        </div>
      ) : null}

      <div className="training-detail-reviews">
        {loadingReviews && <p className="training-review-loading">Yorumlar yükleniyor...</p>}
        {!loadingReviews && !reviews.length && (
          <p className="training-review-empty">Henüz yorum yok. İlk değerlendirmeyi siz paylaşabilirsiniz.</p>
        )}
        {!loadingReviews &&
          reviews.map((review) => (
            <article key={review.id} className="training-detail-review">
              <div className="training-review-card-head">
                <strong>{review.authorLabel}</strong>
                <div className="training-review-stars-readonly" aria-hidden>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <i
                      key={n}
                      className={n <= review.rating ? "fa-solid fa-star" : "fa-regular fa-star"}
                    />
                  ))}
                </div>
              </div>
              {!!review.comment?.trim() && <p className="training-review-body">{review.comment.trim()}</p>}
              {!review.comment?.trim() && (
                <p className="training-review-body is-muted">Yorumsuz</p>
              )}
              <time className="training-review-date" dateTime={review.createdAt}>
                {formatReviewDate(review.createdAt)}
              </time>
            </article>
          ))}
      </div>
    </>
  );
}

function TrainingInstructorBlock({ course }) {
  const name = String(course?.instructorName ?? "").trim();
  const title = String(course?.instructorTitle ?? "").trim();
  const department = String(course?.instructorDepartment ?? "").trim();
  const about = String(course?.instructorAbout ?? "").trim();
  const email = String(course?.instructorEmail ?? "").trim();
  const legacy = String(course?.instructorLegacyInfo ?? "").trim();
  const photo = resolvePublicImageUrl(course?.instructorImage);
  const metaLine = [title, department].filter(Boolean).join(" · ");

  const avatar = (
    <div className={`training-detail-instructor-avatar${photo ? " training-detail-instructor-avatar--photo" : ""}`} aria-hidden>
      {photo ? <img src={photo} alt="" /> : <i className="fa-solid fa-chalkboard-user" />}
    </div>
  );

  if (legacy) {
    return (
      <div className="training-detail-instructor training-detail-instructor--legacy">
        {avatar}
        <p className="training-detail-instructor-legacy-text">{legacy}</p>
      </div>
    );
  }

  if (!name && !metaLine && !about && !email) {
    return <p className="training-detail-instructor-empty">Bu eğitim için eğitmen bilgisi henüz eklenmedi.</p>;
  }

  return (
    <div className="training-detail-instructor">
      {avatar}
      <div className="training-detail-instructor-body">
        {name ? <p className="training-detail-instructor-name">{name}</p> : null}
        {metaLine ? <p className="training-detail-instructor-meta">{metaLine}</p> : null}
        {about ? <p className="training-detail-instructor-about">{about}</p> : null}
        {email ? (
          <a className="training-detail-instructor-email" href={`mailto:${email}`}>
            {email}
          </a>
        ) : null}
      </div>
    </div>
  );
}

function TrainingDetailPage() {
  const { slug } = useParams();
  const location = useLocation();
  const stateCourse = location.state?.course;
  const [apiCourse, setApiCourse] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [ratingLive, setRatingLive] = useState(null);
  const [promoVideoOpen, setPromoVideoOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    publicApi
      .getEducationDetail(slug)
      .then((data) => {
        if (!active) return;
        const course = data?.course;
        if (!course) return;
        setApiCourse({
          ...course,
          id: course.id,
          sourceType: course.sourceType || "education",
          image: resolvePublicImageUrl(course.image),
        });
      })
      .catch(() => {
        if (!active) return;
        setApiCourse(null);
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const fallbackCourse = useMemo(() => stateCourse || null, [stateCourse]);
  const course = apiCourse || fallbackCourse;

  useEffect(() => {
    setRatingLive(null);
  }, [course?.id]);

  const displayCourse = useMemo(() => {
    if (!course) return null;
    return ratingLive ? { ...course, ...ratingLive } : course;
  }, [course, ratingLive]);

  const activeCourse = displayCourse || course;
  const promoVideoResource = useMemo(
    () => ({
      path: activeCourse?.promoVideoPath,
      url: activeCourse?.promoVideoUrl,
    }),
    [activeCourse?.promoVideoPath, activeCourse?.promoVideoUrl],
  );
  const hasPromoVideo = useMemo(
    () => describeVideoSource(promoVideoResource).type !== "none",
    [promoVideoResource],
  );

  useEffect(() => {
    if (!course?.id) return;
    const hash = (window.location.hash || "").replace(/^#/, "").trim();
    const tabs = buildVisibleSectionTabs(displayCourse || course);
    if (!hash || !tabs.some((t) => t.id === hash)) return;
    const timer = window.setTimeout(() => scrollTrainingDetailSectionIntoView(hash), 120);
    return () => window.clearTimeout(timer);
  }, [course?.id, slug, course, displayCourse]);

  if (isLoading && !course) {
    return <section className="section"><h2>Yükleniyor...</h2></section>;
  }

  if (!course) {
    return <section className="section"><h2>Eğitim bulunamadı.</h2></section>;
  }

  const c = activeCourse;
  const visibleSectionTabs = buildVisibleSectionTabs(c);

  const institutionLogoSrc =
    c.institutionLogo && String(c.institutionLogo).trim().length > 0
      ? resolvePublicImageUrl(c.institutionLogo)
      : null;
  const institutionSiteHref = buildInstitutionCourseUrl(c.institutionWebsite, c.code);

  return (
    <>
      <section className="training-detail-hero">
        <div className="training-detail-hero-inner section">
          <ul className="calendar-breadcrumb">
            <li>
              <Link to="/">Anasayfa</Link>
            </li>
            <li>/</li>
            <li>
              <Link to="/tum-egitimler">Egitimler</Link>
            </li>
            <li>/</li>
            <li>{c.title}</li>
          </ul>
          <h1>{c.title}</h1>
          <div className="training-detail-hero-rating" aria-label="Eğitim değerlendirmesi">
            {c.ratingAverage != null && c.ratingCount > 0 ? (
              <div className="training-detail-hero-rating-inner">
                <CourseRatingStars value={c.ratingAverage} variant="hero" />
                <span className="training-detail-hero-rating-meta">
                  <span className="training-detail-hero-rating-score">{c.rating}</span>
                  <span className="training-detail-hero-rating-sep" aria-hidden>
                    ·
                  </span>
                  <span className="training-detail-hero-rating-count">{c.ratingCount} değerlendirme</span>
                </span>
              </div>
            ) : (
              <span className="training-detail-hero-rating-empty">Henüz değerlendirme yok</span>
            )}
          </div>
          <p className="training-detail-description">
            Gazi Üniversitesi Sürekli Eğitim Vizyonu ile hazirlanan bu programda teorik altyapi,
            uygulamali içerik ve güncel sektör deneyimi birlikte sunulur.
          </p>
          <ul className="rbt-meta training-detail-meta">
            <li>
              <i className="fa-regular fa-user" /> {c.attendees}
            </li>
            <li>
              <i className="fa-regular fa-calendar" /> {c.date}
            </li>
            <li>
              <i className="fa-regular fa-clock" /> {c.duration}
            </li>
            <li>
              <i className="fa-solid fa-globe" /> {c.mode}
            </li>
          </ul>
          <p className="training-detail-code">
            <strong>Eğitim Kodu:</strong> {c.code || "Belirtilmedi"}
          </p>
          <div className="training-detail-badges">
            <div className="training-badge">GUZEM</div>
            {hasPromoVideo ? (
              <button
                type="button"
                className="training-badge training-badge--promo"
                onClick={() => setPromoVideoOpen(true)}
                aria-haspopup="dialog"
              >
                <i className="fa-solid fa-play" aria-hidden />
                <span>Tanıtım Videosunu İzle</span>
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <PromoVideoModal
        open={promoVideoOpen}
        onClose={() => setPromoVideoOpen(false)}
        resource={promoVideoResource}
        title={`${c.title} — Tanıtım Videosu`}
      />

      <section className="training-detail-content section">
        <div className="training-detail-main">
          <div className="training-detail-cover rbt-shadow-box">
            <img src={c.image} alt={c.title} />
          </div>

          <nav className="training-detail-tabs" aria-label="Eğitim bölümleri">
            {visibleSectionTabs.map((tab) => (
              <a
                key={tab.id}
                href={`#${tab.id}`}
                className="training-detail-tab"
                onClick={(event) => {
                  event.preventDefault();
                  scrollTrainingDetailSectionIntoView(tab.id);
                }}
              >
                {tab.label}
              </a>
            ))}
          </nav>

          <div id="genel-bilgi" className="training-detail-box rbt-shadow-box">
            <h3>Eğitimin Amacı ve Katılım Şartları</h3>
            <div className="training-detail-inline-title">Eğitimin Amacı</div>
            <p>{c.description || "Bu eğitim için açıklama henüz eklenmedi."}</p>

            {Array.isArray(c.topicHeadings) && c.topicHeadings.length ? (
              <div className="training-detail-highlights">
                <div className="training-detail-inline-title">Neler Öğreneceksiniz?</div>
                <ul className="training-detail-highlight-grid">
                  {c.topicHeadings.slice(0, 6).map((item) => (
                    <li key={item}>
                      <i className="fa-solid fa-circle-check" aria-hidden /> <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <ul className="training-detail-facts">
              <li>
                <i className="fa-regular fa-clock" aria-hidden />
                <span>Süre</span>
                <strong>{c.duration}</strong>
              </li>
              <li>
                <i className="fa-solid fa-globe" aria-hidden />
                <span>Katılım</span>
                <strong>{c.mode}</strong>
              </li>
              <li>
                <i className="fa-solid fa-certificate" aria-hidden />
                <span>Sertifika</span>
                <strong>Gazi Üniversitesi</strong>
              </li>
            </ul>
          </div>

          <div id="egitim-icerigi" className="training-detail-box rbt-shadow-box">
            <h3>Eğitim İçeriği</h3>
            {c.content ? (
              <div className="training-detail-plain-content">{c.content}</div>
            ) : (
              <p>Eğitim içeriği henüz eklenmedi.</p>
            )}
          </div>

          {Array.isArray(c.topicHeadings) && c.topicHeadings.length ? (
            <div id="konu-basliklari" className="training-detail-box rbt-shadow-box">
              <h3>Konu Başlıkları</h3>
              <ul className="training-detail-bullets">
                {c.topicHeadings.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {Array.isArray(c.modules) && c.modules.length ? (
            <div id="moduller" className="training-detail-box rbt-shadow-box training-detail-box--curriculum">
              <TrainingCurriculum modules={c.modules} />
            </div>
          ) : null}

          <div id="egitmen" className="training-detail-box rbt-shadow-box">
            <h3>Eğitmen</h3>
            <TrainingInstructorBlock course={c} />
          </div>

          <div id="kayit-bilgileri" className="training-detail-box rbt-shadow-box">
            <h3>Kayıt Bilgileri</h3>
            <p>
              Anlaşmalı olduğumuz kurumlar içerisinde eğitimlere ulaşıp sertifika için gerekli materyallerin tamamladıktan sonra Gazi Üniversitesi tarafından sertifika alabilirsiniz.
            </p>
          </div>

          <div id="yorumlar" className="training-detail-box rbt-shadow-box">
            <TrainingReviewsSection course={course} onRatingUpdated={setRatingLive} />
          </div>
        </div>

        <aside className="training-detail-sidebar rbt-shadow-box">
          <div className="training-detail-side-brand">
            {institutionLogoSrc ? (<>
              <img
                src={institutionLogoSrc}
                alt={c.institutionName || "Kurum"}
                className="training-detail-side-brand-logo"
              />
              <img src="/Guzem-05.png" alt="Gazi Üniversitesi"  className="training-detail-side-brand-logo" />
              </>
            ) : (
              <div className="training-detail-side-brand-placeholder" aria-hidden>
                <i className="fa-solid fa-building-columns" />
              </div>
            )}
            <p className="training-detail-side-brand-title">{c.title}</p>
          </div>
          <Link className="btn btn-outline training-detail-btn" to="/iletisim">
            Bilgi Talep Et
          </Link>
          {institutionSiteHref ? (
            <a
              className="btn btn-outline training-detail-btn training-detail-btn-external"
              href={institutionSiteHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              Eğitimi Satın Al <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden />
            </a>
          ) : null}
          <ul className="training-detail-side-list">
            <li>
              <span>Eğitim Tarihi</span>
              <strong>{c.date}</strong>
            </li>
            <li>
              <span>Eğitim Süresi</span>
              <strong>{c.duration}</strong>
            </li>
            <li>
              <span>Kontenjan</span>
              <strong>{c.attendees}</strong>
            </li>
            <li>
              <span>Program Türü</span>
              <strong>{c.mode}</strong>
            </li>
          </ul>
          <div className="training-detail-socials">
            <i className="fa-brands fa-facebook-f" />
            <i className="fa-brands fa-linkedin-in" />
            <i className="fa-brands fa-instagram" />
          </div>
          <div className="training-detail-contact">
            <p>Eğitimle ilgili detaylar için</p>
            <a href="tel:+903122028201">0 312 202 82 01</a>
          </div>
        </aside>
      </section>
    </>
  );
}

export default TrainingDetailPage;
