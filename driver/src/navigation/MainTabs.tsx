import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home as HomeIcon, ListChecks, Wallet, User } from 'lucide-react-native';
import { MainTabParamList } from '../types';
import { colors } from '../theme/theme';

import HomeScreen from '../screens/HomeScreen';
import TripsScreen from '../screens/TripsScreen';
import EarningsScreen from '../screens/EarningsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { height: 62, paddingBottom: 8, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: 'Home', tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} /> }} />
      <Tab.Screen name="TripsTab" component={TripsScreen} options={{ title: 'Trips', tabBarIcon: ({ color, size }) => <ListChecks color={color} size={size} /> }} />
      <Tab.Screen name="EarningsTab" component={EarningsScreen} options={{ title: 'Earnings', tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} /> }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}
