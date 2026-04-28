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
  "Kalite Yönetimi Eğitimleri",
  "Hukuk Eğitimleri",
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
    title: "PMI Onaylı Proje Yönetimi Sertifika Programı (Hafta Sonu Grubu)",
    date: "02 Mayıs 2026",
    mode: "Uzaktan Eğitim",
    duration: "36 saat (4,5 hafta)",
    attendees: "40 Kişi",
    rating: "23 Değerlendirme",
    image: "https://istanbulinstitute.com/thumb.php?src=files/pmi-bau-proje_13.jpg&size=526x282",
  },
  {
    title: "PMI Onaylı Proje Yönetimi Sertifika Programı (Hafta İçi Akşam Grubu)",
    date: "05 Mayıs 2026",
    mode: "Uzaktan Eğitim",
    duration: "36 saat (4 hafta)",
    attendees: "40 Kişi",
    rating: "12 Değerlendirme",
    image: "https://istanbulinstitute.com/thumb.php?src=files/istock-495193237-min_129.jpg&size=526x282",
  },
  {
    title: "YTÜ - İş Analizi Uzmanlığı Sertifika Programı",
    date: "09 Mayıs 2026",
    mode: "Yüzyüze Eğitim",
    duration: "60 saat (6 hafta)",
    attendees: "30 Kişi",
    rating: "5 Değerlendirme",
    image: "https://istanbulinstitute.com/thumb.php?src=files/istock-2148804792-min_144.jpg&size=526x282",
  },
  {
    title: "İnsan Kaynaklarında Yapay Zeka Uygulamaları Eğitim Programı",
    date: "09 Mayıs 2026",
    mode: "Uzaktan Eğitim",
    duration: "6 saat (1 gün)",
    attendees: "25 Kişi",
    rating: "Yeni",
    image: "https://istanbulinstitute.com/thumb.php?src=files/istock-1299491248-min_160.jpg&size=526x282",
  },
];

export const upcomingCourses = [
  {
    title: "PMI Onaylı Proje Yönetimi Sertifika Programı (Hafta Sonu Grubu)",
    date: "02 Mayıs 2026",
    mode: "Uzaktan Eğitim",
    duration: "36 saat (4,5 hafta) Cumartesi, Pazar (9:30-13:30)",
    attendees: "40 Kişi",
    rating: "23 Değerlendirme",
    image: "https://istanbulinstitute.com/thumb.php?src=files/pmi-bau-proje_13.jpg&size=526x282",
  },
  {
    title: "Performans Yönetim Sistemi Eğitim Programı",
    date: "02 Mayıs 2026",
    mode: "Uzaktan Eğitim",
    duration: "12 Saat (2 Gün) - Cumartesi Pazar (09:30 - 16:30)",
    attendees: "25 Kişi",
    rating: "",
    image: "https://istanbulinstitute.com/thumb.php?src=files/1-3qeaxovtf-1w06ytius4-q_94.jpg&size=526x282",
  },
  {
    title: "Temel Araştırma Yöntemleri ve Veri Analizi",
    date: "03 Mayıs 2026",
    mode: "Uzaktan Eğitim",
    duration: "16 Saat (4 gün) 10:00-14:00",
    attendees: "20 Kişi",
    rating: "",
    image: "https://istanbulinstitute.com/thumb.php?src=site/images/no_image.jpg&size=526x282",
  },
  {
    title: "Sürdürülebilirlik Raporlaması ve Yöneticiliği Sertifika Programı",
    date: "04 Mayıs 2026",
    mode: "Uzaktan Eğitim",
    duration: "18 saat (2 hafta) - Pazartesi, Salı, Çarşamba (19:00-22:00)",
    attendees: "25 Kişi",
    rating: "7 Değerlendirme",
    image: "https://istanbulinstitute.com/thumb.php?src=files/istock-669512140-min_161.jpg&size=526x282",
  },
  {
    title: "PMI Onaylı Proje Yönetimi Sertifika Programı (Hafta İçi Akşam Grubu)",
    date: "05 Mayıs 2026",
    mode: "Uzaktan Eğitim",
    duration: "36 saat (4 hafta) - Salı, Çarşamba, Perşembe (19:00-22:00)",
    attendees: "40 Kişi",
    rating: "12 Değerlendirme",
    image: "https://istanbulinstitute.com/thumb.php?src=files/istock-495193237-min_129.jpg&size=526x282",
  },
  {
    title: "Çocuk Kitabı Yazma Atölyesi",
    date: "06 Mayıs 2026",
    mode: "Uzaktan Eğitim",
    duration: "16 saat (8 hafta) Çarşamba (20:00-22:00)",
    attendees: "25 Kişi",
    rating: "",
    image: "https://istanbulinstitute.com/thumb.php?src=files/istock-830259928_168.jpg&size=526x282",
  },
];

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
