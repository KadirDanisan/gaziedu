import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Partners from "../components/Partners";

const steps = [
  "İhtiyaç Analizi Süreci",
  "Ön Test Süreci",
  "Öneri ve Teklif Süreci",
  "Değerlendirme Süreci",
];

const details = [
  {
    title: "1- İhtiyaç Analizi Süreci",
    image: "/1.png",
    paragraphs: [
      "Şirketler tarafından talep edilen eğitim ya da danışmanlık hizmetleri ile ilgili alanında uzman danışmanlarımız tarafından ilgili, şirket yöneticileri ile yüz yüze görüşmeler yapılır. Görüşmelerde şu sorulara cevap aranır?.",
      "Alınan cevaplara uygun olarak şirketin kültürü ve gelecek stratejileri de dikkate alınarak şirket için en uygun eğitim içeriği, ilgili sektörde yetkin eğitmenlerimiz tarafından oluşturulur.",
    ],
    bullets: [
      "Neden bu eğitime ihtiyaç duyuluyor?",
      "Eğitim talebi yönetimden mi yoksa çalışanlardan mı geldi?",
      "Eğitim sonrası ne hedefleniyor?",
    ],
  },
  {
    sectionTitle: "Ön Test Süreci",
    title: "2- Ön Test Süreci",
    image: "/2.png",
    paragraphs: [
      "Konuya göre değişmekle birlikte eğitime katılacak kişilerin konu hakkındaki bilgi düzeyi ve eğitime katılım konusundaki istekleri online testler ile ölçülür.",
      "Sonuçlar, eğitmenlerimiz tarafından değerlendirilerek eğitim içeriği ve uygulamalarının son halini alması sağlanır.",
    ],
  },
  {
    sectionTitle: "Öneri ve Teklif Süreci",
    title: "3- Öneri ve Teklif Süreci",
    image: "/3.png",
    paragraphs: [
      "Eğitim içeriğinin ve eğitmenin belirlenmesinden sonraki süreçte oluşturulan tüm rapor, öneri ve teklifimiz ilgili şirket yöneticileri ile paylaşılır.",
    ],
  },
  {
    sectionTitle: "Değerlendirme Süreci",
    title: "4- Değerlendirme Süreci",
    image: "/4.png",
    paragraphs: [
      "Eğitim sonrası öncelikle eğitmen tarafından hazırlanan değerlendirme raporları incelenir.",
      "Eğitimin verilmesinden kısa bir süre sonra tüm katılımcılara online olarak son test uygulanır. Sonuçlar ön testlerle karşılaştırılarak, eğitmen tarafından ayrıca oluşturulan değerlendirme raporları ile birlikte ilgili şirket yöneticileri ile paylaşılır.",
    ],
  },
];

function CorporateTrainingPage() {
  const rotatingWords = ["İhtiyaç Analizi.", "Eğitimler.", "Ön Test Süreci."];
  const [wordIndex, setWordIndex] = useState(0);
  const [typedWord, setTypedWord] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentWord = rotatingWords[wordIndex];
    const speed = isDeleting ? 45 : 95;
    const timeoutId = window.setTimeout(() => {
      if (!isDeleting) {
        const next = currentWord.slice(0, typedWord.length + 1);
        setTypedWord(next);

        if (next === currentWord) {
          window.setTimeout(() => setIsDeleting(true), 900);
        }
      } else {
        const next = currentWord.slice(0, typedWord.length - 1);
        setTypedWord(next);

        if (next.length === 0) {
          setIsDeleting(false);
          setWordIndex((prev) => (prev + 1) % rotatingWords.length);
        }
      }
    }, speed);

    return () => window.clearTimeout(timeoutId);
  }, [isDeleting, typedWord, wordIndex]);

  return (
    <>
      <section className="corporate-hero">
        <div className="corporate-hero-inner">
          <h1>
            Kuruma Özel{" "}
            <span className="corporate-typed-wrap">
              <span className="corporate-typed-word">{typedWord}</span>
              <span className="corporate-typed-caret" />
            </span>
          </h1>
          <p>Kurumlara özel hazırlanan eğitimler ile ilgili detay ve süreç hakkında bilgiler</p>
          <div className="corporate-hero-actions">
            <button className="btn">Kayıt Ol!</button>
            <Link className="btn btn-outline-light" to="/iletisim">
              İletişime Geç
            </Link>
          </div>
        </div>
      </section>

      <section className="corporate-image">
        <img
          src="/work.png"
          alt="Kurumsal Eğitim Çözümleri"
        />
      </section>

      <section className="corporate-steps">
        <span className="about-badge">4 Adımda</span>
        <div className="corporate-step-grid">
          {steps.map((step, idx) => (
            <article key={step} className="corporate-step-card">
              <div className="corporate-step-number">{idx + 1}</div>
              <h3>{step}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="corporate-detail-list">
        {details.map((item) => (
          <article key={item.title} className="corporate-detail-row">
            <div className="corporate-detail-image">
              <img src={item.image} alt={item.title} />
            </div>
            <div className="corporate-detail-content">
              <span className="about-badge">Nasıl Çalışıyoruz?</span>
              {item.sectionTitle && <h4 className="corporate-detail-subtitle">{item.sectionTitle}</h4>}
              <h3>{item.title}</h3>
              {item.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {item.bullets && (
                <ul className="corporate-detail-bullets">
                  {item.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        ))}
      </section>

      <section className="corporate-cta">
        <div>
          <h2>Daha Fazla Bilgi Al</h2>
          <p>Merak ettiğiniz diğer sorular için bizimle iletişime geçebilirsiniz.</p>
        </div>
        <Link className="btn btn-outline-light" to="/iletisim">
          Hemen İletişime Geç
        </Link>
      </section>

      <Partners />
    </>
  );
}

export default CorporateTrainingPage;
