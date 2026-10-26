/**
 * Centralised demo progression policy for the self-paced learning sequence.
 * These values are DEMO defaults inferred from the reference screenshots
 * ("Complete unlocks in 1:25", "1 chapter unlocks daily", "Pass mark 80%").
 * They are NOT approved production academic rules.
 */
export const progressionPolicy = {
  /** Seconds a learner must spend on an activity before "Complete" unlocks. */
  activityGateSeconds: {
    reading: 85,
    lecture: 87,
    practiceQuiz: 3,
    matching: 60,
    assessment: 0,
  },
  /** Reading must be scrolled to the bottom before completion counts. */
  requireReadToBottom: true,
  /** Pass marks (percentage). */
  passMark: {
    matching: 80,
    assessment: 70,
  },
  /** How many chapters are released per day after enrolment. */
  chapterReleasePerDay: 1,
  /** Whether the next chapter also requires passing the current chapter assessment. */
  requireAssessmentPassToUnlockNextChapter: true,
  /** Accelerated-clock jump used by the developer scenario (days). */
  acceleratedClockJumpDays: 1,
} as const;

export type ProgressionPolicy = typeof progressionPolicy;
