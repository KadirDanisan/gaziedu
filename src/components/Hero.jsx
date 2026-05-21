import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { makeSlug } from "../data/homeData";
import { publicApi, resolvePublicImageUrl } from "../api/publicApi";
import CourseCardThumb from "./CourseCardThumb";

function Hero() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [heroCourses, setHeroCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const dragStartX = useRef(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    publicApi
      .getCourses()
      .then((data) => {
        if (!active) return;
        const items = Array.isArray(data?.courses) ? data.courses : [];
        if (!items.length) return;
        setHeroCourses(
          items.slice(0, 5).map((course, idx) => ({
            ...course,
            id: course.id || `${course.title}-${idx}`,
            image: resolvePublicImageUrl(course.image),
            attendees: "Sınırsız Kayıt",
            mode: "Uzaktan Eğitim",
          }))
        );
      })
      .catch(() => {
        if (!active) return;
        setHeroCourses([]);
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const courses = heroCourses;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const syncView = () => setIsMobileView(media.matches);
    syncView();
    media.addEventListener("change", syncView);
    return () => media.removeEventListener("change", syncView);
  }, []);

  useEffect(() => {
    if (!courses.length) return undefined;
    if (isDragging) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % courses.length);
    }, 2500);

    return () => window.clearInterval(timer);
  }, [isDragging, courses.length]);

  const goNext = () => {
    if (!courses.length) return;
    setActiveIndex((prev) => (prev + 1) % courses.length);
  };

  const goPrev = () => {
    if (!courses.length) return;
    setActiveIndex((prev) => (prev - 1 + courses.length) % courses.length);
  };

  const handlePointerDown = (event) => {
    dragStartX.current = event.clientX;
    setIsDragging(true);
  };

  const handlePointerMove = (event) => {
    if (dragStartX.current === null) return;
    const delta = event.clientX - dragStartX.current;
    const threshold = isMobileView ? 32 : 45;

    if (delta > threshold) {
      goPrev();
      dragStartX.current = event.clientX;
      return;
    }

    if (delta < -threshold) {
      goNext();
      dragStartX.current = event.clientX;
    }
  };

  const handlePointerUp = () => {
    dragStartX.current = null;
    setIsDragging(false);
  };

  const stackedCourses = useMemo(() => {
    if (!courses.length) return [];
    const total = courses.length;
    const getRelativePosition = (index) => {
      let relative = index - activeIndex;
      if (relative > total / 2) relative -= total;
      if (relative < -total / 2) relative += total;
      return relative;
    };

    return courses.map((course, index) => {
      const relative = getRelativePosition(index);
      return {
        ...course,
        index,
        relative,
      };
    });
  }, [activeIndex, courses]);

  return (
    <section className="hero">
      <div className="hero-media" aria-hidden="true" />
      <div className="hero-overlay">
        <div className="hero-inner">
          <div className="hero-content">
            <div className="hero-copy">
              <h1>
                Kariyerinizde fark yaratacak <br /> yenilikçi eğitimler
              </h1>
              <p>Üniversitemiz ayrıcalığıyla</p>
              <Link className="btn hero-cta-btn" to="/tum-egitimler">
                Eğitimleri Görüntüle
              </Link>
            </div>

            <div
              className="hero-card-stack"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {isLoading && <p>Yükleniyor...</p>}
            {stackedCourses.map((course) => {
              const reviewCount = Number(course.ratingCount ?? 0) || 0;
              const hasRating = reviewCount > 0 && course.rating;

              return (
                <article
                  key={`${course.title}-${course.index}`}
                  className="hero-course-card"
                  style={{
                    zIndex: 20 - Math.abs(course.relative),
                    transform: `translateX(${
                      course.relative * (isMobileView ? 26 : 58)
                    }px) translateY(${
                      Math.abs(course.relative) * (isMobileView ? 8 : 12)
                    }px) rotate(${course.relative * (isMobileView ? 2.2 : 5)}deg) scale(${
                      course.relative === 0 ? 1 : isMobileView ? 0.96 : 0.93
                    })`,
                    opacity: Math.abs(course.relative) > (isMobileView ? 1 : 2) ? 0 : 1,
                  }}
                >
                  <div className="hero-course-media">
                    <CourseCardThumb course={course} variant="hero" />
                    {hasRating ? (
                      <div className="hero-course-rating-badge">
                        <i className="fa-solid fa-star" aria-hidden />
                        <span>
                          {course.rating} · {reviewCount} değerlendirme
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div className="hero-course-body">
                    <div className="hero-course-meta">
                      <span>
                        <i className="fa-regular fa-user" /> {course.attendees}
                      </span>
                      <span>
                        <i className="fa-regular fa-calendar" /> {course.date}
                      </span>
                    </div>
                    <div className="hero-course-meta">
                      <span>
                        <i className="fa-regular fa-clock" /> {course.duration}
                      </span>
                      <span>
                        <i className="fa-solid fa-globe" /> {course.mode}
                      </span>
                    </div>
                    <h3>
                      <Link to={`/egitim-detay/${makeSlug(course.title)}`} state={{ course }}>
                        {course.title}
                      </Link>
                    </h3>
                    {course.category ? <p className="hero-course-category">{course.category}</p> : null}
                    <Link
                      className="hero-course-cta"
                      to={`/egitim-detay/${makeSlug(course.title)}`}
                      state={{ course }}
                    >
                      Eğitimi İncele <i className="fa-solid fa-arrow-right" aria-hidden />
                    </Link>
                  </div>
                </article>
              );
            })}
            {!isLoading && !stackedCourses.length && <p>Eğitim bulunamadı.</p>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
