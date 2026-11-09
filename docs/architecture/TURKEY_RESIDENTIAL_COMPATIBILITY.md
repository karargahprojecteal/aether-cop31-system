# AETHER Turkey Residential Electricity & Grid Compatibility Specification
## Technical Reality of Turkish Metering Infrastructure, Distribution Grids & EPDK Regulations

---

## 1. Executive Summary: The Turkish Residential Context
In Turkey, the residential electricity landscape has unique regulatory, technical, and structural characteristics that dictate integration strategy:
1. **OSOS (Otomatik Sayaç Okuma Sistemi):** Mandated by EPDK (Energy Market Regulatory Authority), OSOS remotely reads meters above a certain annual consumption threshold (~10,000 to 100,000 kWh/year). **Standard residential consumers (<5,000 kWh/year) are predominantly excluded from OSOS.**
2. **Distribution API Reality:** The 21 electricity distribution regions (BEDAŞ, AYEDAŞ, Toroslar EDAŞ, GDZ, Başkent, Akdeniz EDAŞ, etc.) **do not currently provide a public, machine-readable REST API** for residential consumers to query their 15-minute or real-time consumption data.
3. **Meter Physical Access:** In multi-story apartment complexes (*apartman/site*), electricity meters are clustered in a central ground floor or basement electrical room (*sayaç panosu*), often locked by the building management or distribution company, distant from the resident's home Wi-Fi.

Therefore, **AETHER does NOT assume utility API availability or easy basement smart meter access for all Turkish homes.** Instead, AETHER provides verified, grounded integration pathways categorized by feasibility:

| Integration Pathway | Feasibility in Turkey | Operational Status in AETHER | Technical Route |
| :--- | :---: | :---: | :--- |
| **A. In-Home Sub-Panel CT Clamp (AETHER Gateway)** | **Highest (95%)** | **READY / TESTED** | Installed inside the resident's in-unit breaker panel (*sigorta kutusu*). Zero basement dependency. |
| **B. Home Assistant / Shelly 3EM / Tuya** | **High (80%)** | **READY / VERIFIED** | Reads user-installed smart relays, smart plugs, or energy monitors via Wi-Fi. |
| **C. Monthly Bill & Tariffs (E-Devlet / Dağıtım Faturası)** | **Universal (100%)** | **READY / VERIFIED** | Ingestion of single-rate vs. 3-time (*Gündüz / Puant / Gece*) EPDK tariffs and kWh. |
| **D. Meter Optical Port Readout (IEC 62056-21)** | **Medium (35%)** | **PILOT / CONDITIONAL** | Applicable to detached villas or accessible meter rooms with battery-powered optical dongle. |
| **E. Utility Distribution Cloud API** | **Low (<5%)** | **PLANNED / REGULATION_PENDING** | Awaiting EPDK Open Data mandate for consumer API access. |

---

## 2. Common Turkish Electricity Meter Manufacturers & Ports

In Turkey, the residential electronic meter market is dominated by four domestic manufacturers complying with TS EN 50470-1 / TS EN 50470-3:

### 2.1 Köhler Electricity Meters (e.g., AEL.TF.xx, BEM.xx)
- **Optical Port:** Standard IEC 62056-21 magnetic optical communication head on the front cover. Baud rate: 300 to 9600 bps.
- **Data Protocol:** ASCII mode or DLMS/COSEM.
- **P1/HAN Port:** **Absent on standard residential models.**
- **Integration Approach:** Requires magnetic optical reader or internal breaker panel CT clamp.

### 2.2 Luna Electricity Meters (e.g., LUN10, LUN31)
- **Optical Port:** Present on all electronic models. OBIS code output supported.
- **RS-485 Port:** Present only on OSOS-capable commercial/industrial variants. Residential models do not expose accessible terminal blocks.
- **Integration Approach:** CT clamp in in-home panel.

### 2.3 Makel (e.g., M500, M600 series)
- **Optical Port:** IEC 62056-21 compliant optical communication port.
- **RF / Mesh Module:** Some new pilot deployments feature 868 MHz ISM band wireless M-Bus, but encryption keys are strictly held by the distribution company (DSO).
- **Integration Approach:** CT clamp or Home Assistant smart plug bridge.

### 2.4 Baylan & Viko
- Standard optical port for handheld meter reader (*endeksör*). No user-facing RJ12 or wireless HAN port.

---

## 3. EPDK Tariff Structures & Versioned Calculation Model

AETHER models the official EPDK residential multi-time tariff structure (3-zamanlı tarife) based on official regulatory decisions:
- **Authority:** Enerji Piyasası Düzenleme Kurumu (EPDK)
- **Official Gazette:** 2024-07-01 tarihli ve 32590 sayılı Resmî Gazete
- **Tariff Version:** `2024-Q3-MESKEN-01`
- **Rates (Single-term Residential):**
  1. **Gündüz (Daytime): 06:00 – 17:00** (4.20 TRY/kWh)
  2. **Puant (Peak): 17:00 – 22:00** (6.85 TRY/kWh — peak grid stress period)
  3. **Gece (Night): 22:00 – 06:00** (2.15 TRY/kWh — lowest off-peak rate)

### 3.1 Electronic Meter Clock Drift & Legacy DST Offset
In Turkey, daylight saving time (DST) was permanently repealed in September 2016, fixing Turkey to permanent UTC+3. However:
- Many electronic meters deployed before 2016 (Köhler, Luna, Viko) still have automatic winter-time clock adjustments hardcoded in their internal firmware.
- Between late October and late March, these legacy meters fall back to UTC+2, creating a 1-hour shift between national wall-clock time and the meter's internal tariff registers.
- AETHER incorporates `meterClockOffsetHours` (-1 or 0) in `EnergyIntelligenceEngine` and `homes` table to calculate the true physical billing register window.

### 3.2 Projected vs. Measured Savings Honesty
- **Projected Savings (Öngörülen Tasarruf):** Calculations produced prior to or immediately during load shift recommendations are explicitly flagged as `isVerifiedMeasuredSavings: false`.
- **Measured Savings (Ölçülen Fiili Tasarruf):** Certified only after continuous physical smart-meter or sub-meter logging establishes a post-intervention verified baseline.

---

## 4. National Grid Carbon Factor (Türkiye TEİAŞ & TEDAŞ Baseline)
- **Source:** TEİAŞ 2023-2024 Türkiye Elektrik Üretim-İletim İstatistikleri & TEDAŞ Kayıp-Kaçak Raporu
- **Generation-Level Emission Factor:** **0.462 kg CO₂e / kWh** (Santral çıkışı bara ortalaması)
- **Consumption-Point Emission Factor:** **0.498 kg CO₂e / kWh** (İletim ve dağıtım teknik şebeke kayıpları [~%7.3] dahil sayaç teslim noktası faktörü)
- **Diurnal Peaker Variation:**
  - Off-peak Nighttime baseload (hydro & wind): ~0.385 kg CO₂e / kWh
  - Midday solar peak generation: ~0.410 kg CO₂e / kWh
  - Evening fossil peaker surge (17:00 - 22:00): ~0.542 kg CO₂e / kWh

---

## 5. Legal & Safety Boundaries under Turkish Law

### 5.1 Elektrik İç Tesisleri Yönetmeliği
- Any physical intervention inside electrical distribution panels involving breakers, busbars, or service entrance cabling strictly requires an Authorized Electrical Technician (*Yetkili Elektrikçi* - EMO / MYK Level 4/5).
- AETHER's `LocalGatewayAdapter` sets `requiresCertifiedElectrician: true`. DIY installation inside live panels is strictly prohibited.

### 5.2 KVKK (Kişisel Verilerin Korunması Kanunu - Law No. 6698)
- High-frequency electrical telemetry reveals exact occupancy, appliances, and daily routines.
- Under KVKK Article 5 & 6, explicit consent is gathered during onboarding.
- All persisted data is bound to tenant isolation boundaries, and users possess full data export and right-to-erasure (Right to be Forgotten) controls.
