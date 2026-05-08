
export const categories = [
  "Tüm Eğitimler",
  "Yönetim - Liderlik Eğitimleri",
  "Teknoloji Eğitimleri",
  "Finans ve Muhasebe Eğitimleri",
  "Dijital Pazarlama Eğitimleri",
  "İletişim Eğitimleri",
  "İnsan Kaynakları Eğitimleri",
  "Dijital Dönüşüm Eğitimleri",
  "Proje Yönetimi (PMI Onaylı) Eğitimleri",
];

export const makeSlug = (value) =>
  value
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const featuredCourses = [
  {
    title: "PMI Onaylı Proje Yönetimi Sertifika Programı",
    category: "Proje Yönetimi (PMI Onaylı) Eğitimleri",
    date: "02 Mayıs 2026",
    mode: "Uzaktan Eğitim",
    duration: "36 saat",
    attendees: "Sınırsız Kayıt",
    rating: "23 Değerlendirme",
    image: "https://istanbulinstitute.com/thumb.php?src=files/pmi-bau-proje_13.jpg&size=526x282",
  },
  {
    title: "Performans Yönetim Sistemi Eğitim Programı",
    category: "Yönetim - Liderlik Eğitimleri",
    date: "05 Mayıs 2026",
    mode: "Uzaktan Eğitim",
    duration: "12 saat",
    attendees: "Sınırsız Kayıt",
    rating: "8 Değerlendirme",
    image: "https://istanbulinstitute.com/thumb.php?src=files/1-3qeaxovtf-1w06ytius4-q_94.jpg&size=526x282",
  },
  {
    title: "Temel Araştırma Yöntemleri ve Veri Analizi",
    category: "Teknoloji Eğitimleri",
    date: "09 Mayıs 2026",
    mode: "Uzaktan Eğitim",
    duration: "16 saat",
    attendees: "Sınırsız Kayıt",
    rating: "",
    image: "https://istanbulinstitute.com/thumb.php?src=site/images/no_image.jpg&size=526x282",
  },
];

export const upcomingCourses = featuredCourses;

export const faqItems = [
  {
    question: "Eğitimler ücretli midir?",
    answer: "Eğitimlerin tamamı ücrete tabidir.",
  },
  {
    question: "Sertifikalarınızın geçerliliği hakkında bilgi alabilir miyim?",
    answer: "Sertifikalar e-devlet ve iş birliği yapılan kurum onaylıdır.",
  },
  {
    question: "Eğitime kayıt için ne yapmalıyım?",
    answer: "Web sitesine üye olarak veya danışman hattı ile kayıt olabilirsiniz.",
  },
  {
    question: "Sertifika alabilmek için hangi koşulları sağlamalıyım?",
    answer:
      "Genel olarak devam koşulunu ve program sonunda yapılacak sınavdaki başarı koşulunu sağlayan katılımcılar sertifika almaya hak kazanır.",
  },
  {
    question: "Neden Gazi Üniversitesi eğitimlerini tercih etmeliyim?",
    answer:
      "Uzman eğitmen kadrosu, uygulamalı içerik yapısı ve yüksek memnuniyet oranı ile hem bireysel hem kurumsal gelişimi hedefleyen güçlü bir eğitim deneyimi sunar.",
  },
];

export const partnerLogos = [
  "https://istanbulinstitute.com/files/yurtici-kargopng_12-09-2023_10-50-59.png",
  "https://istanbulinstitute.com/files/defactojpg_12-09-2023_10-46-02.jpg",
  "https://istanbulinstitute.com/files/bosch-logo-2jpg_12-09-2023_10-46-02.jpg",
  "https://istanbulinstitute.com/files/acbadem-jpg_12-09-2023_10-46-02.jpg",
  "https://istanbulinstitute.com/files/pirellijpg_12-09-2023_10-45-19.jpg",
];
