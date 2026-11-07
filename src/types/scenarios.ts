export type ScenarioCategory = 
  | 'GRID_SURGE' 
  | 'PHANTOM_INTRUSION' 
  | 'SOLAR_FAILURE' 
  | 'EXTREME_WEATHER' 
  | 'PEAK_TARIFF';

export interface ScenarioModifiers {
  powerMultiplier?: number;
  phantomKwAdd?: number;
  solarDropPercent?: number; // 0 - 100
  gridCarbonMultiplier?: number;
  tariffMultiplier?: number;
  outdoorTempOffsetC?: number;
  occupancyOverridePercent?: number;
}

export interface StressScenario {
  id: string;
  name: string;
  shortTag: string;
  description: string;
  category: ScenarioCategory;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  isActive: boolean;
  effectSummary: string;
  modifiers: ScenarioModifiers;
  promptHintForGemini: string;
}
