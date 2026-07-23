/** Resposta de POST /images (síncrono). */
export type GoogleFlowImageMedia = {
  mediaGenerationId?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
};

export type GoogleFlowImagesResponse = {
  jobId?: string;
  media?: GoogleFlowImageMedia[];
  remainingCredits?: number;
  error?: string;
  reason?: string;
};

export type GoogleFlowErrorBody = {
  error?: string;
  reason?: string;
  retryAfter?: number;
};
