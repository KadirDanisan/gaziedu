const PARTNER_LOGOS = [
  { src: "/ajans.png", alt: "Türkiye Ulusal Ajansı" },
  { src: "/devlettiyatro.png", alt: "T.C. Kültür ve Turizm Bakanlığı Devlet Tiyatroları" },
  { src: "/pt.png", alt: "PTT — Posta ve Telgraf Teşkilatı" },
  { src: "/segem.png", alt: "SEGEM — Sigortacılık Eğitim Merkezi" },
  { src: "/sgk.png", alt: "Sosyal Güvenlik Kurumu" },
  { src: "/türkpatent.png", alt: "Türk Patent ve Marka Kurumu" },
  { src: "/mardin.png", alt: "Mardin Artuklu Üniversitesi" },
  { src: "/devletmalzeme.png", alt: "Devlet Malzeme Ofisi Genel Müdürlüğü" },
  { src: "/ilbank.png", alt: "İlbank" },
  { src: "/istanbulüni.png", alt: "İstanbul Üniversitesi-Cerrahpaşa" },
  { src: "/selcuk.png", alt: "Selçuk Üniversitesi" },
  { src: "/tapu.png", alt: "Tapu ve Kadastro Genel Müdürlüğü" },
  { src: "/tarım.png", alt: "T.C. Tarım ve Orman Bakanlığı" },
  { src: "/ulastirma.png", alt: "T.C. Ulaştırma ve Altyapı Bakanlığı" },
];

function Partners() {
  const loopedPartners = [...PARTNER_LOGOS, ...PARTNER_LOGOS];

  return (
    <section className="section partners">
      <h2>İş Birliği Yaptığımız Kurumlar</h2>
      <div className="partner-marquee" aria-label="Kurumsal referans logoları">
        <div className="partner-grid">
          {loopedPartners.map((partner, index) => (
            <img key={`${partner.src}-${index}`} src={partner.src} alt={partner.alt} loading="lazy" decoding="async" />
          ))}
        </div>
      </div>
    </section>
  );
}

export default Partners;
