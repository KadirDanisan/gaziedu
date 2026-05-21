import { useEffect, useState } from "react";
import { ABOUT_CAROUSEL_INTERVAL_MS, ABOUT_CAROUSEL_SLIDES } from "../data/aboutCarouselSlides";

function AboutMediaCarousel() {
  const slides = ABOUT_CAROUSEL_SLIDES.filter((slide) => slide?.src);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return undefined;

    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, ABOUT_CAROUSEL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [slides.length]);

  if (!slides.length) return null;

  return (
    <div className="about-carousel about-media-enter">
      <div className="about-carousel-frame">
        {slides.map((slide, index) => (
          <img
            key={`${slide.src}-${index}`}
            src={slide.src}
            alt={slide.alt || "Hakkımızda"}
            className={`about-carousel-slide${index === activeIndex ? " is-active" : ""}`}
            loading={index === 0 ? "eager" : "lazy"}
            draggable={false}
          />
        ))}
      </div>
    </div>
  );
}

export default AboutMediaCarousel;
