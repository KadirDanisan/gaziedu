import { Link } from "react-router-dom";
import LegalDocShell from "../components/LegalDocShell";

function KvkkNoticePage() {
  return (
    <LegalDocShell title="Kişisel Verilerin Korunması Hakkında Aydınlatma Metni" lastUpdated="11 Mayıs 2026">
      <p className="legal-page-lead">
        6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) uyarınca, Gazi Üniversitesi bünyesinde yürütülen uzaktan eğitim ve ilgili hizmetlere
        ilişkin web sitesi, mobil arayüzler (varsa), çevrim içi eğitim platformu, kayıt, satın alma, iletişim ve destek süreçleri kapsamında kişisel
        verilerinizin işlenmesine dair veri sorumlusu sıfatıyla sizleri aydınlatmayı hedefliyoruz.
      </p>

      <section className="legal-page-block" aria-labelledby="kvkk-1">
        <h2 id="kvkk-1">1. Giriş ve kapsam</h2>
        <p>
          Bu Aydınlatma Metni; Gazi Üniversitesi tarafından işletilen ve uzaktan eğitim ile kurumsal/yetişkin eğitimi hizmetlerinin tanıtımı, kaydı,
          ödemesi, içerik sunumu, sınav ve değerlendirme, sertifikasyon, iletişim, müşteri ilişkileri, teknik destek, güvenlik, kalite ve yasal
          yükümlülüklerin yerine getirilmesi amacıyla yürütülen faaliyetler kapsamında, gerçek kişilere ait kişisel verilerin işlenmesine ilişkin
          genel ilkeleri açıklar.
        </p>
        <p>
          Metin, ziyaretçiler, adaylar, katılımcılar, veli/vasi (reşit olmayanlar adına), eğitmenler, kurumsal müşteri temsilcileri, tedarikçi ve iş
          ortakları çalışanları ile iletişim kurduğumuz tüm gerçek kişiler için geçerlidir. Tüzel kişiler adına işlem yapılması halinde, işlem yapan
          gerçek kişiye ait kimlik ve iletişim verileri de bu kapsamda değerlendirilir.
        </p>
        <p>
          Platform üzerinden sunulan belirli hizmetler için ek bilgilendirmeler, onay metinleri veya sözleşmeler uygulanabilir. Bu durumda ilgili
          belge ile birlikte değerlendirme esastır; çelişki halinde özel düzenleme önceliklidir.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="kvkk-2">
        <h2 id="kvkk-2">2. Veri sorumlusu</h2>
        <p>
          KVKK md. 3 uyarınca kişisel verilerinizin işlenmesinden sorumlu olan veri sorumlusu <strong>Gazi Üniversitesi</strong>&apos;dir. Üniversite
          bünyesindeki ilgili birimler (örneğin uzaktan eğitim, sürekli eğitim, öğrenci işleri, bilişim, hukuk ve malî işler birimleri) veri işleme
          faaliyetlerini üniversitenin organizasyon şeması ve iç görevlendirmeleri çerçevesinde yürütebilir.
        </p>
        <ul className="legal-page-list">
          <li>
            <strong>Unvan:</strong> Gazi Üniversitesi
          </li>
          <li>
            <strong>Adres:</strong> 06560 Emniyet Mahallesi Bandırma Caddesi No:6/1 Yenimahalle / Ankara
          </li>
          <li>
            <strong>E-posta (örnek iletişim):</strong>{" "}
            <a href="mailto:rimer@gazi.edu.tr">rimer@gazi.edu.tr</a> (birim ve süreçlere göre resmi başvuru kanalları değişebilir; güncel adres için
            web sitemizdeki iletişim bilgilerini takip ediniz.)
          </li>
          <li>
            <strong>KEP:</strong> Üniversitenin güncel KEP adresi resmi kayıtlarda ve web sitesinde yayımlanır.
          </li>
        </ul>
        <p>
          Veri sorumlusu sıfatıyla, kişisel verilerinizi yalnızca açıklanan amaçlar ve hukuki sebepler çerçevesinde işler; gerekli teknik ve idari
          tedbirleri alır ve üçüncü kişilere aktarımda KVKK&apos;ya uygunluğu temin etmeye çalışır.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="kvkk-3">
        <h2 id="kvkk-3">3. Tanımlar (kısa)</h2>
        <ul className="legal-page-list">
          <li>
            <strong>Kişisel veri:</strong> Kimliği belirli veya belirlenebilir gerçek kişiye ilişkin her türlü bilgi.
          </li>
          <li>
            <strong>Özel nitelikli kişisel veri:</strong> Sağlık, biyometrik veya genetik veriler gibi KVKK md. 6 kapsamındaki veriler (işlenmesi
            için ek şartlar gerekir).
          </li>
          <li>
            <strong>İşleme:</strong> Kişisel verilerin elde edilmesi, kaydedilmesi, depolanması, muhafaza edilmesi, değiştirilmesi, yeniden
            düzenlenmesi, açıklanması, aktarılması, devralınması, elde edilebilir hâle getirilmesi, sınıflandırılması veya kullanılmasının engellenmesi
            gibi veriler üzerinde gerçekleştirilen her türlü işlem.
          </li>
          <li>
            <strong>Veri sorumlusu:</strong> Kişisel verilerin işleme amaçlarını ve vasıtalarını belirleyen, veri kayıt sisteminin kurulmasından ve
            yönetilmesinden sorumlu olan gerçek veya tüzel kişi (bu metinde Gazi Üniversitesi).
          </li>
          <li>
            <strong>İlgili kişi (veri sahibi):</strong> Kişisel verisi işlenen gerçek kişi (siz).
          </li>
        </ul>
      </section>

      <section className="legal-page-block" aria-labelledby="kvkk-4">
        <h2 id="kvkk-4">4. İşlenen kişisel veri kategorileri</h2>
        <p>
          Sunduğumuz hizmetin niteliği, kullandığınız kanal ve yasal zorunluluklara göre aşağıdaki kategorilerden bir veya birden fazlası işlenebilir.
          Her kategori her kullanıcı için dolu olmayabilir.
        </p>
        <h3>4.1. Kimlik verileri</h3>
        <p>
          Ad, soyad, T.C. kimlik numarası (yasal zorunluluk veya kimlik doğrulama gerektiren süreçlerde), doğum tarihi, uyruk bilgisi, cinsiyet (yalnızca
          yasal/statüstel zorunluluk veya hizmetin gerektirdiği ölçüde), öğrenci/personel numarası gibi tanımlayıcılar.
        </p>
        <h3>4.2. İletişim verileri</h3>
        <p>Telefon, e-posta, adres, il/ilçe, posta kodu, acil durum iletişim bilgisi.</p>
        <h3>4.3. Müşteri işlem ve hizmet verileri</h3>
        <p>
          Eğitim kaydı, katılım durumu, tamamlanma yüzdesi, sınav ve ödev sonuçları, sertifika bilgileri, fatura/tahsilat bilgileri, destek talebi
          kayıtları, şikâyet ve geri bildirim içerikleri.
        </p>
        <h3>4.4. Finans ve ödeme verileri</h3>
        <p>
          Ödeme aracısı üzerinden işlenen işlem referans numarası, ödeme durumu, tutar, para birimi, taksit bilgisi; kart verilerinin sunucularımızda
          saklanmaması esasına uygun olarak ödeme hizmeti sağlayıcı tarafından tokenize edilmiş teknik tanımlayıcılar (uygulamaya göre).
        </p>
        <h3>4.5. İşlem güvenliği verileri</h3>
        <p>
          IP adresi, cihaz kimliği, tarayıcı türü ve sürümü, işletim sistemi, oturum açma zaman damgaları, log kayıtları, şüpheli işlem uyarıları,
          çift faktörlü doğrulama kanıtı (varsa), parola özetleri (salt + hash).
        </p>
        <h3>4.6. Pazarlama ve iletişim tercihleri</h3>
        <p>
          E-posta/SMS bildirim tercihleri, kampanya izinleri (açık rıza veya meşru menfaat sınırlarında), anket yanıtları.
        </p>
        <h3>4.7. Görsel ve işitsel kayıtlar</h3>
        <p>
          Canlı ders, proctoring (sınav gözetimi) veya destek görüşmesi kapsamında, açık bilgilendirme veya sözleşme ile sınırlı olarak ses/görüntü
          kaydı; profil fotoğrafı.
        </p>
        <h3>4.8. Mesleki deneyim ve eğitim verileri</h3>
        <p>Kurumsal başvurularda unvan, kurum adı, sertifika/diploma bilgisi, özgeçmiş özeti.</p>
        <h3>4.9. Hukuki işlem ve uyum verileri</h3>
        <p>Dava/defter kayıtları, resmi yazışmalar, denetim raporlarına ilişkin kimlik/iletişim referansları.</p>
      </section>

      <section className="legal-page-block" aria-labelledby="kvkk-5">
        <h2 id="kvkk-5">5. Kişisel verilerin işlenme amaçları</h2>
        <p>Kişisel verileriniz aşağıdaki amaçlarla sınırlı ve ölçülü biçimde işlenebilir:</p>
        <ol className="legal-page-ol">
          <li>Eğitim içeriğinin sunulması, erişim yetkilerinin yönetilmesi ve katılımın doğrulanması;</li>
          <li>Kayıt, ön kayıt, kontenjan ve ön şart kontrollerinin yapılması;</li>
          <li>Ödeme, faturalandırma, muhasebe ve vergi mevzuatına uyum;</li>
          <li>Sınav, değerlendirme, başarı tespiti ve sertifikasyon;</li>
          <li>Akademik danışmanlık, rehberlik ve kariyer destek süreçleri;</li>
          <li>Müşteri ilişkileri, talep ve şikâyet yönetimi;</li>
          <li>Bilgi güvenliği, dolandırıcılığın önlenmesi, yetkisiz erişimin tespiti;</li>
          <li>İstatistiksel analiz, hizmet kalitesinin ölçülmesi ve iyileştirilmesi (mümkün olduğunca anonimleştirilmiş veri ile);</li>
          <li>Yasal yükümlülüklerin yerine getirilmesi, resmi mercilere bilgi verilmesi;</li>
          <li>Hukuki uyuşmazlıklarda delil oluşturulması ve hakların korunması;</li>
          <li>İletişim ve bilgilendirme (kanuni dayanak ve tercihleriniz çerçevesinde).</li>
        </ol>
      </section>

      <section className="legal-page-block" aria-labelledby="kvkk-6">
        <h2 id="kvkk-6">6. Kişisel verilerin işlenmesinin hukuki sebepleri</h2>
        <p>KVKK md. 5 ve 6 uyarınca işleme faaliyetleri özellikle şu hukuki dayanaklara dayanabilir:</p>
        <ul className="legal-page-list">
          <li>Kanunlarda açıkça öngörülmesi;</li>
          <li>Bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması kaydıyla veri işlemenin gerekli olması;</li>
          <li>Veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi için zorunlu olması;</li>
          <li>İlgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla veri sorumlusunun meşru menfaatleri için veri işlenmesinin zorunlu olması;</li>
          <li>İlgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla veri işlemenin zorunlu olması (bazı istisnai haller);</li>
          <li>Açık rızanızın bulunması (özellikle pazarlama iletişimi, bazı özel nitelikli veriler veya yurt dışı aktarımında).</li>
        </ul>
        <p>
          Özel nitelikli kişisel verilerin işlenmesi, KVKK md. 6&apos;daki şartlara ve Kurul kararlarına uygun olarak sınırlıdır; aksi halde işlenmez
          veya anonimleştirilir.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="kvkk-7">
        <h2 id="kvkk-7">7. Kişisel verilerin toplanma yöntemi</h2>
        <p>Verileriniz özellikle şu kanallardan otomatik veya kısmen otomatik yollarla toplanabilir:</p>
        <ul className="legal-page-list">
          <li>Web sitesi ve çevrim içi platform formları (kayıt, iletişim, ödeme sayfası);</li>
          <li>Çağrı merkezi, e-posta veya fiziksel başvuru evrakları (ilgili birimlere iletilen kopyalar);</li>
          <li>Ödeme kuruluşu ve banka bildirimleri (işlem sonucu);</li>
          <li>Teknik loglar, çerezler ve benzeri teknolojiler;</li>
          <li>Kurumsal sözleşmeler kapsamında müşteri kurumunuzdan iletilen katılımcı listeleri (hukuki dayanak ve sözleşme şartlarına bağlı).</li>
        </ul>
      </section>

      <section className="legal-page-block" aria-labelledby="kvkk-8">
        <h2 id="kvkk-8">8. Kişisel verilerin aktarılması</h2>
        <p>
          Kişisel verileriniz, yukarıdaki amaçların gerçekleştirilmesi için gerekli olduğu ölçüde ve KVKK&apos;nın 8. ve 9. maddelerine uygun olarak
          üçüncü kişilere aktarılabilir. Örnek aktarım alıcı grupları:
        </p>
        <ul className="legal-page-list">
          <li>Ödeme hizmeti sağlayıcıları ve bankalar;</li>
          <li>Bulut barındırma, e-posta iletimi, yedekleme ve siber güvenlik hizmeti sağlayıcıları;</li>
          <li>Danışmanlık, denetim ve hukuk büroları (gizlilik yükümlülüğü altında);</li>
          <li>Yasal düzenleme gereği yetkili kamu kurum ve kuruluşları;</li>
          <li>Eğitim içeriği ortakları (ortak sertifika veya iş birliği programlarında sözleşmeyle sınırlı).</li>
        </ul>
        <p>
          Aktarılan taraflarla veri işleyen veya veri sorumlusu sıfatıyla sözleşmesel düzenlemeler yapılması, teknik/idari tedbirlerin talep edilmesi
          ve gerektiğinde KVKK&apos;nın şartlarına uygun aydınlatma/rıza süreçlerinin yürütülmesi hedeflenir.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="kvkk-9">
        <h2 id="kvkk-9">9. Yurt dışına aktarım</h2>
        <p>
          Kullanılan altyapı veya hizmetlerin yurt dışında barındırılması halinde, kişisel verileriniz yurt dışına aktarılabilir. Bu durumda KVKK md. 9
          kapsamında Kurul&apos;un ilan ettiği yeterlilik kararı bulunan ülkelere aktarım veya yeterli korumanın bulunmaması halinde Türkiye&apos;deki
          ve ilgili yabancı ülkedeki veri sorumlularının yeterli bir koruma yazılı taahhüt etmesi veya yazılı izin gibi şartlar aranır; ayrıca açık
          rıza gerekebilir. Güncel uygulama için işleme anındaki mevzuat esas alınır.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="kvkk-10">
        <h2 id="kvkk-10">10. Saklama süresi ve imha</h2>
        <p>
          Kişisel veriler, işlendikleri amaç için gerekli olan süre ve ilgili mevzuatta öngörülen zamanaşımı/archivleme süreleri kadar saklanır.
          Sürenin sonunda silme, yok etme veya anonim hale getirme yöntemleriyle imha edilir. Farklı veri kategorileri için farklı saklama politikaları
          uygulanabilir; örneğin muhasebe belgeleri için Vergi Usul Kanunu ve ilgili tebliğlerdeki süreler, log verileri için siber güvenlik ihtiyacına
          göre daha kısa süreler esas alınabilir.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="kvkk-11">
        <h2 id="kvkk-11">11. İlgili kişi olarak haklarınız (KVKK md. 11)</h2>
        <p>KVKK uyarınca veri sahibi olarak aşağıdaki haklara sahipsiniz:</p>
        <ol className="legal-page-ol">
          <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme;</li>
          <li>İşlenmişse buna ilişkin bilgi talep etme;</li>
          <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme;</li>
          <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme;</li>
          <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme;</li>
          <li>KVKK&apos;da öngörülen şartlar çerçevesinde silinmesini veya yok edilmesini isteme;</li>
          <li>Düzeltme/silme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme;</li>
          <li>Münhasıran otomatik sistemler ile analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme;</li>
          <li>Kanuna aykırı işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme.</li>
        </ol>
        <p>
          Kanun&apos;un 11. maddesinde düzenlenen haklarınızı kullanmak üzere taleplerinizi Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ
          çerçevesinde yazılı olarak veya Kurul&apos;un belirlediği diğer yöntemlerle iletebilirsiniz. Kimliğinizi doğrulamak amacıyla ek belge
          talep edilebilir.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="kvkk-12">
        <h2 id="kvkk-12">12. Başvuru yöntemi ve süreler</h2>
        <p>
          Başvurularınızda ad-soyad, imza (yazılı başvuruda), T.C. kimlik numarası (veya yabancı uyruklular için pasaport numarası), tebligata esas
          yerleşim veya iş yeri adresi, bildirim için e-posta adresi, telefon veya faks numarası ve talep konusunun açıkça belirtilmesi beklenir.
        </p>
        <p>
          Başvurular, talebin niteliğine göre en kısa sürede ve en geç <strong>30 (otuz) gün</strong> içinde ücretsiz olarak sonuçlandırılır;
          işlemin ayrıca bir maliyet gerektirmesi hâlinde Kurul tarifesindeki ücret alınabilir.
        </p>
        <p>
          Başvurunuzun reddedilmesi, verilen yanıtın yetersiz bulunması veya süresinde yanıt verilmemesi hâllerinde şikâyet yolu olarak Kişisel Verileri
          Koruma Kurulu&apos;na başvurma hakkınız saklıdır.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="kvkk-13">
        <h2 id="kvkk-13">13. Çerezler ve benzeri teknolojiler</h2>
        <p>
          Web sitesi ve platform, oturum yönetimi, güvenlik, tercihlerin hatırlanması ve istatistik için çerez veya SDK benzeri teknolojiler
          kullanabilir. Zorunlu çerezler hizmetin ifası için gerekebilir; analitik ve pazarlama çerezleri için mevzuata uygun şekilde onay veya
          ayarlarınız dikkate alınır. Ayrıntılar için{" "}
          <Link to="/kullanim-kurallari-ve-gizlilik">Web Sitesi Kullanım Kuralları ve Gizlilik Sözleşmesi</Link> belgesindeki çerez bölümüne bakınız.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="kvkk-14">
        <h2 id="kvkk-14">14. Güvenlik tedbirleri</h2>
        <p>
          Üniversite; erişim kontrolleri, şifreleme (uygulanabildiği ölçüde), güvenlik duvarı, günlük izleme, personel yetkilendirme, sözleşmesel
          gizlilik yükümlülükleri, yedekleme ve iş sürekliliği planları gibi teknik ve idari tedbirleri almaya çalışır. Olay müdahalesi ve ihlal
          bildirimi prosedürleri iç yönergelerle desteklenir.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="kvkk-15">
        <h2 id="kvkk-15">15. Metnin güncellenmesi</h2>
        <p>
          Mevzuat, Kurul kararları veya iş süreçlerindeki değişiklikler nedeniyle bu Aydınlatma Metni güncellenebilir. Güncel sürüm web sitesinde
          yayımlandığı tarihte yürürlüğe girer. Önemli değişikliklerde ek bildirim (e-posta veya platform içi duyuru) yapılabilir.
        </p>
      </section>

      <section className="legal-page-block" aria-labelledby="kvkk-16">
        <h2 id="kvkk-16">16. İletişim</h2>
        <p>
          Bu metinle ilgili sorularınız için web sitemizde yer alan iletişim bilgilerini kullanabilir veya KVKK kapsamındaki haklarınızı yukarıda
          açıklanan usulle iletebilirsiniz.
        </p>
      </section>
    </LegalDocShell>
  );
}

export default KvkkNoticePage;
