import { loadUser } from '../../src/services/api/auth';
import { brandText } from '../../src/services/api/applicant';
import type { ApiClient } from '../../src/services/api/client';
import { applicantTarget } from '../../src/features/applicant/useApplicant';
import { canAccess, routePermission } from '../../src/navigation/permissions';
import { Routes } from '../../src/navigation/routes';
import type { UserAccount } from '../../src/domain/types';

describe('applicant role', () => {
  it('builds an applicant user from the application form', async () => {
    const get = jest.fn(async (path: string) => {
      if (path === '/applicant/application/form') return { values: { givenName: 'Nora', familyName: 'Reyes', email: 'nora@example.com' } };
      throw new Error(`unexpected ${path}`);
    });
    const { user } = await loadUser({ get } as unknown as ApiClient, { accountId: 'acc-1', roles: ['applicant'], givenName: '', familyName: '' });
    expect(user).toMatchObject({ id: 'acc-1', role: 'applicant', displayName: 'Nora Reyes', email: 'nora@example.com', avatarInitials: 'NR' });
  });

  it('gates Applicant* routes to applicants', () => {
    expect(routePermission(Routes.ApplicantOffers).role).toBe('applicant');
    const applicant = { role: 'applicant', capabilities: [] } as unknown as UserAccount;
    const student = { role: 'student', capabilities: [] } as unknown as UserAccount;
    expect(canAccess(Routes.ApplicantView, applicant).ok).toBe(true);
    expect(canAccess(Routes.ApplicantView, student).ok).toBe(false);
    expect(canAccess(Routes.StudentFinance, applicant).ok).toBe(false);
    expect(canAccess(Routes.StudentSecurity, applicant).ok).toBe(true);
  });

  it('maps portal hrefs to app screens', () => {
    expect(applicantTarget('/applicant/documents')).toEqual({ route: Routes.ApplicantTabs, params: { screen: Routes.ApplicantDocumentsTab, params: undefined } });
    expect(applicantTarget('/applicant/offers')).toEqual({ route: Routes.ApplicantOffers });
    expect(applicantTarget('/applicant/ask')).toEqual({ route: Routes.AskHeritage });
    expect(applicantTarget('/applicant/search')).toBeNull();
    expect(applicantTarget('/applicant/f/ap-08-contract')).toEqual({ route: Routes.ApplicantView, params: { path: '/applicant/f/ap-08-contract', title: 'Contract' } });
    expect(applicantTarget('/student/grades')).toBeNull();
  });

  it('rebrands portal labels', () => {
    expect(brandText('Ask Heritage')).toBe('Ask Campus One');
    expect(brandText(undefined)).toBeUndefined();
  });
});
