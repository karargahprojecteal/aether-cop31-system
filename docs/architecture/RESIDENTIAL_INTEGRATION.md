# AETHER Residential Integration Blueprint
## End-to-End Home Deployment, Metering Infrastructure & Ingestion Protocols

---

## 1. The Core Residential Problem & Philosophy
Unlike commercial offices with modern Building Management Systems (BMS), residential housing presents vast heterogeneity:
- Different utility meter generations (electromechanical Ferraris, electronic smart meters with optical ports, or closed distribution meters).
- Strict safety constraints: Homeowners cannot and must not tamper with main electrical distribution boards (230V/400V).
- Variable internet connectivity: Home Wi-Fi experiences dropouts, router reboots, and DHCP lease renewals.

AETHER solves this through a **Layered, Zero-Friction Residential Adoption Model** that allows every home to start immediately regardless of their hardware maturity, scaling from manual bill tracking to real-time sub-second IoT telemetry.

---

## 2. The 5 Residential Integration Pathways

```
[Path 1: Utility Smart Meter (API / P1 / Optical)] ───┐
[Path 2: Existing Energy Monitors & Home Assistant] ───┼──► [AETHER Normalizer] ──► [Energy Intelligence]
[Path 3: AETHER Local Gateway (CT Clamps + MQTT)] ────┤            ▲
[Path 4: Smart Plugs & Sub-Meter IoT Relays] ─────────┤            │ (Quality & Confidence Tagging)
[Path 5: Manual & Monthly Invoice Ingestion] ─────────┘            │
```

---

### Pathway 1: Smart Meter Direct Integration (API / Optical / P1-HAN)
* **Description:** Reads consumption directly from the utility's smart electricity meter.
* **Communication Standards:**
  - Optical Port: IEC 62056-21 (ASCII/Binary readout via magnetic optical probe).
  - Wired Serial / HAN: P1 Port (DSMR / e-MUCS protocol, Dutch/Belgian/Scandinavian standard) or M-Bus (EN 13757).
  - High-level Protocol: DLMS/COSEM (Device Language Message Specification).
* **Hardware Required:**
  - For P1 Port: RJ12 to USB/ESP32 P1 dongle (~15-25 USD).
  - For Optical Port: IEC 62056-21 USB magnetic probe (~35-60 USD).
  - For Cloud API: None (pure software credentials).
* **User Permissions:** Customer utility contract number, optical port read consent, distribution company API authorization.
* **Installation Difficulty:** Low (Plug-and-play into P1 port or magnetic attachment to meter optical eye; zero wiring).
* **Data Types Received:** Active Import Energy ($kWh$), Active Export ($kWh$), Instantaneous Power ($W$), Voltage per phase ($V$), Current per phase ($A$).
* **Frequency:** 1 sec to 10 sec (P1 Port) or 15-minute / daily intervals (Distribution Cloud API).
* **Cost & Maintenance:** One-time dongle cost ($15–50), zero recurring maintenance.
* **Security & Privacy:** High privacy risk (minute-by-minute occupancy inferable). Requires TLS 1.3, optical challenge-response authentication.
* **Where It Fails:** Apartments where utility meters are locked in the building basement without Wi-Fi/cellular signal, or older analog meters without data ports.
* **Simulation vs. Reality:** In simulation, synthetic 1 Hz sinusoidal packets are generated. In real operation, raw byte frames are parsed, CRC-checked, and OBIS code mapped (`1.8.0` total import, `1.7.0` active power).

---

### Pathway 2: Existing Energy Monitors & Home Assistant Integration
* **Description:** Bridges to existing consumer energy hardware already owned by the user (Home Assistant, Shelly 3EM, Emporia Vue, IoTaWatt).
* **Communication Standards:** Home Assistant REST API (`/api/states`), WebSocket Event Stream, or MQTT Discovery.
* **Hardware Required:** Existing monitor already installed in consumer distribution board.
* **User Permissions:** Long-Lived Access Token (LLAT) for Home Assistant, local IP address and port.
* **Installation Difficulty:** Low (User copies Home Assistant token and URL into AETHER UI).
* **Data Types Received:** Grid Power ($W$), Grid Voltage ($V$), Sub-metered Heat Pump / EV Charger ($W, kWh$).
* **Frequency:** Real-time event push or 5-second polling.
* **Cost & Maintenance:** Zero added cost; maintenance tied to user's home server.
* **Security & Privacy:** Home Assistant tokens must be encrypted at rest with AES-256-GCM.
* **Where It Fails:** Non-technical users without an existing smart home server.
* **Simulation vs. Reality:** Simulated adapter emits steady sample entity states. Real adapter verifies HA instance reachability, handles TLS certificates, and reconciles entity unit mappings (`W`, `kW`, `Wh`, `kWh`).

---

### Pathway 3: AETHER Local Gateway & Non-Invasive CT Clamps
* **Description:** A dedicated, non-invasive residential micro-gateway (e.g., Raspberry Pi Zero 2W or ESP32-S3) connected to split-core Current Transformers (CT clamps) clipped around the incoming phase cables inside the home distribution box.
* **Communication Standards:** Secure MQTT over TLS (port 8883) with mutual client certificate authentication (mTLS) or WSS (WebSocket Secure).
* **Hardware Required:**
  - Split-core CT clamp (e.g., SCT-013-000 100A/50mA).
  - ADC/Energy IC (ATM90E32 or ADE7758).
  - Microcontroller/Gateway with Wi-Fi/Ethernet.
  - Cost: ~$45–$75 for single-phase, ~$85–$120 for three-phase.
* **Safety Mandate:** Non-invasive split-core clamps clip *over* insulated wires. **Zero copper cutting or live termination.** Must still advise licensed electrician assistance if opening main panel covers.
* **Offline Buffering:** If home internet disconnects, the gateway buffers up to 72 hours of telemetry in local Flash/SQLite with monotonically increasing sequence IDs. On reconnection, backfilled packets are synced idempotently.
* **Installation Difficulty:** Medium (Opening distribution box cover, clamping phase lines, zero screw terminal contact).
* **Security & Privacy:** Device-specific private key stored in ATECC608A secure element or encrypted storage.
* **Where It Fails:** Homes with inaccessible main feeder cables or zero electrical box space.

---

### Pathway 4: Smart Plug & Sub-Metered Appliance IoT Ingestion
* **Description:** Direct ingestion from consumer smart plugs (Shelly Plus Plug S, Tuya/Smart Life, TP-Link Kasa/Tapo, Tasmota).
* **Communication Standards:** Local HTTP REST, CoAP, or Local MQTT.
* **Hardware Required:** Certified 16A smart plugs ($12–$25 each).
* **User Permissions:** Local IP pairing or device cloud OAuth link.
* **Installation Difficulty:** Extremely Easy (Plug into wall outlet, plug appliance into plug).
* **Data Types Received:** Real appliance Active Power ($W$), Cumulative Energy ($kWh$), Voltage ($V$), Current ($A$).
* **Strict Quality Distinction:** This data represents **Sub-metered Appliance Load** (`SUB_METERED`), NOT total home consumption. AETHER never treats smart plug data as main meter input.
* **Where It Fails:** Heavy fixed appliances wired directly without plugs (central AC compressors, continuous induction hobs, large water heaters).

---

### Pathway 5: Manual & Monthly Invoice / Bill Ingestion
* **Description:** For homes with analog meters or locked utility rooms. Users upload utility bills (PDF / photo) or type monthly start/end meter index and bill amount.
* **Data Types Received:** Total Monthly Energy ($kWh$), Total Cost ($TL$), Billing Period Days, Active Tariff Structure (Single vs. Multi-time).
* **Frequency:** Monthly.
* **Installation Difficulty:** Zero hardware, immediate start.
* **Explicit Data Classification:** Classified as `MANUAL_BILL` with `confidence: 1.0` for monthly billing reconciliation, but `0.0` for real-time 1 Hz power flow or instantaneous anomaly alerts.
* **Intelligence Provided:** Monthly baseline regression, seasonal weather normalization, tariff optimization comparisons, and carbon footprint ledger.

---

## 3. Onboarding & Pairing Walkthrough: A New Resident's Journey

```
Step 1: Account Creation & Home Profiling
  ├── User inputs address, home type (Apartment / Villa), square meters, heating source.
  └── Selects Meter Infrastructure (Smart Meter / Analog / Don't Know).

Step 2: Pathway Recommendation
  ├── If Smart Meter: Recommends P1/Optical dongle or Cloud API.
  ├── If Has Home Assistant: Direct 1-click token connection.
  ├── If Standard Meter: Recommends AETHER CT Clamp Kit or Smart Plugs.
  └── If Analog Meter: Opens Monthly Bill tracker immediately.

Step 3: Secure Device Pairing
  ├── Gateway/Dongle generates ephemeral 8-character cryptographic Pairing Token (valid for 15 mins).
  ├── User enters pairing code into AETHER Residential Console.
  ├── Server validates token, claims device, assigns tenantId/homeId, and issues persistent mTLS certificate/API key.

Step 4: Real-Time Handshake & Sanity Verification
  ├── AETHER waits for 10 consecutive verified telemetry packets.
  ├── Verifies Voltage range (207V - 253V nominal for 230V ±10%).
  ├── Verifies Frequency (49.5 Hz - 50.5 Hz).
  ├── Confirms monotonic timestamp progression.

Step 5: Operational Launch
  └── Home dashboard unlocks; baseline learning period (7 days) begins.
```

---

## 4. Hardware Safety & Professional Electrician Boundaries
1. **Passive Read-Only Rule:** AETHER does not install actuated main breakers or controllable relays on the main service feeder.
2. **Certified Equipment:** All hardware must carry CE and LVD (Low Voltage Directive) compliance.
3. **No Direct Mains Exposure:** CT clamps are galvanically isolated through magnetic induction.
4. **Professional Warning:** Any installation requiring panel cover removal displays an unskippable safety notice recommending a certified electrician.
