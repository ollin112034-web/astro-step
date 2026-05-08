import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.42)',
        tabBarStyle: {
          backgroundColor: 'rgba(2,2,4,0.94)',
          borderColor: 'rgba(255,255,255,0.12)',
          borderTopWidth: 1,
          height: Platform.select({ ios: 84, default: 70 }),
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '800',
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '위치',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="planet-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: '상세',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="analytics-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}
