import { createTestServices } from '../../src/services';
import { createMemoryStore } from '../../src/storage/asyncStorage';
import { scenario } from '../../src/services/mock/simulate';
import { IDS } from '../../src/fixtures/constants';
import { clock, DAY_MS } from '../../src/utils/clock';
import { progressionPolicy } from '../../src/config/progressionPolicy';

beforeEach(() => { scenario.set({ latencyMs: 0, mode: 'success' }); clock.reset(); clock.setOffsetMs(new Date('2026-09-25T15:44:17-07:00').getTime() - Date.now()); });

async function setup() {
  const { repo, services } = createTestServices(createMemoryStore());
  await repo.hydrate();
  return { repo, services };
}

describe('Learning progression', () => {
  it('derives gates: only chapter 1 open on enrolment day, reading 2 current', async () => {
    const { services } = await setup();
    const snap = await services.learning.getSnapshot(IDS.student, IDS.programmeOffice);
    expect(snap.chapterUnlockedCount).toBe(1);
    expect(snap.completedCount).toBe(1);
    expect(snap.nextActivityId).toBe(`${IDS.programmeOffice}_ch1_a2`);
    expect(snap.gates[`${IDS.programmeOffice}_ch1_a3`].unlocked).toBe(false);
  });

  it('enforces pacing time gate and read-to-bottom before completion', async () => {
    const { services } = await setup();
    const a2 = `${IDS.programmeOffice}_ch1_a2`;
    await expect(services.learning.completeActivity(IDS.student, IDS.programmeOffice, a2)).rejects.toMatchObject({ code: 'VALIDATION' });
    await services.learning.recordTime(IDS.student, IDS.programmeOffice, a2, progressionPolicy.activityGateSeconds.reading);
    await expect(services.learning.completeActivity(IDS.student, IDS.programmeOffice, a2)).rejects.toThrow(/bottom/);
    await services.learning.markReadToBottom(IDS.student, IDS.programmeOffice, a2);
    const snap = await services.learning.completeActivity(IDS.student, IDS.programmeOffice, a2);
    expect(snap.gates[a2].completed).toBe(true);
    expect(snap.nextActivityId).toBe(`${IDS.programmeOffice}_ch1_a3`);
  });

  it('practice quiz is ungraded; assessment needs the pass mark', async () => {
    const { services, repo } = await setup();
    const quizId = `${IDS.programmeOffice}_ch1_a4`;
    const assessId = `${IDS.programmeOffice}_ch1_a6`;
    const programme = repo.find('programmes', IDS.programmeOffice)!;
    const quiz = programme.chapters[0].activities.find(a => a.id === quizId)!.quiz!;
    for (const q of quiz.questions) await services.learning.saveQuizAnswer(IDS.student, IDS.programmeOffice, quizId, q.id, 0);
    const r = await services.learning.submitQuiz(IDS.student, IDS.programmeOffice, quizId, 'practiceQuiz');
    expect(r.passed).toBe(true); // ungraded
    const assess = programme.chapters[0].activities.find(a => a.id === assessId)!.quiz!;
    for (const q of assess.questions) await services.learning.saveQuizAnswer(IDS.student, IDS.programmeOffice, assessId, q.id, (q.correctIndex + 1) % q.options.length);
    const bad = await services.learning.submitQuiz(IDS.student, IDS.programmeOffice, assessId, 'assessment');
    expect(bad.passed).toBe(false);
    for (const q of assess.questions) await services.learning.saveQuizAnswer(IDS.student, IDS.programmeOffice, assessId, q.id, q.correctIndex);
    const good = await services.learning.submitQuiz(IDS.student, IDS.programmeOffice, assessId, 'assessment');
    expect(good.passed).toBe(true);
    expect(good.score).toBeGreaterThanOrEqual(progressionPolicy.passMark.assessment);
  });

  it('matching: definitions are exclusive, wrong answers fail, correct pass at 80%', async () => {
    const { services, repo } = await setup();
    const id = `${IDS.programmeOffice}_ch1_a5`;
    const pairs = repo.find('programmes', IDS.programmeOffice)!.chapters[0].activities.find(a => a.id === id)!.matching!.pairs;
    await services.learning.saveMatching(IDS.student, IDS.programmeOffice, id, pairs[0].id, pairs[1].id);
    await services.learning.saveMatching(IDS.student, IDS.programmeOffice, id, pairs[1].id, pairs[1].id);
    let p = (await services.learning.getSnapshot(IDS.student, IDS.programmeOffice)).progress.matchingAssignments[id];
    expect(p[pairs[0].id]).toBeUndefined(); // moved to pairs[1]
    await expect(services.learning.submitMatching(IDS.student, IDS.programmeOffice, id)).rejects.toMatchObject({ code: 'VALIDATION' });
    for (const pr of pairs) await services.learning.saveMatching(IDS.student, IDS.programmeOffice, id, pr.id, pr.id);
    const r = await services.learning.submitMatching(IDS.student, IDS.programmeOffice, id);
    expect(r.passed).toBe(true);
    expect(r.wrongPairIds).toEqual([]);
    p = (await services.learning.getSnapshot(IDS.student, IDS.programmeOffice)).progress.matchingAssignments[id];
    expect(Object.keys(p)).toHaveLength(pairs.length);
  });

  it('chapter 2 opens only after a day passes AND chapter 1 assessment is passed', async () => {
    const { services } = await setup();
    const ch2first = `${IDS.programmeOffice}_ch2_a1`;
    let snap = await services.learning.getSnapshot(IDS.student, IDS.programmeOffice);
    expect(snap.gates[ch2first].chapterReleased).toBe(false);
    clock.advance(2 * DAY_MS);
    snap = await services.learning.getSnapshot(IDS.student, IDS.programmeOffice);
    expect(snap.gates[ch2first].chapterReleased).toBe(false); // assessment not passed
    snap = await services.learning.devJumpTo(IDS.student, IDS.programmeOffice, ch2first);
    expect(snap.gates[ch2first].chapterReleased).toBe(true);
    expect(snap.chapterUnlockedCount).toBe(2);
  });

  it('course completion and certificate derive from the same progress; certificate blocked until complete', async () => {
    const { services, repo } = await setup();
    await expect(services.learning.issueDemoCertificate(IDS.student, IDS.programmeOffice)).rejects.toMatchObject({ code: 'VALIDATION' });
    const all = repo.find('programmes', IDS.programmeOffice)!.chapters.flatMap(c => c.activities);
    const last = all[all.length - 1];
    await services.learning.devJumpTo(IDS.student, IDS.programmeOffice, last.id);
    // complete the final assessment
    const q = last.quiz!;
    for (const qq of q.questions) await services.learning.saveQuizAnswer(IDS.student, IDS.programmeOffice, last.id, qq.id, qq.correctIndex);
    await services.learning.submitQuiz(IDS.student, IDS.programmeOffice, last.id, 'assessment');
    const snap = await services.learning.completeActivity(IDS.student, IDS.programmeOffice, last.id);
    expect(snap.completedAll).toBe(true);
    expect(snap.progress.completedAt).toBeDefined();
    const cert = await services.learning.issueDemoCertificate(IDS.student, IDS.programmeOffice);
    expect(cert.credentialId).toMatch(/^DEMO-/);
    expect(await services.learning.getCertificate(IDS.student, IDS.programmeOffice)).toEqual(cert);
  });

  it('checkout blocks duplicate enrolment and records a payment', async () => {
    const { services } = await setup();
    await expect(services.enrolment.checkout({ userId: IDS.student, programmeId: IDS.programmeOffice, outcome: 'success' })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(services.enrolment.checkout({ userId: IDS.student, programmeId: IDS.programmePharmacy, outcome: 'fail' })).rejects.toMatchObject({ code: 'SERVER' });
    const r = await services.enrolment.checkout({ userId: IDS.student, programmeId: IDS.programmePharmacy, outcome: 'success' });
    expect(r.enrolment?.status).toBe('active');
    expect((await services.enrolment.listEnrolments(IDS.student)).length).toBe(2);
    expect((await services.finance.listTransactions(IDS.student)).some(t => t.kind === 'demo-payment')).toBe(true);
  });

  it('coach replies deterministically with chapter context', async () => {
    const { services } = await setup();
    const reply = await services.coach.ask({ userId: IDS.student, programmeId: IDS.programmeOffice, chapterId: `${IDS.programmeOffice}_ch1`, activityId: `${IDS.programmeOffice}_ch1_a2`, prompt: 'Explain simply' });
    expect(reply.role).toBe('coach');
    expect(reply.text).toContain('demo');
    const convo = await services.coach.getConversation(IDS.student, IDS.programmeOffice, `${IDS.programmeOffice}_ch1`);
    expect(convo.messages).toHaveLength(2);
  });
});
