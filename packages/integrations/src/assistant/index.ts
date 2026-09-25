/** ИИ-помощник и ИИ-продавец — бот — `apps/ai-seller/` (ТЗ ред. 1, ADR-079, docs/assistant/README.md) */
export {
  IDENTITY_TTL_SECONDS,
  identityPayload,
  signIdentity,
  type IdentityFields,
} from './identity';
export {
  BotPanelClient,
  BotRejectedError,
  BotUnavailableError,
  SELLER_BOT,
  SUPPORT_BOT,
  SellerClient,
  SellerRejectedError,
  SellerUnavailableError,
  type BotKnowledgeFile,
  type BotNames,
  type BotPanelClientConfig,
  type SellerClientConfig,
  type SellerKnowledgeFile,
} from './bot-panel-client';
