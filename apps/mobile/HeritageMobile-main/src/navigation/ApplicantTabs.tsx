import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { ApplicantTabParamList } from './types';
import { Routes } from './routes';
import { applicantTabs } from './menus';
import { createTabBar } from './TabBar';
import { screenFor } from './screens';

const Tab = createBottomTabNavigator<ApplicantTabParamList>();
const TabBar = createTabBar(applicantTabs);

export function ApplicantTabs() {
  return (
    <Tab.Navigator tabBar={props => <TabBar {...props} />} screenOptions={{ headerShown: false, lazy: true }}>
      <Tab.Screen name={Routes.ApplicantHomeTab} component={screenFor(Routes.ApplicantHomeTab)} />
      <Tab.Screen name={Routes.ApplicantApplicationTab} component={screenFor(Routes.ApplicantApplicationTab)} />
      <Tab.Screen name={Routes.ApplicantDocumentsTab} component={screenFor(Routes.ApplicantDocumentsTab)} />
      <Tab.Screen name={Routes.ApplicantMessagesTab} component={screenFor(Routes.ApplicantMessagesTab)} />
      <Tab.Screen name={Routes.ApplicantMoreTab} component={screenFor(Routes.ApplicantMoreTab)} />
    </Tab.Navigator>
  );
}
