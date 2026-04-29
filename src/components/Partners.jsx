import { partnerLogos } from "../data/homeData";

function Partners() {
  const loopedPartnerLogos = [...partnerLogos, ...partnerLogos];

  return (
    <section className="section partners">
      <h2>Bizi Tercih Ettiğiniz İçin Teşekkürler</h2>
      <div className="partner-marquee" aria-label="Referans logoları">
        <div className="partner-grid">
          {loopedPartnerLogos.map((logo, index) => (
            <img key={`${logo}-${index}`} src={logo} alt="Referans" />
          ))}
        </div>
      </div>
    </section>
  );
}

export default Partners;
