import NewsletterSection from "../components/NewsletterSection";

function AboutPage() {
  return (
    <>
      <section className="about-page-hero">
        <div className="about-page-hero-inner">
          <ul className="calendar-breadcrumb">
            <li>Anasayfa</li>
            <li>/</li>
            <li>Hakkımızda</li>
          </ul>
          <h1>Gazi Üniversitesi</h1>
          <p>
            Eğitimde dönüşen dünyaya uyum sağlayan bilgi ve beceri odaklı bir yaklaşım.
          </p>
        </div>
      </section>

      <section className="section about about-page-content">
        <div className="about-media">
          <img
            src="https://istanbulinstitute.com/files/peoplepng_11-07-2023_15-34-40.png"
            alt="Gazi Üniversitesi Hakkımızda"
          />
        </div>
        <div className="about-content">
          <span className="about-badge">Gazi Üniversitesi</span>
          <h2>Gazi Üniversitesi</h2>
          <p>
            Gazi Üniversitesi, 1926 yılında Gazi Mustafa Kemal Ataturk&apos;un talimatlarıyla kurulmus,
            koklu akademik gecmisi ve kamusal sorumluluk anlayisiyla Turkiye&apos;nin oncu yuksekogretim
            kurumlari arasinda yer almaktadir.
          </p>
          <p>
            Universitemiz; bilimsel dusunceyi, etik degerleri, arastirma kulturunu ve topluma katkiyi
            merkeze alan egitim yaklasimiyla ogrencilerini hem mesleki hem de kisisel anlamda
            gelecege hazirlamayi hedefler. Cagdas teknolojilerle desteklenen ogrenme ortamlari ve
            disiplinlerarasi is birlikleri bu surecin temelini olusturur.
          </p>
          <p>
            Gazi Universitesi; cok sayida fakulte, enstitu, yuksekokul ve arastirma merkezi ile
            ulusal ve uluslararasi duzeyde nitelikli egitim, bilimsel uretim ve toplumsal gelisim
            odakli calismalarini surdurmektedir. Amacimiz, ulkesine ve dunyaya deger katan bireyler
            yetistirmek ve bilginin toplum yararina donusmesine katkida bulunmaktir.
          </p>
        </div>
      </section>

      <NewsletterSection />
    </>
  );
}

export default AboutPage;
