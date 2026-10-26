import { Routes } from '../../navigation/routes';
import { PublicApplyScreen, PublicApplySuccessScreen } from './ApplyScreens';
import { PublicEnglishTestScreen, PublicEnglishTestDoneScreen } from './EnglishTestScreens';
import { PublicSelfPacedScreen, PublicSelfPacedDetailsScreen, PublicSelfPacedRegisterScreen } from './SelfPacedScreens';

export const publicScreens = {
  [Routes.PublicApply]: PublicApplyScreen,
  [Routes.PublicApplySuccess]: PublicApplySuccessScreen,
  [Routes.PublicEnglishTest]: PublicEnglishTestScreen,
  [Routes.PublicEnglishTestDone]: PublicEnglishTestDoneScreen,
  [Routes.PublicSelfPaced]: PublicSelfPacedScreen,
  [Routes.PublicSelfPacedDetails]: PublicSelfPacedDetailsScreen,
  [Routes.PublicSelfPacedRegister]: PublicSelfPacedRegisterScreen,
};
