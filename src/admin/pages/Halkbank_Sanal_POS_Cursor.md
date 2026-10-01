# Halkbank Sanal POS — Cursor uygulama notu

## Amaç ve mevcut bilgiler
Mevcut projenin mimarisini inceleyerek Halkbank NestPay ödeme entegrasyonunu ekle. Backend .NET, frontend React yapısına ve mevcut sipariş/ödeme tablolarına uyum sağla. Çalışan başka banka entegrasyonları varsa koru.

| Ayar | Değer |
|---|---|
| ClientId | `500487032` |
| StoreKey | Kullanıcıda mevcut; sunucudaki gizli yapılandırmadan okunacak |
| storetype | `3d_pay_hosting` — panelde doğrulandı |
| hashAlgorithm | `ver3` — iletilen örnekteki değer |
| TranType | `Auth` — satış |
| currency | `949` — TL |
| lang / encoding | `tr` / `UTF-8` |
| Instalment | Tek çekim için boş değer; banka örneğiyle doğrula |
| refreshtime | Gelen örnekte `3` |

Bu modelde kart bilgileri bankanın ödeme sayfasında girilir; 3D doğrulamasının ardından ödeme işlemini banka/Payten tamamlar. Uygulama ayrıca ikinci bir satış isteği göndermemeli. DLL/JAR kullanımı bu HTTP form akışı için zorunlu değildir.

## Kurulacak akış
1. Kullanıcı ödeme başlatır. Backend kullanıcının sipariş yetkisini kontrol eder; tutarı veritabanındaki fiyat/indirimlerden hesaplar. Frontend'den gelen tutarı esas almaz.
2. Backend benzersiz `oid`, kriptografik rastgele `rnd` ve bekleyen ödeme kaydı oluşturur. Sipariş, kullanıcı, tutar, para birimi ve ödeme denemesi ilişkisini saklar.
3. Bankaya gönderilecek alanları oluşturur; `ver3` hash değerini StoreKey ile backend'de hesaplar.
4. Tarayıcı, backend'in ürettiği alanlarla bankanın doğrulanmış ödeme adresine HTML form üzerinden POST yapar. Kart numarası/CVV uygulamada toplanmaz.
5. Bankadan dönüş backend'deki HTTPS callback adresine gelir. `okUrl` ve `failUrl` aynı endpoint olabilir. Callback tarayıcıdaki JWT/oturum çerezine bağımlı olmamalı; banka yanıtı ayrıca doğrulanmalı.
6. Backend yanıtı doğrular, ödeme kaydını atomik olarak günceller ve kullanıcıyı frontend sonuç sayfasına yönlendirir. Sonuç sayfası gerçek ödeme durumunu backend'den okur.

Önerilen rotalar (mevcut projeye uyarlanabilir):
- `POST /api/payments/halkbank/initiate`
- `POST /api/payments/halkbank/callback`
- `GET /api/payments/{paymentId}/status` — kullanıcı/sipariş yetkisi kontrolüyle

## Form alanları
Sabit ayarlara ek olarak `amount`, `oid`, `rnd`, `hash`, `okUrl`, `failUrl` gönderilecek. Tutar, örneğin `9000.00` gibi noktalı ve iki ondalıklı biçimde hazırlanacak; örnekteki tutar sabitlenmeyecek.

`BillToName`, `BillToCompany`, `Email`, `tel` alanları kullanılacaksa doğru müşteri bilgileriyle doldurulmalı. Gelen örnekte e-posta yerine kimlik/ad, telefon yerine eğitim kodu bulunuyor; bunları kopyalama. Gereksiz kişisel veri gönderme.

Gelen örnekteki `https://guzemakademi.gazi.edu.tr/TrainingRegistration/PaymentResponse` bir örnek dönüş adresidir. Bu projeye ait olduğu doğrulanmadan kullanılmamalı; kendi backend callback adresimiz yapılandırılmalı.

## Hash ve ödeme doğrulaması
- StoreKey'i frontend'e, HTML hidden alanlarına, Git'e veya loglara yazma. Ortam değişkeni/secret yapılandırması kullan.
- Gelen örnekteki hazır `hash`, `oid` ve sabit `rnd="gazibidb"` değerlerini yeniden kullanma.
- Ver3 için parametre sıralaması, hariç tutulan alanlar, boş değerler, büyük/küçük harf, kaçış ve karakter kodlaması kurallarını bankanın resmi ver3 örneğinden doğrula. Eski SHA1/ver2 örneklerini ver3 ile karıştırma; istek ve yanıt hash kurallarını ayrı doğrula.
- Callback'te banka yanıt hash'ini doğrula; sipariş/ödeme denemesi, tutar, para birimi ve mağaza eşleşmesini kontrol et. Gereken alanlar dönüşte yoksa doğrulanmış işlem sorgulama akışını kullan.
- Başarı URL'sine dönüş veya yalnızca `mdStatus=1`, tahsilat kanıtı değildir. Bankanın model için tanımladığı ödeme sonucu alanlarını (`Response`, `ProcReturnCode`) ve 3D sonucunu birlikte kontrol et.
- Tekrarlanan/eşzamanlı callback aynı ödemeyi veya eğitim erişimini ikinci kez işlememeli. Başarılı ödeme durumu sonradan gelen başarısız dönüşle ezilmemeli.
- Dönüş gelmemesi/zaman aşımı otomatik olarak başarısız ödeme sayılmamalı; belirsiz işlem sorgulanıp uzlaştırılmalı.

## Uygulamadan önce doğrulanacak eksikler
1. **Test ve canlı form POST adresleri:** Paylaşılan örnekte `<form action="…">` bulunmuyor. Adresi tahmin etme; bankanın verdiği adresi kullan.
2. **Resmi ver3 istek ve yanıt hash örneği:** Eldeki PDF'lerde sürüm/model karışıklıkları var. Doğrulanmış örnek veya test vektörü olmadan hash uygulamasını tamamlanmış sayma.
3. **Test mağazası/anahtarı ve örnek ödeme yanıtı:** Canlı bilgileri test adresiyle karıştırma.
4. **İşlem sorgulama/iptal/iade gerekiyorsa:** İlgili API dokümanı ve API kullanıcısı ayrıca temin edilmeli. Panel yöneticisinin giriş şifresini API şifresi olarak kullanma.

Bu eksikler çözülürken servis, yapılandırma, ödeme kaydı ve endpoint iskeleti hazırlanabilir; canlı ödeme hazırmış gibi teslim edilmemeli.

## Kontrol ve teslim
Başarılı ödeme, banka reddi/3D iptali, bozuk hash, tutar/sipariş uyuşmazlığı, tekrarlanan callback ve zaman aşımı senaryolarını test et. Testte gerçek tahsilat başlatma; bankanın test ortamını kullan.

Teslimde değişen dosyaları, gerekli ortam değişkenlerini, callback adresini, test sonuçlarını ve kalan eksikleri kısa şekilde bildir.

Dayanak: Paylaşılan NestPay 3D ve 3D PAY dokümanları, Halkbank SSS, mağaza paneli ekran görüntüleri ve kullanıcıya iletilen ver3 HTML form örneği. Bu not bir uygulama talimatıdır; doğrulanmış ver3 algoritması veya canlı endpoint içermez.
