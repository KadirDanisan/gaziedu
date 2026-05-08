import { resolvePublicImageUrl } from "../api/publicApi";

const GAZI_LOGO_SRC = "/Gazi_Üniversitesi_logo.png";

/**
 * Eğitim kartı görseli: hover’da kapak yerine Gazi logosu (sol) + kurum logosu (sağ).
 * @param {"hero"|"upcoming"|"grid"|"calendar"} variant
 */
function CourseCardThumb({ course, variant = "grid", className = "" }) {
  const instSrc =
    course.institutionLogo && String(course.institutionLogo).trim().length > 0
      ? resolvePublicImageUrl(course.institutionLogo)
      : null;

  const mod = variant ? ` course-card-thumb--${variant}` : "";

  return (
    <div className={`course-card-thumb${mod} ${className}`.trim()}>
      <img
        className="course-card-thumb-cover"
        src={resolvePublicImageUrl(course.image)}
        alt={course.title}
      />
      <div className="course-card-thumb-hover" aria-hidden="true">
        <img className="course-card-thumb-gazi" src={GAZI_LOGO_SRC} alt="" />
        {instSrc ? (
          <img
            className="course-card-thumb-institution"
            src={instSrc}
            alt={course.institutionName || "Kurum"}
          />
        ) : (
          <span className="course-card-thumb-institution-fallback">
            <i className="fa-solid fa-building-columns" />
          </span>
        )}
      </div>
    </div>
  );
}

export default CourseCardThumb;
