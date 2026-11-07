# AETHER: Otonom Enerji ve Karbon Sinir Sistemi
### Binalar ve Tesisler İçin Sıfır Donanımlı Otonom Yapay Zeka Karar Motoru
**Hedef Program:** Antalya COP31 – ETKİM Genç Tekno Girişim Kampı  
**Proje Sahibi:** Aras Demirtaş (Tenzile Erdoğan Anadolu Lisesi – 9/A)  
**Danışman Öğretmen:** Berkan Meral  
**Kategori:** İklim Teknolojileri (ClimateTech), Temiz Enerji Dönüşümü, Otonom Enerji Optimizasyonu  

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fkarargahprojecteal%2Faether-cop31-system)

---

## 🌟 Vizyon ve Çözülen Problem
AETHER, binaların, kampüslerin ve ticari tesislerin enerji yönetimini **sıfır donanım (CapEx-Free)** maliyetiyle otonomlaştıran bir yapay zeka karar motorudur.

Pahalı alt sayaçlar veya haftalar süren saha kablolamaları yerine; doğrudan **mevcut akıllı sayaç (smart meter) API akışlarını, şebeke dinamik tarife/emisyon verilerini ve meteorolojik dış parametreleri** harmanlar.

- **Hayalet Tüketim Avcısı (NILM):** Mesai dışı açık unutulan cihazları ve enerji kaçaklarını (%15-%30) tespit eder.
- **Pik Yük Tıraşlama (Peak Shaving):** Şebeke pik saatlerinde termal atalet kullanarak yükü kaydırır.
- **COP31 Karbon Karnesi:** Tasarruf edilen her kWh enerjiyi anlık şebeke karbon katsayısıyla çarparak denetlenebilir $CO_2e$ raporuna dönüştürür.

---

## 🛠️ Teknoloji Yığını (Tech Stack)
- **Frontend & UI:** React 19 (TypeScript), Vite 8, Tailwind CSS v4, Lucide Icons, Recharts
- **Tasarım Dili:** *Dark-Luxury / High-Tech Command Center*
- **Yapay Zeka Karar Motoru:** Google Gemini API (`@google/genai` SDK - `gemini-2.5-flash`) + Yapılandırılmış JSON Schema
- **Yedek Kural Motoru:** Çevrimdışı/Hızlı tepki için dahili fizik temelli deterministik NILM motoru
- **Donanım Soyutlama (HAL):** Simülasyon, MQTT Broker, WebSocket RS485 ve Smart Meter REST API adaptörleri
- **Masaüstü Hazırlığı:** Tauri v2 mimarisine tam uyumlu

---

## 🚀 Hızlı Başlangıç (Local Development)

### 1. Bağımlılıkları Yükleyin
```bash
npm install
```

### 2. Geliştirme Sunucusunu Başlatın
```bash
npm run dev
```
Uygulama `http://localhost:5173` adresinde çalışacaktır.

### 3. Üretim Derlemesi (Production Build)
```bash
npm run build
```

---

## 🌐 Vercel Deploy Kurulumu
1. [Vercel](https://vercel.com) paneline gidin.
2. **Add New Project** seçeneğine tıklayın.
3. GitHub hesabınızı bağlayıp `karargahprojecteal/aether-cop31-system` deposunu seçin.
4. **Deploy** butonuna tıklayın. Vercel otomatik olarak `npm run build` komutunu çalıştıracak ve dakikalar içinde canlıya alacaktır.
