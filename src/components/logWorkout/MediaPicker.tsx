import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';

import { C } from '../../theme';

interface MediaPickerProps {
  mediaUri: string | null;
  onPickMedia: () => void;
  onRemoveMedia: () => void;
}

export default function MediaPicker({ mediaUri, onPickMedia, onRemoveMedia }: MediaPickerProps) {
  return (
    <>
      <Text style={s.sectionLabel}>PHOTO (optional)</Text>
      <TouchableOpacity style={s.mediaPicker} onPress={onPickMedia} activeOpacity={0.8}>
        {mediaUri ? (
          <Image source={{ uri: mediaUri }} style={s.mediaPreview} resizeMode="cover" />
        ) : (
          <View style={s.mediaPlaceholder}>
            <Text style={s.mediaIcon}>📷</Text>
            <Text style={s.mediaText}>Add a photo</Text>
          </View>
        )}
      </TouchableOpacity>
      {mediaUri && (
        <TouchableOpacity style={s.removeMedia} onPress={onRemoveMedia}>
          <Text style={s.removeMediaText}>Remove photo</Text>
        </TouchableOpacity>
      )}
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
  mediaPicker: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 140,
  },
  mediaPreview: { width: '100%', height: 200 },
  mediaPlaceholder: {
    height: 140,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mediaIcon: { fontSize: 32 },
  mediaText: { color: C.muted, fontSize: 14, fontWeight: '600' },
  removeMedia: { alignItems: 'center', marginTop: 6 },
  removeMediaText: { color: C.error, fontSize: 13, fontWeight: '600' },
});
