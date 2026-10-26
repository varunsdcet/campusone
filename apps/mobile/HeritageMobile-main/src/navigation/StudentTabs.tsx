import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { StudentTabParamList } from './types';
import { Routes } from './routes';
import { studentTabs } from './menus';
import { createTabBar } from './TabBar';
import { screenFor } from './screens';
import { useUnreadBadges } from '../features/shared/useUnreadBadges';

const Tab = createBottomTabNavigator<StudentTabParamList>();

export function StudentTabs() {
  const badges = useUnreadBadges();
  const TabBar = React.useMemo(() => createTabBar(studentTabs, () => ({ [Routes.StudentMessagesTab]: badges.mail, [Routes.StudentHomeTab]: badges.notifications })), [badges.mail, badges.notifications]);
  return (
    <Tab.Navigator tabBar={props => <TabBar {...props} />} screenOptions={{ headerShown: false, lazy: true }}>
      <Tab.Screen name={Routes.StudentHomeTab} component={screenFor(Routes.StudentHomeTab)} />
      <Tab.Screen name={Routes.StudentCoursesTab} component={screenFor(Routes.StudentCoursesTab)} />
      <Tab.Screen name={Routes.StudentScheduleTab} component={screenFor(Routes.StudentScheduleTab)} />
      <Tab.Screen name={Routes.StudentMessagesTab} component={screenFor(Routes.StudentMessagesTab)} />
      <Tab.Screen name={Routes.StudentProfileTab} component={screenFor(Routes.StudentProfileTab)} />
    </Tab.Navigator>
  );
}
