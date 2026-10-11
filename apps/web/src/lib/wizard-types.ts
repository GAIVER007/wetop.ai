export interface WizardState {
  generateSiteKey?: string | null;
  generationsUsed?: number;
  generation?: { id: string; state: string; error: string | null } | null;
  generated?: { prompt: string; knowledge: Array<{ title: string; content: string }> } | null;
  scanSiteKey?: string | null;
  scan?: { id: string; state: string; error: string | null } | null;
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
