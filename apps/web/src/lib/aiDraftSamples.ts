export type AiDraftSlide = {
  number: number;
  heading: string;
  bullets: string[];
  narration: string;
};

export type AiDraftStoryboard = {
  title: string;
  estimated_duration_sec: number;
  slides: AiDraftSlide[];
};
