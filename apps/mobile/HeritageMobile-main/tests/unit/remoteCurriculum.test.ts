import { normalizeRemoteChapter } from '../../src/services/api/curriculum/selfpacedCurriculum';

describe('server-authored self-paced curriculum', () => {
  it('normalizes admin chapters into usable mobile activities', () => {
    const chapter = normalizeRemoteChapter({
      id: 'course-01',
      title: 'Foundations',
      description: 'Learn the foundations.',
      activities: [
        { id: 'read', type: 'reading', title: 'Concepts', minutes: 35, content: 'Approved content.' },
        { id: 'lecture', type: 'lecture', title: 'Lecture', minutes: 30, content: 'Instructor narration.' },
        { id: 'quiz', type: 'quiz', title: 'Check', minutes: 15 },
        { id: 'assessment', type: 'assessment', title: 'Assessment', minutes: 30 },
      ],
    });

    expect(chapter.summary).toBe('Learn the foundations.');
    expect(chapter.activities[0].html).toContain('Approved content.');
    expect(chapter.activities[1].storyboard?.slides[0].narration).toBe('Instructor narration.');
    expect(chapter.activities[2].questions).toHaveLength(1);
    expect(chapter.activities[3]).toMatchObject({ questionCount: 1, passMark: 70 });
  });
});
