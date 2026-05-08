import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Modal, TextInput, FlatList, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { ACTIVITY_LABELS, REACTIONS } from '../types/database';
import type { WorkoutPost, WorkoutComment } from '../types/database';
import { formatDistanceToNow } from 'date-fns';

const C = {
  bg: '#0C1117',
  card: '#151C24',
  border: 'rgba(255,255,255,0.07)',
  text: '#EEF4F8',
  muted: '#4A6070',
  primary: '#F97316',
  secondary: '#FBBF24',
};

type Props = {
  post: WorkoutPost;
  currentUserId?: string;
  onReact: (postId: string, reaction: string) => void;
  onFetchComments: (postId: string) => Promise<WorkoutComment[]>;
  onAddComment: (postId: string, content: string) => Promise<{ error: string | null }>;
  onEdit?: (post: WorkoutPost) => void;
  onDelete?: (postId: string) => void;
};

export default function WorkoutPostCard({ post, currentUserId, onReact, onFetchComments, onAddComment, onEdit, onDelete }: Props) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<WorkoutComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const timeAgo = formatDistanceToNow(new Date(post.posted_at), { addSuffix: true });
  const isOwnPost = !!currentUserId && currentUserId === post.user_id;

  function showPostMenu() {
    Alert.alert('Workout', undefined, [
      { text: 'Edit', onPress: () => onEdit?.(post) },
      {
        text: 'Delete', style: 'destructive', onPress: () =>
          Alert.alert('Delete workout', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => onDelete?.(post.id) },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function openComments() {
    setCommentsOpen(true);
    const data = await onFetchComments(post.id);
    setComments(data);
  }

  async function submitComment() {
    if (!commentText.trim()) return;
    setSubmitting(true);
    const { error } = await onAddComment(post.id, commentText.trim());
    setSubmitting(false);
    if (error) { Alert.alert('Error', error); return; }
    const updated = await onFetchComments(post.id);
    setComments(updated);
    setCommentText('');
  }

  const initials = (post.profile?.full_name ?? post.profile?.username ?? '?')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const stats: string[] = [];
  if (post.duration_minutes) stats.push(`${post.duration_minutes} min`);
  if (post.distance_km) stats.push(`${post.distance_km} km`);
  if (post.calories) stats.push(`${post.calories} kcal`);
  if (post.steps) stats.push(`${post.steps.toLocaleString()} steps`);

  return (
    <View style={s.card}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.avatar}>
          {post.profile?.avatar_url
            ? <Image source={{ uri: post.profile.avatar_url }} style={s.avatarImg} />
            : <Text style={s.avatarText}>{initials}</Text>
          }
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{post.profile?.full_name ?? post.profile?.username}</Text>
          <Text style={s.meta}>
            {ACTIVITY_LABELS[post.activity_type]}
            {post.challenge ? ` · ${post.challenge.name}` : ''}
          </Text>
        </View>
        <Text style={s.time}>{timeAgo}</Text>
        {isOwnPost && (
          <TouchableOpacity onPress={showPostMenu} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.menuDots}>⋯</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats row */}
      {stats.length > 0 && (
        <View style={s.statsRow}>
          {stats.map((stat, i) => (
            <View key={i} style={s.statPill}>
              <Text style={s.statText}>{stat}</Text>
            </View>
          ))}
          {post.points_awarded > 0 && (
            <View style={[s.statPill, s.pointsPill]}>
              <Text style={[s.statText, { color: C.primary }]}>+{post.points_awarded} pts</Text>
            </View>
          )}
        </View>
      )}

      {/* Caption */}
      {post.caption ? <Text style={s.caption}>{post.caption}</Text> : null}

      {/* Photo */}
      {post.media_url && post.media_type === 'photo' && (
        <Image source={{ uri: post.media_url }} style={s.media} resizeMode="cover" />
      )}

      {/* Reactions */}
      <View style={s.reactionsRow}>
        <View style={s.reactRow}>
          {REACTIONS.map(emoji => {
            const count = post.reaction_counts?.[emoji] ?? 0;
            const active = post.my_reaction === emoji;
            return (
              <TouchableOpacity
                key={emoji}
                style={[s.reactBtn, active && s.reactBtnActive]}
                onPress={() => onReact(post.id, emoji)}
                activeOpacity={0.7}
              >
                <Text style={s.reactEmoji}>{emoji}</Text>
                {count > 0 && <Text style={[s.reactCount, active && { color: '#F97316' }]}>{count}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity style={s.commentBtn} onPress={openComments}>
          <Text style={s.commentBtnText}>
            💬 {post.comment_count ?? 0}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Comments modal */}
      <Modal visible={commentsOpen} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.commentsModal}
        >
          <View style={s.commentsHeader}>
            <Text style={s.commentsTitle}>Comments</Text>
            <TouchableOpacity onPress={() => setCommentsOpen(false)}>
              <Text style={s.commentsClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={comments}
            keyExtractor={c => c.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item }) => (
              <View style={s.commentItem}>
                <Text style={s.commentAuthor}>{item.profile?.username ?? '?'}</Text>
                <Text style={s.commentContent}>{item.content}</Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={[s.muted, { textAlign: 'center', marginTop: 24 }]}>
                No comments yet
              </Text>
            }
          />

          <View style={s.commentInput}>
            <TextInput
              style={s.commentTextInput}
              placeholder="Write a comment..."
              placeholderTextColor={C.muted}
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <TouchableOpacity
              style={[s.commentSend, !commentText.trim() && { opacity: 0.4 }]}
              onPress={submitComment}
              disabled={submitting || !commentText.trim()}
            >
              <Text style={s.commentSendText}>Send</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarText: { fontSize: 15, fontWeight: '700', color: C.primary },
  name: { fontSize: 14, fontWeight: '700', color: C.text },
  meta: { fontSize: 12, color: C.muted, marginTop: 1 },
  time: { fontSize: 11, color: C.muted },
  menuDots: { fontSize: 18, color: C.muted, paddingLeft: 8, fontWeight: '700' },

  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  statPill: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pointsPill: { backgroundColor: C.primary + '15' },
  statText: { fontSize: 12, color: C.text, fontWeight: '600' },

  caption: {
    fontSize: 14,
    color: C.text,
    paddingHorizontal: 14,
    paddingBottom: 12,
    lineHeight: 20,
  },
  media: {
    width: '100%',
    height: 240,
    marginBottom: 4,
  },

  reactionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 4,
  },
  reactRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  reactBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  reactBtnActive: { backgroundColor: '#F9731615', borderColor: '#F9731640' },
  reactEmoji: { fontSize: 16 },
  reactCount: { fontSize: 12, fontWeight: '700', color: '#4A6070' },
  commentBtn: { padding: 6 },
  commentBtnText: { fontSize: 13, color: C.muted, fontWeight: '600' },

  muted: { color: C.muted, fontSize: 14 },

  // Comments modal
  commentsModal: { flex: 1, backgroundColor: C.bg },
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  commentsTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  commentsClose: { fontSize: 20, color: C.muted, padding: 4 },
  commentItem: { gap: 3 },
  commentAuthor: { fontSize: 13, fontWeight: '700', color: C.primary },
  commentContent: { fontSize: 14, color: C.text, lineHeight: 20 },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  commentTextInput: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: C.text,
    fontSize: 14,
    maxHeight: 100,
  },
  commentSend: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  commentSendText: { color: '#000', fontWeight: '800', fontSize: 13 },
});
