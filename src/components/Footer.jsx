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
          <h4>GAZİ ÜNİVERSİTESİ</h4>
          <Link to="/">Anasayfa</Link>
          <Link to="/egitim-takvimi">Eğitim Takvimi</Link>
          <Link to="/hakkimizda">Hakkımızda</Link>
          <Link to="/kurumsal-egitim-cozumleri">Kurumsal Eğitim Çözümleri</Link>
          <Link to="/iletisim">İletişim</Link>
        </div>

        <div className="footer-links">
          <h4>&nbsp;</h4>
          <Link to="/kvkk-aydinlatma-metni">Kişisel Verilerin Korunması <br />Hakkında Aydınlatma Metni</Link>
          
          <Link to="/kullanim-kurallari-ve-gizlilik">Web Sitesi Kullanım Kuralları <br />ve Gizlilik Sözleşmesi</Link>
        </div>

        <div className="footer-contact">
          <h4>İletişime Geç</h4>
          <p>
            <strong>Telefon:</strong> 0(312) 202 82 00
          </p>
          <p>
            <strong>E-Mail:</strong> guzem@gazi.edu.tr
          </p>
          <p>
            <strong>Adres:</strong> Gazi Üniversitesi Rektörlük Binası, 06560 Emniyet Mahallesi, Bandırma Caddesi, No:6/1, Yenimahalle - ANKARA
          </p>
          <div className="footer-social">
            <a href="https://www.facebook.com/gaziuniuzem" target="_blank" className="fa-brands fa-facebook-f" />
            <a href="https://www.linkedin.com/school/gazi-university/" target="_blank" className="fa-brands fa-linkedin-in" />
            <a href="https://www.instagram.com/gazi_universitesi/?hl=tr" target="_blank" className="fa-brands fa-instagram" />  
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <span>Copyright © 2026 GAZİ ÜNİVERSİTESİ. Tüm hakları saklıdır.</span>
      </div>
    </footer>
  );
}

export default Footer;
