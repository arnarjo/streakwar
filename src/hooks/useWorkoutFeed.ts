import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { WorkoutPost, WorkoutComment, ActivityType, WorkoutSource } from '../types/database';
import * as ImagePicker from 'expo-image-picker';

export function useWorkoutFeed(userId: string) {
  const [feed, setFeed] = useState<WorkoutPost[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFeed = useCallback(async (challengeId?: string) => {
    if (!userId) return;
    setLoading(true);

    let query = supabase
      .from('workout_posts')
      .select(`
        *,
        profile:profiles(id, username, full_name, avatar_url, total_points),
        challenge:fitness_challenges(id, name)
      `)
      .order('posted_at', { ascending: false })
      .limit(50);

    if (challengeId) {
      query = query.eq('challenge_id', challengeId);
    } else {
      // Global feed: posts from challenges the user is in
      const { data: participations } = await supabase
        .from('challenge_participants')
        .select('challenge_id')
        .eq('user_id', userId);

      const challengeIds = (participations ?? []).map((p: any) => p.challenge_id);
      if (challengeIds.length > 0) {
        query = query.in('challenge_id', challengeIds);
      } else {
        // If not in any challenges, only show the user's own posts
        query = query.eq('user_id', userId);
      }
    }

    const { data } = await query;

    if (data) {
      const postIds = data.map((p: any) => p.id);

      // Two batched queries instead of 2×N individual ones
      const [{ data: allReactions }, { data: allCommentCounts }] = await Promise.all([
        supabase
          .from('workout_reactions')
          .select('post_id, reaction, user_id')
          .in('post_id', postIds),
        supabase
          .from('workout_comments')
          .select('post_id, id')
          .in('post_id', postIds),
      ]);

      // Index reactions and comment counts by post_id
      const reactionsByPost = new Map<string, { counts: Record<string, number>; myReaction: string | null }>();
      for (const r of allReactions ?? []) {
        if (!reactionsByPost.has(r.post_id)) {
          reactionsByPost.set(r.post_id, { counts: {}, myReaction: null });
        }
        const entry = reactionsByPost.get(r.post_id)!;
        entry.counts[r.reaction] = (entry.counts[r.reaction] ?? 0) + 1;
        if (r.user_id === userId) entry.myReaction = r.reaction;
      }

      const commentCountByPost = new Map<string, number>();
      for (const c of allCommentCounts ?? []) {
        commentCountByPost.set(c.post_id, (commentCountByPost.get(c.post_id) ?? 0) + 1);
      }

      setFeed(data.map((post: any) => {
        const r = reactionsByPost.get(post.id);
        return {
          ...post,
          reaction_counts: r?.counts ?? {},
          my_reaction: r?.myReaction ?? null,
          comment_count: commentCountByPost.get(post.id) ?? 0,
        };
      }));
    }
    setLoading(false);
  }, [userId]);

  async function toggleReaction(postId: string, reaction: string): Promise<void> {
    const post = feed.find(p => p.id === postId);
    const currentReaction = post?.my_reaction ?? null;
    const removing = currentReaction === reaction;

    // Optimistic update first for instant UI response
    setFeed(prev =>
      prev.map(p => {
        if (p.id !== postId) return p;
        const counts = { ...(p.reaction_counts ?? {}) };
        if (currentReaction) counts[currentReaction] = Math.max(0, (counts[currentReaction] ?? 1) - 1);
        if (!removing) counts[reaction] = (counts[reaction] ?? 0) + 1;
        return { ...p, reaction_counts: counts, my_reaction: removing ? null : reaction };
      })
    );

    if (removing) {
      await supabase.from('workout_reactions').delete()
        .eq('post_id', postId).eq('user_id', userId).eq('reaction', reaction);
    } else {
      // Remove any prior reaction then insert new one
      await supabase.from('workout_reactions').delete()
        .eq('post_id', postId).eq('user_id', userId);
      await supabase.from('workout_reactions').insert({ post_id: postId, user_id: userId, reaction });
    }
  }

  async function fetchComments(postId: string): Promise<WorkoutComment[]> {
    const { data } = await supabase
      .from('workout_comments')
      .select('*, profile:profiles(*)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    return data ?? [];
  }

  async function addComment(postId: string, content: string): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('workout_comments')
      .insert({ post_id: postId, user_id: userId, content });
    if (error) return { error: 'Could not post comment' };

    setFeed(prev =>
      prev.map(p => p.id === postId ? { ...p, comment_count: (p.comment_count ?? 0) + 1 } : p)
    );
    return { error: null };
  }

  async function logWorkout(params: {
    activity_type: ActivityType;
    duration_minutes: number | null;
    distance_km: number | null;
    calories: number | null;
    steps: number | null;
    caption: string;
    challenge_id: string | null;
    workout_date: string;
    source: WorkoutSource;
    imageUri?: string;
  }): Promise<{ error: string | null }> {
    let media_url: string | null = null;
    let media_type: 'photo' | 'video' | null = null;

    if (params.imageUri) {
      const ext = params.imageUri.split('.').pop()?.toLowerCase();
      const isVideo = ext === 'mp4' || ext === 'mov';
      const path = `${userId}/${Date.now()}.${ext ?? 'jpg'}`;

      const response = await fetch(params.imageUri);
      const blob = await response.blob();
      const videoContentType = ext === 'mov' ? 'video/quicktime' : 'video/mp4';
      const { error: uploadError } = await supabase.storage
        .from('workout-media')
        .upload(path, blob, { contentType: isVideo ? videoContentType : 'image/jpeg' });

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('workout-media').getPublicUrl(path);
        media_url = urlData.publicUrl;
        media_type = isVideo ? 'video' : 'photo';
      }
    }

    const { error } = await supabase.from('workout_posts').insert({
      user_id: userId,
      challenge_id: params.challenge_id,
      activity_type: params.activity_type,
      duration_minutes: params.duration_minutes,
      distance_km: params.distance_km,
      calories: params.calories,
      steps: params.steps,
      caption: params.caption || null,
      media_url,
      media_type,
      workout_date: params.workout_date,
      source: params.source,
    });

    if (error) return { error: 'Could not log workout' };
    return { error: null };
  }

  async function updateWorkout(postId: string, params: {
    activity_type: ActivityType;
    duration_minutes: number | null;
    distance_km: number | null;
    calories: number | null;
    steps: number | null;
    caption: string;
    workout_date: string;
  }): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('workout_posts')
      .update({
        activity_type: params.activity_type,
        duration_minutes: params.duration_minutes,
        distance_km: params.distance_km,
        calories: params.calories,
        steps: params.steps,
        caption: params.caption || null,
        workout_date: params.workout_date,
      })
      .eq('id', postId)
      .eq('user_id', userId);
    if (error) return { error: 'Could not update workout' };
    setFeed(prev => prev.map(p => p.id === postId
      ? { ...p, ...params, caption: params.caption || null }
      : p
    ));
    return { error: null };
  }

  async function deleteWorkout(postId: string): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('workout_posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', userId);
    if (error) return { error: 'Could not delete workout' };
    setFeed(prev => prev.filter(p => p.id !== postId));
    return { error: null };
  }

  async function pickMedia(): Promise<string | null> {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
      allowsEditing: true,
    });
    if (result.canceled) return null;
    return result.assets[0]?.uri ?? null;
  }

  return { feed, loading, fetchFeed, toggleReaction, fetchComments, addComment, logWorkout, updateWorkout, deleteWorkout, pickMedia };
}
