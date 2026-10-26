import type { PublicFlowsService, PublicProgram } from '../contracts/publicFlows';
import { ServiceError } from '../errors';
import type { ApiClient } from './client';
import { getCurriculum, installSelfpacedCurriculum, normalizeRemoteChapter, type RemoteSelfpacedChapter } from './curriculum/selfpacedCurriculum';

interface ProgramDto {
  slug: string;
  title: string;
  subject?: string;
  level?: string;
  blurb?: string;
  description?: string;
  hours: number;
  chapters: number;
  priceCad: number;
  internationalCad?: number;
  image?: string;
  features?: string[];
  curriculum?: RemoteSelfpacedChapter[];
}

/** Rate-limited (429) responses arrive as SERVER errors; retrying immediately never helps. */
function friendly(e: unknown): never {
  if (ServiceError.is(e, 'SERVER') && /too many/i.test(e.message)) {
    throw new ServiceError('SERVER', `${e.message.replace(/\.$/, '')}. Please wait about 15 minutes before trying again.`, { retryable: false });
  }
  throw e;
}

export function createPublicFlowsApi(api: ApiClient): { publicFlows: PublicFlowsService } {
  const mapProgram = (p: ProgramDto): PublicProgram => {
    if (p.curriculum?.length) installSelfpacedCurriculum(p.slug, p.curriculum.map(normalizeRemoteChapter));
    const chapters = getCurriculum(p.slug).map(c => ({ id: c.id, title: c.title, summary: c.summary, hours: c.hours, activityCount: c.activities.length }));
    return {
      slug: p.slug,
      title: p.title,
      subject: p.subject || 'General',
      level: p.level || 'Intermediate',
      description: p.description || p.blurb || '',
      hours: p.hours,
      chapterCount: chapters.length || p.chapters,
      priceCad: p.priceCad,
      internationalCad: p.internationalCad,
      imageUrl: api.assetUrl(p.image),
      features: (p.features ?? []).map(f => (/^\d+\s+chapters?$/i.test(f.trim()) ? `${chapters.length || p.chapters} chapter${(chapters.length || p.chapters) === 1 ? '' : 's'}` : f)),
      chapters,
    };
  };

  return {
    publicFlows: {
      async apply(input) {
        const r = await api
          .request<{ accountId: string; applicationId: string; email: string }>('POST', '/public/apply', { ...input, email: input.email.trim().toLowerCase(), applicationAcknowledgement: 'Confirmed' }, { auth: false })
          .catch(friendly);
        return { accountId: r.accountId, applicationId: r.applicationId, email: r.email };
      },
      async registerEnglishTest(input) {
        return api
          .request<{ registrationId: string; reference: string; status: string; submittedAt: string }>('POST', '/public/english-test-registrations', input, { auth: false })
          .catch(friendly);
      },
      async listSelfpacedPrograms() {
        const d = await api.request<{ items: ProgramDto[] }>('GET', '/selfpaced/programs', undefined, { auth: false });
        return d.items.map(mapProgram);
      },
      async getSelfpacedProgram(slug) {
        return mapProgram(await api.request<ProgramDto>('GET', `/selfpaced/programs/${encodeURIComponent(slug)}`, undefined, { auth: false }));
      },
      async registerSelfpacedLearner(input) {
        const r = await api
          .request<{ email: string; studentNumber: string }>('POST', '/selfpaced/register', { name: input.name.trim(), email: input.email.trim().toLowerCase(), password: input.password }, { auth: false })
          .catch(friendly);
        return { email: r.email, studentNumber: r.studentNumber };
      },
    },
  };
}
