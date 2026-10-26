import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { InstructorTabParamList } from './types';
import { Routes } from './routes';
import { instructorTabs } from './menus';
import { createTabBar } from './TabBar';
import { screenFor } from './screens';
import { useUnreadBadges } from '../features/shared/useUnreadBadges';

const Tab = createBottomTabNavigator<InstructorTabParamList>();

export function InstructorTabs() {
  const badges = useUnreadBadges();
  const TabBar = React.useMemo(() => createTabBar(instructorTabs, () => ({ [Routes.InstructorMessagesTab]: badges.mail, [Routes.InstructorHomeTab]: badges.notifications })), [badges.mail, badges.notifications]);
  return (
    <Tab.Navigator tabBar={props => <TabBar {...props} />} screenOptions={{ headerShown: false, lazy: true }}>
      <Tab.Screen name={Routes.InstructorHomeTab} component={screenFor(Routes.InstructorHomeTab)} />
      <Tab.Screen name={Routes.InstructorCoursesTab} component={screenFor(Routes.InstructorCoursesTab)} />
      <Tab.Screen name={Routes.InstructorGradesTab} component={screenFor(Routes.InstructorGradesTab)} />
      <Tab.Screen name={Routes.InstructorMessagesTab} component={screenFor(Routes.InstructorMessagesTab)} />
      <Tab.Screen name={Routes.InstructorMoreTab} component={screenFor(Routes.InstructorMoreTab)} />
    </Tab.Navigator>
  );
}
