/** ИИ-помощник и ИИ-продавец — бот на ветке `ai-seller` (ТЗ ред. 1, ADR-076, docs/assistant/README.md) */
export { IDENTITY_TTL_SECONDS, identityPayload, signIdentity, type IdentityFields } from './identity';
export {
  SellerClient,
  SellerRejectedError,
  SellerUnavailableError,
  type SellerClientConfig,
  type SellerKnowledgeFile,
} from './seller-client';
