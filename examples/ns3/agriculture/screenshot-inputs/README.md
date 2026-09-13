# Field2Sim screenshot için koordinatlar

1. Field2Sim’de Static tipinde bir Node Group oluşturun.
2. `static-120-sensors.txt` içeriğini Latitude/Longitude Input alanına yapıştırın.
3. Mobile tipinde ikinci bir grup oluşturun; `mobile-uav-route.txt` içeriğini yapıştırın.
4. Yükseklik sütununu korumak için Enable 3D export seçeneğini açın. Bu örnekte sensörler 0 m, UAV 30 m olarak tanımlanmıştır; bunlar arazi rakımı değildir. Otomatik rakım sorgusu değerleri değiştirirse saklanan metinleri tekrar yapıştırın.
5. Ortak origin için statik gruptaki 13 numaralı düğüme sağ tıklayıp Set as Origin (0,0) seçin.

Origin: latitude 40.403467943, longitude 29.171353402, altitude 0 m.

120 statik sensör (ID 1–120), 118 mobil waypoint (ID 121).
Satır düzeni: node-id time-seconds latitude longitude [altitude-metres].
Statik dosyada yazılmayan yükseklik 0 m’dir.
Dosyalar Upload .dat ile değil, coğrafi giriş alanına yapıştırılarak yüklenmelidir.
Haritadaki alan Gemlik–Umurbey çevresindedir. İki grup aynı anda görünür.
Bu dosyalar başarılı ns-3 koşumu için Field2Sim arayüzünde kullanılan girişlerin kopyalarıdır.
