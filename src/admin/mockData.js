const now = new Date().toISOString();

const range = (count) => Array.from({ length: count }, (_, index) => index + 1);

export const roles = [
  { id: "r-super", name: "Süper Admin", createdAt: now, updatedAt: now },
  { id: "r-admin", name: "Admin", createdAt: now, updatedAt: now },
  { id: "r-auth", name: "Yetkili", createdAt: now, updatedAt: now },
  { id: "r-instructor", name: "Eğitmen", createdAt: now, updatedAt: now },
];

export const institutions = [
  {
    id: "i-gazi",
    name: "Gazi Üniversitesi",
    logoUrl: "/Guzem-05.png",
    websiteUrl: "https://gazi.edu.tr",
    description: "Akademik ve uygulamalı eğitim merkezi.",
    authorizedPerson: "Mehmet Demir",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "i-alfa",
    name: "Alfa Anıt Akademi",
    logoUrl: "https://dummyimage.com/120x60/0d47a1/ffffff.png&text=ALFA",
    websiteUrl: "https://alfaakademi.com",
    description: "Kurumsal gelişim programları sunar.",
    authorizedPerson: "Zeynep Aksoy",
    createdAt: now,
    updatedAt: now,
  },
];

export const adminUsers = [
  {
    id: "a-1",
    firstName: "Kadir",
    lastName: "Danışan",
    email: "superadmin@gazi.edu.tr",
    password: "123456",
    phone: "0555 111 11 11",
    institutionId: "",
    roleId: "r-super",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "a-2",
    firstName: "Ayşe",
    lastName: "Yılmaz",
    email: "admin@gazi.edu.tr",
    password: "123456",
    phone: "0555 222 22 22",
    institutionId: "i-gazi",
    roleId: "r-admin",
    createdAt: now,
    updatedAt: now,
  },
];

export const instructors = range(24).map((num) => ({
  id: `ins-${num}`,
  firstName: `Eğitmen${num}`,
  lastName: "Kaya",
  title: "Dr. Öğr. Üyesi",
  department: num % 2 === 0 ? "Yönetim Bilimleri" : "Bilgisayar Mühendisliği",
  about: "Sektör deneyimi olan eğitmen.",
  email: `egitmen${num}@gazi.edu.tr`,
  password: "123456",
  createdAt: now,
  updatedAt: now,
}));

export const normalUsers = range(53).map((num) => ({
  id: `u-${num}`,
  firstName: `Kullanici${num}`,
  lastName: "Test",
  email: `kullanici${num}@mail.com`,
  password: "123456",
  createdAt: now,
  updatedAt: now,
}));

export const educations = range(38).map((num) => ({
  id: `edu-${num}`,
  name: `Eğitim Programı ${num}`,
  institutionId: num % 2 === 0 ? "i-gazi" : "i-alfa",
  instructorId: `ins-${(num % 24) + 1}`,
  description: "Kapsamlı uygulamalı eğitim açıklaması.",
  imageUrl: "https://dummyimage.com/420x220/dfe8ff/0d47a1.png&text=Egitim",
  code: `EGT-${1000 + num}`,
  duration: `${8 + (num % 5) * 4} saat`,
  content: "Modül 1, Modül 2, Modül 3",
  createdAt: now,
  updatedAt: now,
}));

export const educationCalendar = range(26).map((num) => ({
  id: `cal-${num}`,
  educationName: `Takvim Eğitimi ${num}`,
  imageUrl: "https://dummyimage.com/420x220/edf3ff/003785.png&text=Takvim",
  description: "Duyuru niteliğinde eğitim etkinliği.",
  content: "Program akışı ve katılım detayları.",
  instructorInfo: `Eğitmen ${(num % 24) + 1}`,
  calendarDate: new Date(Date.now() + num * 86400000).toISOString().slice(0, 10),
  createdAt: now,
  updatedAt: now,
}));

export const newsletter = range(46).map((num) => ({
  id: `news-${num}`,
  email: `bulten${num}@mail.com`,
  createdAt: now,
}));

export const contactForms = range(27).map((num) => ({
  id: `c-${num}`,
  fullName: `İletişim Kişi ${num}`,
  email: `contact${num}@mail.com`,
  phone: "0555 333 33 33",
  subject: "Eğitim Bilgisi Talebi",
  message: "Eğitim içerik detaylarını öğrenmek istiyorum.",
  isRead: num % 3 === 0,
  createdAt: now,
}));

const difficulties = ["easy", "medium", "hard"];

export const examQuestions = range(66).map((num) => ({
  id: `q-${num}`,
  educationId: `edu-${(num % 38) + 1}`,
  instructorId: `ins-${(num % 24) + 1}`,
  questionText: `Soru metni ${num}`,
  difficulty: difficulties[num % 3],
  optionA: "A seçeneği",
  optionB: "B seçeneği",
  optionC: "C seçeneği",
  optionD: "D seçeneği",
  correctAnswer: "A",
  createdAt: now,
  updatedAt: now,
}));

export const permissions = roles.flatMap((role) =>
  [
    "dashboard",
    "normalUsers",
    "adminUsers",
    "institutions",
    "educations",
    "instructors",
    "educationCalendar",
    "newsletter",
    "contactForms",
    "examQuestions",
    "examPortalAccess",
    "examResults",
    "examSuccessPayments",
    "certificateList",
    "roles",
  ].map((moduleName) => ({
    id: `${role.id}-${moduleName}`,
    roleId: role.id,
    moduleName,
    canView: true,
    canCreate: role.id !== "r-auth",
    canUpdate: role.id !== "r-auth",
    canDelete: role.id === "r-super",
  })),
);
