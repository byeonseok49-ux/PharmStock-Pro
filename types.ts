
export interface Patient {
  id: number;
  name: string;
  gender: '남' | '여';
  age: number;
  contact: string;
  dosageTime: string[];
  keyMedication: string;
  endDate: string; // ISO format (YYYY-MM-DD)
  condition: string;
}

export interface InventoryStatus {
  medication: string;
  count: number;
  urgentCount: number;
}
