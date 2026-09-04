export type OnboardingProgress = {
  matter_id: string;
  percent: number;
  missing: string[];
  is_complete: boolean;
  personal_details?: any;
  address_history?: any;
  sof?: any;
  consents?: any;
};
