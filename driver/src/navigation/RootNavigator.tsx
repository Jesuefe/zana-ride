import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

import SplashScreen from '../screens/SplashScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import PhoneNumberScreen from '../screens/PhoneNumberScreen';
import OtpVerificationScreen from '../screens/OtpVerificationScreen';
import DocumentUploadScreen from '../screens/DocumentUploadScreen';
import PendingApprovalScreen from '../screens/PendingApprovalScreen';
import MainTabs from './MainTabs';
import IncomingRequestScreen from '../screens/IncomingRequestScreen';
import ActiveTripScreen from '../screens/ActiveTripScreen';
import ChatScreen from '../screens/ChatScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Splash">
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="PhoneNumber" component={PhoneNumberScreen} />
        <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
        <Stack.Screen name="DocumentUpload" component={DocumentUploadScreen} />
        <Stack.Screen name="PendingApproval" component={PendingApprovalScreen} />
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen
          name="IncomingRequest"
          component={IncomingRequestScreen}
          options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="ActiveTrip" component={ActiveTripScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
