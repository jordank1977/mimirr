export interface BookshelfConfig {
  url: string;
  apiKey: string;
}

export interface QualityProfile {
  id: number;
  name: string;
  upgradeAllowed: boolean;
  cutoff: number;
}
