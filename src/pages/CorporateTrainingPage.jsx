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
    image: "/analiz.png",
    paragraphs: [
      "Kamu kurumları, özel sektör işletmeleri ve sivil toplum kuruluşlarından gelen kurumsal eğitim ve danışmanlık talepleri, Gazi Üniversitesi Uzaktan Eğitim Uygulama ve Araştırma Merkezi (GUZEM) bünyesindeki alan uzmanları tarafından karşılanır. İlk aşamada kurum yöneticileri ve ilgili birim temsilcileriyle yüz yüze veya çevrim içi görüşmeler yapılarak kurumun mevcut durumu, öncelikleri ve beklentileri netleştirilir.",
      "Görüşmelerde eğitimin gerekçesi, hedef kitle, süre, mekân ve uygulama biçimi (yüz yüze, hibrit veya uzaktan) gibi başlıklar ele alınır. Elde edilen veriler; kurum kültürü, insan kaynakları planları ve kurumsal gelişim hedefleriyle birlikte değerlendirilerek Gazi Üniversitesi akademik standartlarına uygun, ölçülebilir kazanımlara dayalı eğitim taslağı hazırlanır.",
      "Araştırma üniversitesi kimliğimiz doğrultusunda içerikler; güncel mevzuat, sektörel iyi uygulamalar ve bilimsel yaklaşımla uyumlu olacak şekilde, alanında deneyimli öğretim elemanları ve sektör danışmanlarımızın katkısıyla şekillendirilir.",
    ],
    bullets: [
      "Neden bu eğitime ihtiyaç duyuluyor?",
      "Eğitim talebi yönetimden mi yoksa çalışanlardan mı geldi?",
      "Eğitim sonrası ne hedefleniyor?",
      "Katılımcı profili ve beklenen sayı nedir?",
      "Kurumun uzun vadeli stratejik öncelikleri nelerdir?",
    ],
  },
  {
    title: "2- Ön Test Süreci",
    image: "/analiz.png",
    paragraphs: [
      "Eğitim konusuna ve hedef gruba göre değişen ön test uygulamalarıyla katılımcıların mevcut bilgi düzeyi, beceri farkı ve programa yönelik motivasyonu ölçülür. GUZEM’in uzaktan eğitim altyapısı sayesinde testler güvenli çevrim içi ortamda uygulanabilir; gerekli hallerde kurum bünyesinde yüz yüze uygulama da planlanır.",
      "Test sonuçları eğitmen ve eğitim tasarım ekibimiz tarafından analiz edilir. Ortalama seviye, güçlü ve gelişime açık alanlar belirlenerek modül süreleri, örnek olay çalışmaları ve uygulamalı çalışma oranı buna göre ayarlanır.",
      "Böylece her kuruma aynı paket sunulmak yerine, Gazi Üniversitesi’nin hayat boyu öğrenme anlayışına uygun, katılımcı odaklı ve veriye dayalı bir program kurgusu oluşturulur.",
    ],
    bullets: [
      "Bilgi düzeyi ve öğrenme ihtiyacı haritası çıkarılır.",
      "Eğitim içeriği ve süresi son test verilerine göre netleştirilir.",
      "Katılımcı gruplarına özel modül veya seviye önerileri sunulur.",
    ],
  },
  {
    title: "3- Öneri ve Teklif Süreci",
    image: "/analiz.png",
    paragraphs: [
      "İhtiyaç analizi ve ön test bulgularının ardından kuruma özel eğitim programı taslağı, önerilen eğitmen kadrosu, takvim, uygulama modeli ve bütçe çerçevesi tek bir rapor halinde sunulur. Teklif dosyasında eğitim amaçları, kazanımlar, değerlendirme yöntemleri ve sertifikasyon (varsa) koşulları açıkça belirtilir.",
      "Kurum yöneticileriyle yapılan paylaşım toplantılarında içerik, süre ve uygulama detayları birlikte gözden geçirilir; geri bildirimlere göre program revize edilir. Onay sonrası sözleşme, katılımcı listesi ve teknik altyapı (uzaktan eğitim platformu, materyal erişimi vb.) adımları planlanır.",
      "Gazi Üniversitesi adına yürütülen tüm kurumsal eğitimlerde şeffaflık, akademik etik ve kalite güvencesi ilkeleri sürecin her aşamasında esas alınır.",
    ],
    bullets: [
      "Detaylı eğitim programı ve takvim önerisi",
      "Eğitmen özgeçmişi ve alan uzmanlığı bilgisi",
      "Maliyet, katılımcı sayısı ve uygulama koşulları",
      "Kurum geri bildirimine göre revize imkânı",
    ],
  },
  {
    title: "4- Değerlendirme Süreci",
    image: "/analiz.png",
    paragraphs: [
      "Eğitim tamamlandıktan sonra eğitmen tarafından hazırlanan süreç değerlendirme raporu (katılım, etkileşim, uygulama kalitesi) incelenir. Katılımcı memnuniyet anketleri ve varsa ara değerlendirme notları da bu rapora dahil edilir.",
      "Program sonunda tüm katılımcılara çevrim içi son test uygulanır; ön test sonuçlarıyla karşılaştırılarak bilgi ve beceri artışı ölçülür. Elde edilen veriler özet rapor halinde kurum yöneticileriyle paylaşılır; kurumun insan kaynakları ve eğitim planlaması için somut çıktı sunulur.",
      "Talep edilmesi hâlinde katılım belgesi veya Gazi Üniversitesi onaylı sertifika süreçleri, program tanımına uygun şekilde ayrıca yürütülür. Sürekli iyileştirme kapsamında bir sonraki dönem eğitim önerileri de rapor ekinde iletilir.",
    ],
    bullets: [
      "Eğitmen değerlendirme ve katılım raporu",
      "Ön test – son test karşılaştırmalı analiz",
      "Kurum yöneticilerine özet performans sunumu",
      "Sonraki dönem için geliştirme önerileri",
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
