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
        profile:profiles(*),
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
      }
    }

    const { data } = await query;

    if (data) {
      // Fetch reaction counts for each post
      const postsWithReactions = await Promise.all(
        data.map(async (post: any) => {
          const { data: reactions } = await supabase
            .from('workout_reactions')
            .select('reaction, user_id')
            .eq('post_id', post.id);

          const counts: Record<string, number> = {};
          let myReaction: string | null = null;
          for (const r of reactions ?? []) {
            counts[r.reaction] = (counts[r.reaction] ?? 0) + 1;
            if (r.user_id === userId) myReaction = r.reaction;
          }

          const { count: commentCount } = await supabase
            .from('workout_comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);

          return {
            ...post,
            reaction_counts: counts,
            my_reaction: myReaction,
            comment_count: commentCount ?? 0,
          };
        })
      );
      setFeed(postsWithReactions);
    }
    setLoading(false);
  }, [userId]);

  async function toggleReaction(postId: string, reaction: string): Promise<void> {
    // Check if user already has this reaction
    const { data: existing } = await supabase
      .from('workout_reactions')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .eq('reaction', reaction)
      .single();

    if (existing) {
      await supabase.from('workout_reactions').delete().eq('id', existing.id);
    } else {
      // Remove any other reaction first
      await supabase
        .from('workout_reactions')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);
      await supabase.from('workout_reactions').insert({ post_id: postId, user_id: userId, reaction });
    }

    // Optimistic update
    setFeed(prev =>
      prev.map(post => {
        if (post.id !== postId) return post;
        const counts = { ...(post.reaction_counts ?? {}) };
        const currentReaction = post.my_reaction;

        if (currentReaction) counts[currentReaction] = Math.max(0, (counts[currentReaction] ?? 1) - 1);
        if (existing) return { ...post, reaction_counts: counts, my_reaction: null };

        counts[reaction] = (counts[reaction] ?? 0) + 1;
        return { ...post, reaction_counts: counts, my_reaction: reaction };
      })
    );
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
      const { error: uploadError } = await supabase.storage
        .from('workout-media')
        .upload(path, blob, { contentType: isVideo ? 'video/mp4' : 'image/jpeg' });

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

  async function pickMedia(): Promise<string | null> {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
      allowsEditing: true,
    });
    if (result.canceled) return null;
    return result.assets[0]?.uri ?? null;
  }

  return { feed, loading, fetchFeed, toggleReaction, fetchComments, addComment, logWorkout, pickMedia };
}
