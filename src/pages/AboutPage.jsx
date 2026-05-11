import { Link } from "react-router-dom";
import NewsletterSection from "../components/NewsletterSection";

const CORE_VALUES = [
  {
    icon: "fa-solid fa-graduation-cap",
    title: "Eğitim ve Araştırmada Öncü",
    text: "Evrensel bilime ve milli kültürün oluşmasına katkı sağlayan öğrenme ve araştırma isteğini teşvik eden yüksek akademik niteliği benimser.",
  },
  {
    icon: "fa-solid fa-award",
    title: "Kalite Odaklı",
    text: "Kurum kültürüne uygun olarak; eğitim-öğretim, araştırma ve toplumsal hizmet alanlarında çağın gerek ve ihtiyaçlarına göre sürekli iyileştirme faaliyetlerini sürdürmeyi hedefler.",
  },
  {
    icon: "fa-solid fa-people-group",
    title: "Katılımcı",
    text: "Kurumsal karar verme süreçlerini iç ve dış paydaş katılımı sağlayarak yürütür.",
  },
  {
    icon: "fa-solid fa-leaf",
    title: "Çevreye Duyarlı",
    text: "Ürün ve hizmetleri geliştirirken ve sunarken çevrenin korunmasına ve iyileştirilmesine özen gösterir.",
  },
  {
    icon: "fa-solid fa-lightbulb",
    title: "Sorgulayıcı ve Yenilikçi",
    text: "Bilimde özgünlüğü arayan; araştırma, eğitim ve teknolojide sorgulayıcı, eleştirel ve toplumun gereksinimlerine hizmet edecek yenilikçi yaklaşımı benimser.",
  },
  {
    icon: "fa-solid fa-hand-holding-heart",
    title: "İnsana ve Topluma Karşı Sorumlu",
    text: "Millî değerleri merkeze alan, hoşgörü ve evrensel haklara saygılı yaklaşımı; üretilen bilgi ve hizmeti toplum yararına sunmayı önceler.",
  },
  {
    icon: "fa-solid fa-scale-balanced",
    title: "Liyakat ve Etik Değerlere Bağlı",
    text: "Evrensel ve akademik etik değerleri merkeze alır; seçim ve değerlendirmeleri yetkinlik ve nesnellik temelinde yürütür.",
  },
  {
    icon: "fa-solid fa-building-columns",
    title: "Kurumsal Aidiyeti Yüksek",
    text: "Mensubu olmakla gurur duyulan ve bunun sorumluluğunu taşıyabilen bir kurum olmayı hedefler.",
  },
  {
    icon: "fa-solid fa-landmark",
    title: "Tarih ve Kültürüne Bağlı",
    text: "Tarihî, kültürel, millî ve manevi değerlere karşı duyarlı bir duruş sergiler.",
  },
];

const POLICY_POINTS = [
  "Sürdürülebilir kalkınma hedeflerinden kaliteli ve kapsayıcı eğitime erişim için çevrim içi eğitim-öğretim süreçlerinin düzenlenmesi ve kesintisiz yürütülmesi, tüm bu süreçlerin iç ve dış paydaş görüşleri dikkate alınarak katılımcı bir anlayış ile gerçekleştirilmesini;",
  "Çevrim içi eğitim-öğretim çıktılarının ve kazanımlarının düzenli performans ölçümleriyle izlenmesi ve sürekli iyileştirmenin sağlanmasını;",
  "Günümüz dünyasının ihtiyaç duyduğu alanlarda akademik birimler ve dış paydaşlarla işbirliği içerisinde gerekli uzaktan eğitim programlarının açılması ve sürekli izleme ve iyileştirmelerin öncelenmesini;",
  "Öğrencinin motivasyonu, ilgi ve imkânlarını dikkate alan, uzaktan eğitime özgü öğrenci merkezli öğrenme yöntem ve yaklaşımları ile alternatif ölçme ve değerlendirme biçimlerinin uygulanmasının sağlanması ve bu noktada öğretim elemanlarının süreçlere ilişkin teknolojik ve pedagojik yetkinliklerinin arttırılmasını;",
  "Öğrenci rehberlik, akademik danışmanlık, kariyer ve sosyal destek hizmetlerinin çevrim içi ortamlarda eksiksiz ve kesintisiz olarak sürdürülmesinin sağlanmasını;",
  "Yaşam boyu öğrenmeyi merkeze alarak Üniversitemiz personeli ve öğrencilerinin ihtiyaç duyduğu eğitimlerin iç ve dış paydaşlarla işbirliği içerisinde sunulması ve hiçbir engel olmaksızın bu eğitimlere çevrim içi erişimin sağlanmasını, geri bildirimler doğrultusunda gerekli iyileştirmelerin yapılmasını;",
  "Akıllı teknolojileri (yapay zeka, veri madenciliği, makine öğrenmesi, derin öğrenme, öğrenme analitikleri vb.) uygulamaya koyarak çevrim içi öğrenme-öğretme süreçlerini daha işlevsel ve verimli hale getirecek Araştırma-Geliştirme faaliyetlerinin yapılması ve sonuçların izlenebilirliğinin sağlanmasını;",
  "Dijital ortamda oluşan e-öğrenme verilerinin; bilgi güvenliği, gizlilik ve bilişim etiği boyutları göz önünde bulundurularak saklanmasını, bunun yanında bu verilerin ilgili paydaşlarla yine aynı ilkeler göz önünde bulundurularak paylaşılmasını ilke edinmiştir.",
];

function AboutPage() {
  return (
    <>
      <section className="about-page-hero">
        <div className="about-page-hero-inner section">
          <p className="about-page-hero-kicker">
            <span className="about-page-hero-kicker-line" aria-hidden="true" />
            Kurumsal kimlik
          </p>
          <ul className="calendar-breadcrumb">
            <li>
              <Link to="/">Anasayfa</Link>
            </li>
            <li>/</li>
            <li>Hakkımızda</li>
          </ul>
          <h1>Gazi Üniversitesi</h1>
          <p className="about-page-hero-lede">
            Bilim, eğitim ve toplumsal sorumluluk ekseninde; Cumhuriyet değerleriyle harmanlanmış akademik bir duruş ve uzaktan eğitimde sürdürülebilir
            kalite anlayışı.
          </p>
        </div>
      </section>

      <section className="section about-page-intro">
        <div className="about-page-intro-visual">
          <div className="about-page-intro-frame">
            <img src="/main1.png" alt="Gazi Üniversitesi kampüs ve eğitim ortamı" loading="lazy" />
          </div>
        </div>
        <div className="about-page-intro-copy">
          <span className="about-badge">Araştırma üniversitesi</span>
          <h2 className="about-page-intro-title">Kökleri güçlü, bakışı evrensel</h2>
          <p className="about-page-intro-text">
            Gazi Üniversitesi; Cumhuriyet&apos;in öncü öğretmenlerini yetiştiren ilk eğitim kurumunu bünyesinde barındırmanın onuru ve araştırma üniversitesi
            olmanın sorumluluğuyla hareket eder. Temel değerlerimiz doğrultusunda bireyler yetiştirir; evrensel düzeyde bilgi ve hizmet üreterek toplumsal
            sorunların çözümüne ve hayat boyu öğrenmeye katkı sunar.
          </p>
          <ul className="about-page-intro-highlights" aria-label="Öne çıkan başlıklar">
            <li>
              <i className="fa-solid fa-microscope" aria-hidden="true" />
              Bilim ve teknolojide öncü araştırma
            </li>
            <li>
              <i className="fa-solid fa-book-open-reader" aria-hidden="true" />
              Nitelikli ve erişilebilir öğrenme deneyimi
            </li>
            <li>
              <i className="fa-solid fa-shield-halved" aria-hidden="true" />
              Etik, şeffaflık ve paydaş odaklılık
            </li>
          </ul>
        </div>
      </section>

      <section className="about-page-mvv-band" aria-labelledby="about-mvv-heading">
        <div className="about-page-mvv-inner section">
          <h2 id="about-mvv-heading" className="about-page-section-title about-page-section-title--on-light">
            Misyon ve vizyon
          </h2>
          <p className="about-page-section-lede about-page-section-lede--on-light">
            Kurumun yönünü ve hedeflerini tek bakışta ifade eden çerçeve; tüm eğitim ve hizmet süreçlerimizin omurgasını oluşturur.
          </p>
          <div className="about-page-mvv-grid">
            <article className="about-page-mvv-card">
              <div className="about-page-mvv-icon" aria-hidden="true">
                <i className="fa-solid fa-bullseye" />
              </div>
              <h3>Misyon</h3>
              <p>
                Üniversitemiz temel değerleri doğrultusunda bireyler yetiştirmek; araştırmalar yoluyla evrensel düzeyde fikir, bilgi, bilim, teknoloji ve
                hizmet üreterek toplumsal sorunların çözümüne ve hayat boyu öğrenme sürecine katkıda bulunmaktır.
              </p>
            </article>
            <article className="about-page-mvv-card">
              <div className="about-page-mvv-icon about-page-mvv-icon--accent" aria-hidden="true">
                <i className="fa-solid fa-eye" />
              </div>
              <h3>Vizyon</h3>
              <p>Uluslararası düzeyde bilim, teknoloji ve sanatta, girişimci ve öncü bir üniversite olmak.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section about-page-values" aria-labelledby="about-values-heading">
        <h2 id="about-values-heading" className="about-page-section-title">
          Temel değerler
        </h2>
        <p className="about-page-section-lede">
          Kararlarımızı, eğitim tasarımımızı ve kurumsal kültürümüzü şekillendiren ilkeler; Gazi Üniversitesi kimliğinin görünür ifadesidir.
        </p>
        <div className="about-page-values-grid">
          {CORE_VALUES.map((item) => (
            <article key={item.title} className="about-page-value-card">
              <div className="about-page-value-icon" aria-hidden="true">
                <i className={item.icon} />
              </div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-page-policy" aria-labelledby="about-policy-heading">
        <div className="about-page-policy-inner section">
          <span className="about-badge">Uzaktan eğitim</span>
          <h2 id="about-policy-heading">Politikamız</h2>
          <h3 className="about-page-policy-subtitle">Gazi Üniversitesi Uzaktan Eğitim Politikası</h3>
          <p className="about-page-policy-intro">
            Cumhuriyetin ilk yükseköğretim kurumlarından biri olmanın yanı sıra sunduğu nitelikli eğitimden ödün vermeden yoluna devam eden, birçok alanda
            ilklere imza atan, araştırma üniversitesi özelliği ve vizyonuna sahip Gazi Üniversitesinin uzaktan eğitim alanında aşağıdaki ilkeleri benimser:
          </p>
          <ol className="about-page-policy-list">
            {POLICY_POINTS.map((text, index) => (
              <li key={text.slice(0, 48)} className="about-page-policy-item">
                <span className="about-page-policy-num">{index + 1}</span>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <NewsletterSection />
    </>
  );
}

export default AboutPage;
