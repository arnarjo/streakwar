// StreakWar — PostCard + ReactionBar (shared across Home, UserProfile, Comments)
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from './Icon';
import { Card, Avatar, ActIcon, PhotoSlot } from './ui';
import { C, a, f } from '../theme';
import { DB } from '../data';

export function ReactionBar({ post, onReact, onOpenSheet }) {
  const counts = post.reactions || {};
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 13 }}>
      {DB.reactionsList.map((r) => {
        const on = post.myReaction === r;
        return (
          <TouchableOpacity key={r} activeOpacity={0.7} onPress={() => onReact(post.id, r)} style={{
            flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 11,
            borderRadius: 11, minHeight: 38,
            backgroundColor: on ? a(C.primary, 0.16) : C.surface2,
            borderWidth: 1, borderColor: on ? a(C.primary, 0.4) : C.line,
          }}>
            <Icon name={DB.REACTION_ICON[r]} size={15} color={on ? C.primary : C.text2} stroke={2} />
            {counts[r] ? <Text style={f('ui', 700, 12.5, { color: on ? C.primary : C.text2 })}>{counts[r]}</Text> : null}
          </TouchableOpacity>
        );
      })}
      <View style={{ flex: 1 }} />
      <TouchableOpacity activeOpacity={0.7} onPress={() => onOpenSheet(post)} style={{
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 11,
        borderRadius: 11, minHeight: 38, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line,
      }}>
        <Icon name="mail" size={15} color={C.text2} stroke={2} />
        <Text style={f('ui', 700, 12.5, { color: C.text2 })}>{post.comments || 0}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function PostCard({ post, onReact, openProfile, onOpenSheet }) {
  const u = DB.U[post.user];
  const metrics = [
    post.mins != null && ['stopwatch', post.mins, 'min'],
    post.km != null && ['ruler', post.km, 'km'],
    post.kcal != null && ['flame', post.kcal, 'kcal'],
  ].filter(Boolean);
  return (
    <Card pad={15} style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        <Avatar user={u} size={42} onPress={() => openProfile(post.user)} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => openProfile(post.user)}>
            <Text style={f('ui', 700, 15, { color: C.text })}>{u.full_name}</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
            <Text style={f('ui', 500, 12, { color: C.text2 })}>{post.date}</Text>
            {post.source !== 'manual' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: C.text3 }} />
                <Icon name={post.source === 'strava' ? 'strava' : 'healthconnect'} size={12} />
                <Text style={f('ui', 500, 11.5, { color: C.text3 })}>{post.source === 'strava' ? 'Strava' : 'auto'}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <ActIcon act={post.activity} size={40} />
      </View>
      {post.caption ? <Text style={f('ui', 400, 14.5, { color: C.text, lineHeight: 22, marginTop: 12 })}>{post.caption}</Text> : null}
      {post.hasPhoto ? (
        <View style={{ marginTop: 12 }}>
          <PhotoSlot h={188} label={`${DB.ACT_LABEL[post.activity].toLowerCase()} photo`} />
        </View>
      ) : null}
      {metrics.length ? (
        <View style={{ flexDirection: 'row', gap: 18, marginTop: 13, paddingTop: 13, borderTopWidth: 1, borderTopColor: C.line2 }}>
          {metrics.map(([ic, v, l], k) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Icon name={ic} size={16} color={C.primary} stroke={2} />
              <Text style={f('disp', 700, 16, { color: C.text })}>{String(v)}</Text>
              <Text style={f('ui', 500, 12, { color: C.text2 })}>{l}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <ReactionBar post={post} onReact={onReact} onOpenSheet={onOpenSheet} />
    </Card>
  );
}
