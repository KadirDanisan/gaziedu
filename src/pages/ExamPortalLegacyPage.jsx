import { Link, useParams } from "react-router-dom";

export default function ExamPortalLegacyPage() {
  const { educationCode = "", nationalId = "" } = useParams();
  return (
    <main className="exam-portal">
      <section className="exam-portal-card exam-portal-card--center">
        <img src="/Gazi_Üniversitesi_logo.png" alt="Gazi Üniversitesi" className="exam-portal-logo" />
        <h1>Bağlantı kullanılamıyor</h1>
        <p>
          Sınav portalı artık yalnızca güvenli (imzalı) bağlantı ile açılır. Eski adres biçimi
          (<code>/sinavportali/{educationCode}/{nationalId}</code>) geçerli değildir.
        </p>
        <p>Lütfen size iletilen güncel sınav linkini kullanın.</p>
        <Link to="/" className="btn exam-start-btn">
          Ana sayfaya git
        </Link>
      </section>
    </main>
  );
}
