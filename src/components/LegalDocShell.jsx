import { Link } from "react-router-dom";

function LegalDocShell({ title, lastUpdated, children }) {
  return (
    <>
      <section className="legal-page-hero">
        <div className="legal-page-hero-inner section">
          <ul className="calendar-breadcrumb">
            <li>
              <Link to="/">Anasayfa</Link>
            </li>
            <li>/</li>
            <li>{title}</li>
          </ul>
          <h1>{title}</h1>
          <p className="legal-page-hero-meta">Son güncelleme: {lastUpdated}</p>
        </div>
      </section>
      <div className="legal-page-wrap section">
        <article className="legal-page-article">{children}</article>
      </div>
    </>
  );
}

export default LegalDocShell;
