export interface WizardChatState {
  enabled: boolean;
  used: number;
  limit: number;
  messages: Array<{
    requestId: string;
    role: string;
    text: string;
    state: string;
    sources: string[];
  }>;
  failed: string[];
}
export interface WizardState {
  chatSiteKey?: string | null;
  chat?: WizardChatState;
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
