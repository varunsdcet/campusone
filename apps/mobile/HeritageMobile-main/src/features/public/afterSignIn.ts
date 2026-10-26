import { navigationRef } from '../../navigation/RootNavigator';
import { Routes } from '../../navigation/routes';

/**
 * Signing in swaps the root navigator to the student shell and resets the stack, so the
 * follow-up screen is opened only once the student tabs are mounted.
 * Call before signing in; the returned function cancels the pending navigation.
 */
export function openProgrammeAfterSignIn(programmeId: string | undefined): () => void {
  let done = false;
  const finish = () => {
    done = true;
    unsubscribe();
    clearTimeout(expiry);
  };
  const unsubscribe = navigationRef.addListener('state', e => {
    const routes = e.data.state?.routes;
    if (done || !routes?.length || routes[0].name !== Routes.StudentTabs) return;
    finish();
    setTimeout(() => {
      if (!navigationRef.isReady()) return;
      if (programmeId) navigationRef.navigate(Routes.StudentProgrammeDetails, { programmeId });
      else navigationRef.navigate(Routes.StudentCatalogue);
    }, 300);
  });
  const expiry = setTimeout(() => { if (!done) finish(); }, 20_000);
  return () => { if (!done) finish(); };
}
