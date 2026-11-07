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

## 3. EPDK Tariff Structures & Accurate Calculation Model

AETHER models the official EPDK residential multi-time tariff structure (3-zamanlı tarife):

1. **Gündüz (Daytime): 06:00 – 17:00** (Standard tariff rate)
2. **Puant (Peak): 17:00 – 22:00** (Highest tariff rate, grid stress period — ~2.0x to 2.4x daytime cost)
3. **Gece (Night): 22:00 – 06:00** (Lowest tariff rate — ~0.5x to 0.6x daytime cost)
4. **Tek Zamanlı (Single Tariff):** Flat per-kWh rate with graduated tier (Kademe 1: up to 8 kWh/day (~240 kWh/month); Kademe 2: above threshold with ~1.5x price multiplier).

AETHER's **Peak Shaving** and **Load Shifting** engine is tuned specifically to migrate flexible residential loads (dishwasher, washing machine, EV charging, heat pump pre-heating) from **Puant (17:00–22:00)** into **Gece (22:00–06:00)**, resulting in up to 35% bill reduction without decreasing total energy usage.

---

## 4. National Grid Carbon Factor (Türkiye TEİAŞ Mix)
- Turkey's national electricity generation mix fluctuates seasonally between hydro, solar, wind, lignite, imported coal, and natural gas.
- **AETHER Grid Carbon Baseline:** 
  - Off-peak / Daytime solar hours: ~380 – 430 $g\text{CO}_2/kWh$.
  - Evening peak hours (gas & coal peakers online): ~520 – 580 $g\text{CO}_2/kWh$.
  - Default average emission coefficient: **0.462 $\text{kg CO}_2/kWh$** (TEİAŞ / Ministry of Energy National GHG Inventory).

---

## 5. Legal & Safety Boundaries under Turkish Law

### 5.1 Elektrik İç Tesisleri Yönetmeliği (Electrical Indoor Installations Regulation)
- Any intervention involving cutting main insulation, replacing circuit breakers, or altering service entrance cable connections must be performed by an Authorized Electrical Technician (*Yetkili Elektrikçi* - Chamber of Electrical Engineers / Vocational Qualification Authority MYK Level 4/5).
- **AETHER Compliance Rule:** AETHER hardware instructions strictly mandate **non-invasive, split-core CT clamps** that latch around existing insulated conductors. The user is strictly warned not to expose bare busbars.

### 5.2 KVKK (Kişisel Verilerin Korunması Kanunu - Law No. 6698)
- 1 Hz high-frequency electrical telemetry reveals exact waking, sleeping, cooking, and presence patterns.
- Under KVKK Article 5 & 6, explicit consent (*Açık Rıza Metni*) and privacy notice (*Aydınlatma Metni*) are displayed during onboarding.
- Cloud storage encrypts all telemetry at rest. Data is anonymized before AI model training.
