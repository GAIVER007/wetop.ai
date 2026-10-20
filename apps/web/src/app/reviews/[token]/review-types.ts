export type BeautyReviewMaster = { key: string; name: string };

export type BeautyReviewPreview =
  | { status: 'OPEN'; expiresAt: string; masters: BeautyReviewMaster[] }
  | { status: 'SUBMITTED' };

export type BeautyReviewDraft = {
  masterKey: string;
  stars: number;
  comment?: string;
};
