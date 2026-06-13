import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { ACTIVITY_LABELS, ACTIVITY_OPTIONS } from '../../types/database';
import type { ActivityType } from '../../types/database';
import { C } from '../../theme';

interface ActivityTypePickerProps {
  activityType: ActivityType;
  setActivityType: (type: ActivityType) => void;
}

export default function ActivityTypePicker({ activityType, setActivityType }: ActivityTypePickerProps) {
  return (
    <>
      <Text style={s.sectionLabel}>ACTIVITY TYPE</Text>
      <View style={s.activityGrid}>
        {ACTIVITY_OPTIONS.map(type => {
          const label = ACTIVITY_LABELS[type];
          const emoji = label.split(' ')[0];
          const name = label.split(' ').slice(1).join(' ');
          const active = activityType === type;
          return (
            <TouchableOpacity
              key={type}
              style={[s.activityBtn, active && s.activityBtnActive]}
              onPress={() => setActivityType(type)}
              activeOpacity={0.7}
            >
              <Text style={s.activityEmoji}>{emoji}</Text>
              <Text style={[s.activityName, active && { color: C.primary }]}>{name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.muted,
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 20,
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
    minHeight: 42,
  },
  activityBtnActive: {
    borderColor: C.primary + '50',
    backgroundColor: C.primary + '15',
  },
  activityEmoji: { fontSize: 16 },
  activityName: { fontSize: 13, fontWeight: '600', color: C.muted },
});
