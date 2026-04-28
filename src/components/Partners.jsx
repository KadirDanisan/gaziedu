import { partnerLogos } from "../data/homeData";

function Partners() {
  return (
    <section className="section partners">
      <h2>Bizi Tercih Ettiğiniz İçin Teşekkürler</h2>
      <div className="partner-grid">
        {partnerLogos.map((logo) => (
          <img key={logo} src={logo} alt="Referans" />
        ))}
      </div>
    </section>
  );
}

export default Partners;
