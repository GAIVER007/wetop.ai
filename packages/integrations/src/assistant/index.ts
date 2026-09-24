/** ИИ-помощник и ИИ-продавец — бот — `apps/ai-seller/` (ТЗ ред. 1, ADR-077, docs/assistant/README.md) */
export { IDENTITY_TTL_SECONDS, identityPayload, signIdentity, type IdentityFields } from './identity';
export {
  SellerClient,
  SellerRejectedError,
  SellerUnavailableError,
  type SellerClientConfig,
  type SellerKnowledgeFile,
} from './seller-client';
