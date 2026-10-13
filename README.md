# Gelir Gider

Oppo A73 (Android 10, 1080×2400) için yapılmış, tek ekranlı ve çevrimdışı çalışan basit bir gelir-gider takip uygulaması. Expo SDK 57 / React Native 0.86 ile yazıldı, kodun tamamı `App.js` dosyasında.

## Ne yapıyor

- **Maaş dönemi:** Her dönem ayın **10'unda** başlıyor, ertesi ayın 9'unda bitiyor. Örneğin "Ekim 2026" dönemi 10 Ekim ile 9 Kasım arası. Bu ayar `App.js` içindeki `PAYDAY` sabitinde.
- **Maaş:** Bir kez giriliyor, sonraki bütün aylarda otomatik olarak gelir sayılıyor. Maaşı değiştirirsen yeni tutar o dönemden itibaren geçerli oluyor, geçmiş aylar bozulmuyor (`salaries: [{ from: 'YYYY-MM', amount }]`).
- **Ek gelir:** Sadece girildiği döneme ait. Girmezsen 0 sayılıyor (`extras: { 'YYYY-MM': [...] }`).
- **Gider:** Tutar, kategori, tarih ve isteğe bağlı bir not. Tarih sadece o dönemin günleri arasında seçilebiliyor. Bir gidere dokununca düzenleme ve silme ekranı açılıyor.
- **Ana ekran:** Kalan para (büyük yazıyla), harcanan oranını gösteren bir çubuk, Gelir ve Gider kartları, "Nereye gitti?" kategori özeti ve güne göre gruplanmış harcama listesi.
- **Veri:** Sadece telefonda saklanıyor (`AsyncStorage`, anahtar `gelir-gider:v1`). İnternet ya da hesap gerekmiyor.
- **Arayüz:** Koyu tema (zinc nötrler, tek vurgu rengi zümrüt), Geist + Geist Mono fontları, Phosphor ikonları (emoji yok), basınca küçülen butonlar, sırayla beliren listeler, yüklenirken iskelet ekran ve formlarda alan altında hata mesajı. Ana ekranda "maaşa X gün, günde Y ₺" bilgisi var. Ekleme ve düzenleme ekranları Android'deki tam ekran pencere düzeninde ve Kaydet butonu üstte duruyor, böylece klavye açıkken de görünüyor.

## Mevcut durum

- [x] Uygulama kodu yazıldı (`App.js`)
- [x] `npx expo export --platform android` sorunsuz bundle alıyor
- [x] `npx expo-doctor`: 21/21 kontrol geçti
- [x] `app.json` ayarlandı (paket adı `com.eyuph.gelirgider`, koyu tema), `eas.json` eklendi (preview profili APK üretiyor)
- [x] GitHub Actions dosyası eklendi: `.github/workflows/android.yml`
- [ ] **İlk APK build'i henüz hiç çalıştırılmadı ve doğrulanmadı**
- [ ] Telefonda test edilmedi
- [ ] Uygulama ikonu hâlâ Expo'nun varsayılan ikonu

## Yapılacaklar (bulut Claude için)

1. **APK build'ini çalıştır.** `main` dalına yapılan her push, GitHub Actions'taki "Android APK" iş akışını tetikler. İş akışı şu adımları uygular:
   `npm ci` → `expo prebuild` → `./gradlew assembleRelease`
   Ardından APK'yı hem artifact olarak yükler hem de `v1.0.<run_number>` adıyla bir GitHub Release oluşturur.
   - Durumu izlemek için: `gh run list`, `gh run watch`, `gh run view --log-failed`
   - Build hata verirse sebebini düzelt. Muhtemel noktalar: JDK sürümü (şu an 17, RN 0.86 daha yenisini isteyebilir), Gradle bellek ayarı, prebuild ayarları.
   - Release APK, prebuild şablonundaki debug keystore ile imzalanıyor. Kişisel kullanım için bu yeterli. Keystore her build'de aynı olduğundan yeni sürümler eski sürümün üstüne kurulabiliyor.
2. **Yedek yol (EAS):** GitHub Actions bir türlü çalışmazsa `npx eas-cli@latest login` ile giriş yapıp `npx eas-cli@latest build -p android --profile preview` komutunu çalıştır. Bunun için ücretsiz bir Expo hesabı gerekiyor.
3. **Telefonda kontrol listesi:**
   - Maaşı gir, sonraki aya geç: maaş orada da görünmeli.
   - Ek gelir ekle: sadece o ayda görünmeli.
   - Gider ekle, düzenle, sil.
   - Uygulamayı tamamen kapatıp yeniden aç: veriler duruyor olmalı.
   - Klavye açıkken Kaydet butonu görünür kalmalı.
   - Durum çubuğu ve gezinme çubuğu içeriğin üstüne binmemeli (edge-to-edge).
4. **Sonra yapılabilecekler (şimdilik gerek yok):** Uygulama ikonu, verileri yedekleme ve geri yükleme (JSON dışa/içe aktarma), tekrarlayan sabit giderler (kira, fatura gibi).

**Kurallar:** Uygulamayı sade tut, yeni ekran ekleme. `android/` ve `ios/` klasörleri prebuild ile otomatik üretiliyor ve git'e eklenmiyor. Paket eklerken `npx expo install` kullan.

## Telefona kurulum

1. GitHub'da repodaki **Releases** bölümünden en son sürümün `GelirGider.apk` dosyasını telefona indir.
2. Dosyayı aç. Telefon bilinmeyen kaynaktan kurulum için izin isterse izin ver.
3. Yeni bir sürüm çıktığında aynı şekilde indirip kur. Eski sürümün üstüne kurulur ve veriler silinmez.

## Geliştirme

```bash
npm install
npx expo start        # telefondaki Expo Go uygulamasıyla QR kodu okutarak dene
```
