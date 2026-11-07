import { GoogleGenAI } from '@google/genai';
import { AIDecision, DecisionPriority, AnomalyType } from '../../types/decisions';
import { TelemetryPoint } from '../../types/telemetry';
import { StressScenario } from '../../types/scenarios';
import { generateHeuristicDecisions } from './fallbackRuleEngine';

export class GeminiDecisionEngine {
  private apiKey: string = '';
  private genAiClient: GoogleGenAI | null = null;
  private isAnalyzing: boolean = false;

  constructor() {
    // Çevre değişkeninden veya localStorage'dan API anahtarını dene
    const savedKey = typeof window !== 'undefined' ? localStorage.getItem('AETHER_GEMINI_API_KEY') || '' : '';
    if (savedKey) {
      this.setApiKey(savedKey);
    }
  }

  public setApiKey(key: string): void {
    this.apiKey = key.trim();
    if (this.apiKey) {
      this.genAiClient = new GoogleGenAI({ apiKey: this.apiKey });
      if (typeof window !== 'undefined') {
        localStorage.setItem('AETHER_GEMINI_API_KEY', this.apiKey);
      }
    } else {
      this.genAiClient = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('AETHER_GEMINI_API_KEY');
      }
    }
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  public hasValidKey(): boolean {
    return !!this.apiKey && this.apiKey.length > 10;
  }

  /**
   * Telemetri verilerini analiz eder ve yapılandırılmış aksiyon kararları üretir
   */
  public async analyzeTelemetry(
    currentTelemetry: TelemetryPoint,
    activeScenario: StressScenario | null
  ): Promise<AIDecision[]> {
    if (this.isAnalyzing) return [];
    this.isAnalyzing = true;

    try {
      if (this.hasValidKey() && this.genAiClient) {
        try {
          return await this.callGeminiAPI(currentTelemetry, activeScenario);
        } catch (apiErr) {
          console.warn('Gemini API call failed, falling back to deterministic AETHER rule engine:', apiErr);
          return generateHeuristicDecisions(currentTelemetry, activeScenario);
        }
      } else {
        // API key yoksa anında yüksek hassasiyetli AETHER kural motorunu çalıştır
        return generateHeuristicDecisions(currentTelemetry, activeScenario);
      }
    } finally {
      this.isAnalyzing = false;
    }
  }

  private async callGeminiAPI(
    telemetry: TelemetryPoint,
    activeScenario: StressScenario | null
  ): Promise<AIDecision[]> {
    if (!this.genAiClient) return [];

    const prompt = `
Sen AETHER Otonom Enerji ve Karbon Sinir Sistemi'nin çekirdek Yapay Zeka Karar Motorusun.
Hedef: Binalardaki gereksiz "hayalet tüketimi" (Phantom Load) yok etmek, şebeke pik yükünü kaydırmak (Peak Shaving) ve COP31 standartlarında karbon ayak izini en aza indirmek.

Gelen Anlık Akıllı Sayaç ve Telemetri Verisi:
- Toplam Çekilen Aktif Güç: ${telemetry.activePowerKw} kW
- Voltaj: ${telemetry.voltage} V | Frekans: ${telemetry.frequency} Hz | Güç Faktörü: ${telemetry.powerFactor}
- NILM Yük Ayrıştırması:
  * İklimlendirme (HVAC): ${telemetry.nilm.hvacKw} kW
  * Aydınlatma: ${telemetry.nilm.lightingKw} kW
  * Kesintisiz Baz Yük (IT/Server): ${telemetry.nilm.baseLoadKw} kW
  * Hayalet Yük (Phantom Load - Kaçak/Açık Kalan): ${telemetry.nilm.phantomLoadKw} kW
  * Mekanik / Endüstriyel: ${telemetry.nilm.industrialLoadKw} kW
  * Çatı Güneş (GES) Üretimi: ${telemetry.nilm.solarGenerationKw} kW
- Dış Ortam Sıcaklığı: ${telemetry.outdoorTempC} °C | Nem: %${telemetry.outdoorHumidityPercent}
- Güneş Işınımı: ${telemetry.solarIrradianceWm2} W/m² | Doluluk Oranı: %${telemetry.occupancyRatePercent}
- Şebeke Karbon Yoğunluğu: ${telemetry.gridCarbonIntensityGCo2PerKwh} gCO2/kWh
- Anlık Elektrik Tarifesi: ${telemetry.gridElectricityPriceTryPerKwh} TL/kWh

${activeScenario && activeScenario.isActive ? `AKTİF STRES SENARYOSU: "${activeScenario.name}" (${activeScenario.category}) - ${activeScenario.promptHintForGemini}` : 'Sistem normal operasyon döngüsünde.'}

Lütfen bu veriyi incele ve binanın enerji/karbon optimizasyonu için en kritik 1 ila 3 adet uygulanabilir OTONOM KARAR (AIDecision) üret.
Kararlarını SADECE geçerli bir JSON dizisi formatında döndür:

\`\`\`json
[
  {
    "id": "gemini-${Date.now()}-1",
    "timestamp": "${new Date().toISOString()}",
    "anomalyType": "PHANTOM_LOAD" | "PEAK_SURGE" | "SOLAR_DIP" | "THERMAL_STRESS" | "TARIFF_SPIKE" | "GRID_CARBON_HIGH",
    "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
    "title": "Kısa ve net aksiyon başlığı",
    "diagnosis": "Sensör verilerine dayalı kök neden teşhisi",
    "recommendedAction": "Uygulanacak somut teknik müdahale",
    "commandPayload": {
      "subsystem": "HVAC" | "LIGHTING" | "BATTERY_STORAGE" | "LOAD_SHEDDING" | "PUMP_CONTROL",
      "action": "TEKNIK_KOMUT_ADI",
      "parameters": { "paramName": "paramValue" },
      "estimatedKwReduction": 12.5
    },
    "projectedKwhSaving": 45.0,
    "projectedCo2ReductionKg": 21.8,
    "projectedCostSavingTry": 175.5,
    "confidenceScore": 94,
    "status": "PENDING_APPROVAL",
    "source": "GEMINI_AI"
  }
]
\`\`\`
`;

    const response = await this.genAiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '';
    // JSON bloğunu temizle ve parse et
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as AIDecision[];
      return parsed.map(d => ({
        ...d,
        id: d.id || `gemini-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        timestamp: d.timestamp || new Date().toISOString(),
        source: 'GEMINI_AI' as const,
        status: 'PENDING_APPROVAL' as const,
      }));
    }

    return generateHeuristicDecisions(telemetry, activeScenario);
  }
}

export const geminiDecisionEngineInstance = new GeminiDecisionEngine();
