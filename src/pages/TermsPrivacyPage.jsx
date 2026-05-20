import { Link } from "react-router-dom";
import LegalDocShell from "../components/LegalDocShell";

function TermsPrivacyPage() {
  return (
    <LegalDocShell title="Web Sitesi Kullanım Kuralları ve Gizlilik Sözleşmesi" lastUpdated="11 Mayıs 2026">
      <p className="legal-page-lead">
        Bu metin; Gazi Üniversitesi&apos;ne ait bu web sitesi ve bağlı çevrim içi hizmetlerin (&quot;Platform&quot;) kullanımına ilişkin kuralları ile
        kişisel verilerin gizliliğini ve işlenmesini düzenler. Siteye erişerek veya hesap oluşturarak bu metni okuduğunuzu, anladığınızı ve bağlı
        olduğunuzu kabul etmiş sayılırsınız. Belirli hizmetler için ayrıca özel şartlar veya sözleşmeler uygulanabilir.
      </p>

      <section className="legal-page-block" aria-labelledby="tp-1">
        <h2 id="tp-1">1. Taraflar ve yürürlük</h2>
        <p>
          <strong>Hizmet sağlayıcı:</strong> Gazi Üniversitesi (&quot;Üniversite&quot;), merkez adresi web sitesinde yayımlanan resmi adresidir.
        </p>
        <p>
          <strong>Kullanıcı:</strong> Platforma erişen, bilgi edinen, kayıt olan, eğitim satın alan veya hesabı bulunan gerçek veya tüzel kişi adına
          işlem yapan gerçek kişi.
        </p>
        <p>
          Bu metin yayımlandığı tarihte yürürlüğe girer; sonraki güncellemeler sitede ilan edilir. Önemli değişiklikler hesabınız veya iletişim
          adresiniz üzerinden duyurulabilir. Değişiklik sonrası hizmeti kullanmaya devam etmeniz, güncellenmiş metni kabul ettiğiniz şeklinde
          yorumlanabilir; aksi halde hesabınızı kapatabilir veya hizmeti sonlandırabilirsiniz.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="tp-2">
        <h2 id="tp-2">2. Tanımlar</h2>
        <ul className="legal-page-list">
          <li>
            <strong>Platform:</strong> Üniversite tarafından işletilen web sitesi, alt alan adları, API&apos;ler ve mobil uygulamalar (varsa).
          </li>
          <li>
            <strong>İçerik:</strong> Metin, görsel, video, ses, yazılım kodu, sınav soruları, ders materyalleri ve veri tabanları.
          </li>
          <li>
            <strong>Hesap:</strong> Kimlik doğrulama bilgileriyle oluşturulan kullanıcı profili ve buna bağlı yetkiler.
          </li>
          <li>
            <strong>Hizmet:</strong> Eğitim listeleme, kayıt, ödeme, içerik sunumu, sınav, sertifika ve destek süreçlerinin tamamı veya bir kısmı.
          </li>
        </ul>
      </section>

      <section className="legal-page-block" aria-labelledby="tp-3">
        <h2 id="tp-3">3. Hizmetin kapsamı ve değişiklik</h2>
        <p>
          Platform üzerinden sunulan eğitimler, tarihler, ücretler, ön koşullar ve sertifika koşulları ilan edildiği şekilde geçerlidir. Üniversite;
          teknik bakım, güvenlik, mevzuat veya akademik gerekçelerle içerikleri, programları ve arayüzü önceden haber vermeksizin değiştirebilir,
          askıya alabilir veya sonlandırabilir. Mücbir sebep, siber saldırı, üçüncü taraf kesintileri veya kamu otoritesi kararlarından doğan
          gecikmelerden Üniversite makul ölçüde sorumlu tutulamaz; ancak makul çaba göstermeyi taahhüt eder.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="tp-4">
        <h2 id="tp-4">4. Kullanıcı yükümlülükleri</h2>
        <p>Kullanıcı olarak aşağıdaki kurallara uymayı kabul edersiniz:</p>
        <ol className="legal-page-ol">
          <li>Kayıt sırasında ve sonrasında verdiğiniz bilgilerin doğru, güncel ve eksiksiz olması;</li>
          <li>Hesap bilgilerinizin gizliliği ve güvenliği ile ilgili sorumluluğun size ait olması; şüpheli kullanımı derhal bildirmeniz;</li>
          <li>Platformu yalnızca hukuka uygun ve bu metinde izin verilen amaçlarla kullanmanız;</li>
          <li>Başkası adına izinsiz işlem yapmamanız, kimlik sahtekârlığı yapmamanız;</li>
          <li>İçeriği izinsiz çoğaltmamanız, ticari olarak dağıtmamanız, tersine mühendislik yapmamanız;</li>
          <li>Platformun işleyişine zarar verecek bot, scraper, yük testi veya kötü amaçlı yazılım kullanmamanız;</li>
          <li>Diğer kullanıcıların ve personelin haklarına saygı göstermeniz; hakaret, tehdit, ayrımcılık veya yasadışı içerik paylaşmamanız;</li>
          <li>Sınav ve değerlendirme kurallarına uymanız; hile, kopya veya gözetim kurallarını ihlal etmemeniz.</li>
        </ol>
        <p>
          İhlal halinde hesabınız askıya alınabilir, erişiminiz kısıtlanabilir veya yasal mercilere başvurulabilir; ödenmiş ücretler iade politikasına
          tabidir.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="tp-5">
        <h2 id="tp-5">5. Yaş ve veli onayı</h2>
        <p>
          Platform hizmetleri reşit olmayanlar için veli/vasi onayı veya yasal düzenlemelerin gerektirdiği ek şartlara tabi olabilir. Reşit olmayan
          adına işlem yapan veli/vasi, bu metni kendi adına da kabul etmiş sayılır ve verilen bilgilerden sorumludur.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="tp-6">
        <h2 id="tp-6">6. Fikri mülkiyet hakları</h2>
        <p>
          Platformdaki tüm içerikler, tasarım öğeleri, markalar, logo, yazılım ve veri tabanı unsurları Üniversite veya lisans veren üçüncü
          tarafların fikri mülkiyetine tabidir. İzinsiz kullanım, kopyalama, çoğaltma, yayma veya ticari istismar yasaktır. Size özel verilen
          lisans, yalnızca kişisel öğrenme amaçlıdır; kurumsal lisanslar yazılı sözleşmeyle düzenlenir.
        </p>
        <p>
          Kullanıcı tarafından formlar veya destek kanalları ile iletilen geri bildirim ve öneriler, Üniversiteye bedelsiz, devredilebilir ve
          süresiz kullanım hakkı verebilir (ayrıca sözleşmede düzenlenmişse o hüküm geçerlidir).
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="tp-7">
        <h2 id="tp-7">7. Üçüncü taraf bağlantılar ve hizmetler</h2>
        <p>
          Platformda üçüncü taraf sitelere bağlantılar, gömülü haritalar, ödeme sayfaları veya video oynatıcılar bulunabilir. Bu sitelerin gizlilik
          uygulamalarından ve içeriklerinden Üniversite sorumlu değildir. Bağlantıyı ziyaret etmeden önce ilgili sitenin politikalarını incelemeniz
          önerilir.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="tp-8">
        <h2 id="tp-8">8. Sorumluluk sınırlaması</h2>
        <p>
          Platform &quot;olduğu gibi&quot; ve &quot;mevcut olduğu şekilde&quot; sunulur. Yasal olarak zorunlu olan haller dışında; kesintisiz
          erişim, hatasız yazılım veya belirli bir sonuca ulaşılacağına dair açık veya zımni garanti verilmez. Dolaylı zararlar, kâr kaybı, veri
          kaybı veya itibar kaybı için sorumluluk, yasal olarak mümkün olan azami ölçüde sınırlandırılabilir.
        </p>
        <p>
          Kullanıcı cihazı, internet bağlantısı veya üçüncü taraf yazılımlarından kaynaklanan sorunlardan Üniversite sorumlu tutulamaz.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="tp-9">
        <h2 id="tp-9">9. Ödeme, fiyat ve vergi</h2>
        <p>
          Listelenen fiyatlar, KDV ve benzeri yasal vergiler açıkça belirtilmedikçe ilan metnine tabidir. Ödeme, anlaşmalı ödeme kuruluşu üzerinden
          alınır; kart bilgileri mümkün olduğunca doğrudan ödeme sağlayıcı arayüzünde işlenir. Fatura bilgilerinin doğruluğundan kullanıcı sorumludur.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="tp-10">
        <h2 id="tp-10">10. İptal, iade ve cayma (bilgilendirme)</h2>
        <p>
          Mesafeli satış ve tüketici haklarına ilişkin ayrıntılar &quot;İptal ve İade Koşulları&quot; ile &quot;Mesafeli Satış Sözleşmesi&quot;
          belgelerinde düzenlenir (siteye eklendiğinde). Bu bölüm yalnızca çerçeve bilgilendirmesidir; çelişki halinde ilgili mesafeli satış
          metinleri ve mevzuat geçerlidir.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="tp-11">
        <h2 id="tp-11">11. Gizlilik politikası — genel ilkeler</h2>
        <p>
          Kişisel verileriniz 6698 sayılı KVKK ve ilgili mevzuata uygun işlenir. Veri sorumlusu Gazi Üniversitesi&apos;dir. Ayrıntılı aydınlatma için{" "}
          <Link to="/kvkk-aydinlatma-metni">Kişisel Verilerin Korunması Hakkında Aydınlatma Metni</Link> belgesine bakınız.
        </p>
        <p>
          Üniversite; veri minimizasyonu, amaçla sınırlılık, doğruluk, bütünlük ve gizlilik ilkelerine uygun süreçler kurmayı hedefler. Erişim
          yetkileri rol bazlı olarak sınırlandırılır ve &quot;ihtiyaç bilme&quot; esası uygulanır.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="tp-12">
        <h2 id="tp-12">12. Hangi veriler toplanır ve neden?</h2>
        <p>Örnek olarak aşağıdaki veriler işlenebilir (hizmete göre değişir):</p>
        <ul className="legal-page-list">
          <li>Kayıt ve kimlik: ad-soyad, T.C. kimlik numarası (gerektiğinde), iletişim bilgileri;</li>
          <li>Hesap ve güvenlik: e-posta, parola özeti, oturum kayıtları, IP ve cihaz bilgisi;</li>
          <li>Öğrenme analitiği: ders ilerlemesi, sınav sonuçları, platform içi etkileşim;</li>
          <li>Ödeme: işlem durumu ve referans (kart verisi doğrudan saklanmayabilir);</li>
          <li>İletişim: destek talepleri, çağrı kaydı özeti, e-posta içeriği;</li>
          <li>Pazarlama: yalnızca açık rıza veya meşru menfaat çerçevesinde ve tercih yönetimi ile.</li>
        </ul>
      </section>

      <section className="legal-page-block" aria-labelledby="tp-13">
        <h2 id="tp-13">13. Çerezler ve izleme teknolojileri</h2>
        <p>Platform şu amaçlarla çerez veya benzeri teknolojiler kullanabilir:</p>
        <ol className="legal-page-ol">
          <li>
            <strong>Zorunlu çerezler:</strong> Oturumun sürdürülmesi, güvenlik token&apos;ı, yük dengeleme ve sahteciliğin önlenmesi.
          </li>
          <li>
            <strong>Tercih çerezleri:</strong> Dil seçimi, erişilebilirlik ayarları.
          </li>
          <li>
            <strong>Analitik çerezler:</strong> Ziyaretçi sayıları, sayfa akışı, hata raporları (mümkünse anonimleştirilmiş).
          </li>
          <li>
            <strong>Pazarlama çerezleri:</strong> Kampanya ölçümü (yalnızca onayınız varsa).
          </li>
        </ol>
        <p>
          Tarayıcı ayarlarından çerezleri reddedebilirsiniz; ancak oturum açma veya ödeme gibi işlevler etkilenebilir. Üçüncü taraf analitik
          araçları kullanılıyorsa, ilgili sağlayıcının politikaları da geçerlidir.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="tp-14">
        <h2 id="tp-14">14. Veri paylaşımı ve yurt dışı aktarım</h2>
        <p>
          Verileriniz; barındırma, e-posta, ödeme, destek ve güvenlik hizmeti sağlayıcıları ile yasal zorunluluk halinde kamu kurumlarıyla
          paylaşılabilir. Yurt dışı aktarım KVKK ve Kurul düzenlemelerine tabidir. Ayrıntılar Aydınlatma Metni&apos;nde yer alır.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="tp-15">
        <h2 id="tp-15">15. Saklama süreleri</h2>
        <p>
          Veriler, işleme amacının gerektirdiği süre ve ilgili mevzuattaki zamanaşımı/archivleme süreleri boyunca saklanır; süre sonunda silinir,
          yok edilir veya anonimleştirilir. Farklı veri türleri için farklı süreler uygulanabilir.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="tp-16">
        <h2 id="tp-16">16. Haklarınız ve başvuru</h2>
        <p>
          KVKK md. 11 kapsamındaki haklarınız saklıdır. Başvuru usulü için{" "}
          <Link to="/kvkk-aydinlatma-metni">Kişisel Verilerin Korunması Hakkında Aydınlatma Metni</Link> içindeki «Başvuru yöntemi ve süreler»
          başlığına bakınız. Ayrıca tüketici iseniz 6502 sayılı Kanun kapsamındaki haklarınız için ilgili mevzuat uygulanır.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="tp-17">
        <h2 id="tp-17">17. İletişim ve pazarlama tercihleri</h2>
        <p>
          Ticari elektronik ileti gönderiminde 6563 sayılı Kanun ve ilgili düzenlemelere uyulur; onayınız yoksa izinsiz gönderim yapılmaz (meşru
          menfaat istisnaları hariç, mevzuata uygun şekilde). E-posta altındaki abonelikten çık bağlantısı veya hesap ayarları üzerinden tercihlerinizi
          güncelleyebilirsiniz.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="tp-18">
        <h2 id="tp-18">18. Uyuşmazlık çözümü ve uygulanacak hukuk</h2>
        <p>
          Uyuşmazlıklarda Türkiye Cumhuriyeti kanunları uygulanır. Tüketici işlemlerinde Tüketici Hakem Heyeti ve Tüketici Mahkemeleri yetkilidir;
          diğer hallerde Ankara Mahkemeleri ve İcra Daireleri yetkili olabilir (yasal zorunluluklar saklıdır).
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="tp-19">
        <h2 id="tp-19">19. Bölünebilirlik</h2>
        <p>
          Bu metnin herhangi bir hükmünün geçersiz sayılması, diğer hükümlerin yürürlüğünü etkilemez; geçersiz hüküm yerine amaca en yakın geçerli
          hüküm uygulanır.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="tp-20">
        <h2 id="tp-20">20. İletişim</h2>
        <p>
          Bu metinle ilgili sorularınız için sitede yer alan iletişim bilgilerini kullanabilirsiniz: telefon 0(312) 202 82 00, e-posta{" "}
          <a href="mailto:guzem@gazi.edu.tr">guzem@gazi.edu.tr</a>, adres 06560 Emniyet Mahallesi Bandırma Caddesi No:6/1 Yenimahalle / Ankara.
        </p>
      </section>
    </LegalDocShell>
  );
}

export default TermsPrivacyPage;
