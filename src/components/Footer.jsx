import { Link } from "react-router-dom";

function Footer() {
  const paymentLogos = [
    "https://istanbulinstitute.com/site/images/iyzico_logo.png",
    "https://istanbulinstitute.com/site/images/visa.svg",
    "https://istanbulinstitute.com/site/images/mastercard.svg",
    "https://istanbulinstitute.com/site/images/bonus-new.svg",
    "https://istanbulinstitute.com/site/images/maximum-new.svg",
    "https://istanbulinstitute.com/site/images/world-new.svg",
    "https://istanbulinstitute.com/site/images/ziraat-new.svg",
    "https://istanbulinstitute.com/site/images/finans-new.svg",
    "https://istanbulinstitute.com/site/images/axess-new-3.svg",
    "https://istanbulinstitute.com/site/images/advantage-new.svg",
    "https://istanbulinstitute.com/site/images/paraf-new.svg",
    "https://istanbulinstitute.com/site/images/troy.svg",
  ];

  const securityLogos = [
    "https://istanbulinstitute.com/site/images/geotrust.png",
    "https://istanbulinstitute.com/site/images/etbis.png",
    "https://istanbulinstitute.com/site/images/3dsecure.png",
  ];

  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-brand">
          <Link to="/">
            <img src="/Gazi_Üniversitesi_logo.png" alt="Gazi Üniversitesi" />
          </Link>
        </div>

        <div className="footer-links">
          <h4>GAZI UNIVERSITESI</h4>
          <Link to="/">Anasayfa</Link>
          <Link to="/egitim-takvimi">Eğitim Takvimi</Link>
          <Link to="/hakkimizda">Hakkımızda</Link>
          <Link to="/kurumsal-egitim-cozumleri">Kurumsal Eğitim Çözümleri</Link>
          <Link to="/iletisim">İletişim</Link>
        </div>

        <div className="footer-links">
          <h4>&nbsp;</h4>
          <a href="#">Kişisel Verilerin Korunması Hakkında Aydınlatma Metni</a>
          <a href="#">Web Sitesi Kullanım Kuralları ve Gizlilik Sözleşmesi</a>
          <a href="#">İptal ve İade Koşulları</a>
          <a href="#">Mesafeli Satış Sözleşmesi</a>
        </div>

        <div className="footer-contact">
          <h4>İletişime Geç</h4>
          <p>
            <strong>Telefon:</strong> 0 212 283 24 02
          </p>
          <p>
            <strong>E-Mail:</strong> info@gazi.edu.tr
          </p>
          <p>
            <strong>Adres:</strong> Büyükdere Cad. No:119 Nevtron Plaza Kat 4 Esentepe - Şişli -
            İstanbul
          </p>
          <a href="#">Sıkça Sorulan Sorular</a>
          <div className="footer-social">
            <i className="fa-brands fa-facebook-f" />
            <i className="fa-brands fa-linkedin-in" />
            <i className="fa-brands fa-instagram" />
          </div>
        </div>
      </div>

      <div className="footer-payments">
        {paymentLogos.map((logo) => (
          <img key={logo} src={logo} alt="Ödeme" />
        ))}
      </div>

      <div className="footer-security">
        {securityLogos.map((logo) => (
          <img key={logo} src={logo} alt="Güvenlik" />
        ))}
      </div>

      <div className="footer-bottom">
        <span>Copyright © 2023 GAZI UNIVERSITESI. All Rights Reserved</span>
      </div>
    </footer>
  );
}

export default Footer;
