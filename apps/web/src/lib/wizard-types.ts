export interface WizardState {
  guestSessionId: string;
  guestToken?: string;
  lastStep: string;
  draft: {
    businessName: string;
    niche: string;
    description: string;
    wizardData: Record<string, string>;
    revision: number;
    hasGenerated: boolean;
    testMessagesUsed: number;
  };
}
