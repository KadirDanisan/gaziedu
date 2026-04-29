import { useEffect, useMemo, useRef, useState } from "react";
import { featuredCourses } from "../data/homeData";

function Hero() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const dragStartX = useRef(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const syncView = () => setIsMobileView(media.matches);
    syncView();
    media.addEventListener("change", syncView);
    return () => media.removeEventListener("change", syncView);
  }, []);

  useEffect(() => {
    if (isDragging) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % featuredCourses.length);
    }, 2500);

    return () => window.clearInterval(timer);
  }, [isDragging]);

  const goNext = () => {
    setActiveIndex((prev) => (prev + 1) % featuredCourses.length);
  };

  const goPrev = () => {
    setActiveIndex((prev) => (prev - 1 + featuredCourses.length) % featuredCourses.length);
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
    const total = featuredCourses.length;
    const getRelativePosition = (index) => {
      let relative = index - activeIndex;
      if (relative > total / 2) relative -= total;
      if (relative < -total / 2) relative += total;
      return relative;
    };

    return featuredCourses.map((course, index) => {
      const relative = getRelativePosition(index);
      return {
        ...course,
        index,
        relative,
      };
    });
  }, [activeIndex]);

  return (
    <section className="hero">
      <div className="hero-overlay">
        <div className="hero-content">
          <div>
            <h1>Kariyerinizde fark yaratacak <br /> yenilikçi eğitimler</h1>
            <p>Üniversitemiz ayrıcalığıyla</p>
            <button className="btn hero-cta-btn">Eğitimleri Görüntüle</button>
          </div>

          <div
            className="hero-card-stack"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {stackedCourses.map((course) => (
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
                <img src={course.image} alt={course.title} />
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
                    <a href="#">{course.title}</a>
                  </h3>
                  <p className="hero-rating">
                    <i className="fa-solid fa-star" />
                    <i className="fa-solid fa-star" />
                    <i className="fa-solid fa-star" />
                    <i className="fa-solid fa-star" />
                    <i className="fa-solid fa-star" /> ({course.rating})
                  </p>
                  <a href="#">Eğitimi İncele</a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
