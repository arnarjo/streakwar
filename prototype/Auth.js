// StreakWar — mock data (ported verbatim from the prototype)

const me = {
  id: 'u_me', username: 'arnar', full_name: 'Arnar Jónsson',
  total_points: 4280, current_streak: 23, longest_streak: 41,
  initials: 'AJ', accent: '#F97316', isPro: true,
  tier: 'gold', joined: 'Mar 2025', bio: 'Trying to out-run my rival. 6am club.',
};

const U = {
  u_me: me,
  u_kata: { id: 'u_kata', username: 'kata', full_name: 'Katrín Eldjárn', initials: 'KE', total_points: 4980, current_streak: 31, accent: '#7C9CF0' },
  u_bjarki: { id: 'u_bjarki', username: 'bjarki', full_name: 'Bjarki Þór', initials: 'BÞ', total_points: 4510, current_streak: 12, accent: '#34D399' },
  u_lena: { id: 'u_lena', username: 'lena', full_name: 'Lena Magnús', initials: 'LM', total_points: 3990, current_streak: 8, accent: '#F5B945' },
  u_dagur: { id: 'u_dagur', username: 'dagur', full_name: 'Dagur Sól', initials: 'DS', total_points: 3870, current_streak: 19, accent: '#F87171' },
  u_eva: { id: 'u_eva', username: 'eva', full_name: 'Eva Rún', initials: 'ER', total_points: 3610, current_streak: 5, accent: '#B79BF7' },
  u_jon: { id: 'u_jon', username: 'jon', full_name: 'Jón Páll', initials: 'JP', total_points: 3120, current_streak: 0, accent: '#54B8F0' },
  u_sara: { id: 'u_sara', username: 'sara', full_name: 'Sara Lind', initials: 'SL', total_points: 2980, current_streak: 14, accent: '#34D399' },
};

const feed = [
  { id: 'p1', user: 'u_kata', activity: 'run', mins: 52, km: 9.4, kcal: 610, source: 'strava',
    caption: 'Tempo run by the harbour. Legs absolutely cooked.', date: 'Today · 6:41',
    reactions: { '🔥': 4, '💪': 2 }, myReaction: null, comments: 3, ago: '2h' },
  { id: 'p2', user: 'u_bjarki', activity: 'lift', mins: 64, kcal: 430, source: 'manual',
    caption: 'Push day. New bench PR — 92.5kg.', date: 'Today · 5:58',
    reactions: { '💪': 6, '👏': 1 }, myReaction: '💪', comments: 5, ago: '3h', hasPhoto: true },
  { id: 'p3', user: 'u_lena', activity: 'yoga', mins: 35, source: 'health_connect',
    caption: 'Recovery flow. Needed this.', date: 'Yesterday · 21:10',
    reactions: { '🔥': 2 }, myReaction: null, comments: 0, ago: '14h' },
  { id: 'p4', user: 'u_dagur', activity: 'cycle', mins: 88, km: 34.2, kcal: 920, source: 'strava',
    caption: 'Long ride up to Þingvellir and back. Brutal headwind on the way home.', date: 'Yesterday · 16:20',
    reactions: { '🔥': 3, '💪': 2, '👏': 2 }, myReaction: null, comments: 2, ago: '18h', hasPhoto: true },
];

const milestones = [
  { id: 'm1', user: 'u_kata', streak: 30, reactions: { '🔥': 5, '👏': 3 }, myReaction: '🔥', ago: '1d' },
  { id: 'm2', user: 'u_sara', streak: 14, reactions: { '🔥': 2 }, myReaction: null, ago: '2d' },
];

const challenges = [
  { id: 'c1', name: 'June Burn', desc: 'Most workouts in June wins. No excuses.',
    status: 'active', members: 8, myScore: 42, myRank: 2, daysLeft: 11, scoring: ['workouts'],
    start: 'Jun 1', end: 'Jun 30', code: 'JUNE2026', isPublic: false, host: 'u_kata',
    board: [{ u: 'u_kata', s: 48 }, { u: 'u_me', s: 42 }, { u: 'u_bjarki', s: 39 }, { u: 'u_dagur', s: 31 }, { u: 'u_lena', s: 24 }] },
  { id: 'c2', name: '10K Steps Daily', desc: 'Hit 10,000 steps every day. Streak-based scoring.',
    status: 'active', members: 24, myScore: 118, myRank: 5, daysLeft: 4, scoring: ['steps'],
    start: 'May 20', end: 'Jun 7', code: 'STEP10K', isPublic: true, host: 'u_dagur',
    board: [{ u: 'u_dagur', s: 156 }, { u: 'u_kata', s: 149 }, { u: 'u_sara', s: 140 }, { u: 'u_lena', s: 127 }, { u: 'u_me', s: 118 }] },
  { id: 'c3', name: 'Bjarki vs Arnar 1v1', desc: 'Private 1v1 — may the best win.',
    status: 'active', members: 2, myScore: 7, myRank: 1, daysLeft: 2, scoring: ['workouts'],
    start: 'Jun 1', end: 'Jun 7', code: 'XK29PD', isPublic: false, host: 'u_me',
    board: [{ u: 'u_me', s: 7 }, { u: 'u_bjarki', s: 6 }] },
  { id: 'c4', name: 'Summer Distance Cup', desc: 'Most km logged across July.',
    status: 'upcoming', members: 14, myScore: 0, myRank: null, daysLeft: 28, scoring: ['distance_km'],
    start: 'Jul 1', end: 'Jul 31', code: 'SUMMERKM', isPublic: true, host: 'u_lena', board: [] },
  { id: 'c5', name: 'May Movement', desc: 'Most active minutes in May.',
    status: 'completed', members: 19, myScore: 610, myRank: 1, daysLeft: 0, scoring: ['duration_min'],
    start: 'May 1', end: 'May 31', code: 'MAYMOVE', isPublic: false, host: 'u_me',
    board: [{ u: 'u_me', s: 610 }, { u: 'u_kata', s: 585 }, { u: 'u_eva', s: 540 }] },
];

const discover = [
  { id: 'd1', name: 'Reykjavík Run Club', desc: 'Public city-wide running challenge. New season weekly.',
    members: 312, scoring: ['distance_km'], tag: 'Popular', host: 'u_dagur' },
  { id: 'd2', name: 'Office Step Wars', desc: 'Teams of 5. Most steps per team.',
    members: 88, scoring: ['steps'], tag: 'Teams', host: 'u_kata' },
  { id: 'd3', name: '30-Day Yoga', desc: 'Daily yoga streak. Calm wins the race.',
    members: 140, scoring: ['days_active'], tag: 'Wellness', host: 'u_lena' },
  { id: 'd4', name: 'Calorie Crushers', desc: 'Most calories burned this month.',
    members: 204, scoring: ['calories'], tag: 'Intense', host: 'u_bjarki' },
];

const league = [
  { u: 'u_kata', pts: 412 }, { u: 'u_bjarki', pts: 388 }, { u: 'u_sara', pts: 355 },
  { u: 'u_dagur', pts: 340 }, { u: 'u_me', pts: 318 }, { u: 'u_lena', pts: 295 },
  { u: 'u_eva', pts: 270 }, { u: 'u_jon', pts: 240 }, { u: 'u_kata2', pts: 0 },
];
const extra = [['Helga H', 285], ['Ómar K', 262], ['Tinna B', 244], ['Rúnar G', 210], ['Védís S', 188]]
  .map(([n, p], i) => ({ u: 'x' + i, pts: p, name: n, initials: n.split(' ').map((w) => w[0]).join(''), accent: '#7C8C9A' }));

const achievements = [
  { key: 'first_workout', icon: 'sparkle', title: 'First Step', desc: 'Logged your first workout', earned: true, date: 'Mar 12' },
  { key: 'streak_7', icon: 'flame', title: 'Week Warrior', desc: '7-day streak', earned: true, date: 'Mar 28' },
  { key: 'pts_1000', icon: 'star', title: 'Point Machine', desc: 'Earned 1,000 points', earned: true, date: 'Apr 9' },
  { key: 'workouts_50', icon: 'medal', title: 'Half Century', desc: '50 workouts logged', earned: true, date: 'Apr 30' },
  { key: 'streak_14', icon: 'bolt', title: 'Two Weeks', desc: '14-day streak', earned: true, date: 'May 14' },
  { key: 'pts_5000', icon: 'crown', title: 'Unstoppable', desc: 'Earn 5,000 points', earned: false, prog: 0.86, progLabel: '4,280 / 5,000' },
  { key: 'streak_30', icon: 'gem', title: 'Diamond Streak', desc: '30-day streak', earned: false, prog: 0.77, progLabel: '23 / 30 days' },
  { key: 'workouts_100', icon: 'trophy', title: 'Century Club', desc: '100 workouts logged', earned: false, prog: 0.62, progLabel: '62 / 100' },
  { key: 'steps_100k', icon: 'footsteps', title: 'Step Legend', desc: '100k total steps', earned: false, prog: 0.41, progLabel: '41k / 100k' },
];

const connections = [
  { provider: 'health_connect', label: 'Health Connect', icon: 'healthconnect', connected: true, lastSync: '4 min ago', native: true, desc: 'Syncs workouts from Wear OS, Samsung & any app writing to Health Connect.' },
  { provider: 'strava', label: 'Strava', icon: 'strava', connected: true, lastSync: 'just now', desc: 'Every Strava activity is pushed within 60 seconds via webhook.' },
  { provider: 'samsung', label: 'Samsung Health', icon: 'samsung', connected: false, desc: 'Syncs through the Samsung Health → Health Connect bridge.' },
];

const notifPrefs = { streakReminder: true, challengeUpdates: true, reactions: true, leagueAlerts: true, nudges: false };

function buildHeatmap() {
  const cols = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let w = 0; w < 13; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const future = w === 12 && d > 3;
      if (future) { days.push(-1); continue; }
      const r = rnd();
      let v = 0;
      if (r > 0.34) v = 1;
      if (r > 0.62) v = 2;
      if (r > 0.82) v = 3;
      if (r > 0.93) v = 4;
      if (w >= 9) v = Math.min(4, v + (r > 0.4 ? 1 : 0));
      days.push(v);
    }
    cols.push(days);
  }
  return cols;
}

const onboard = [
  { icon: 'users', title: 'Compete with friends', body: 'Create group challenges with friends, family or coworkers. Everyone races on one live leaderboard.' },
  { icon: 'dumbbell', title: 'Any workout counts', body: 'Running, lifting, cycling, yoga — every activity earns points. You set how each challenge is scored.' },
  { icon: 'bolt', title: 'Auto-synced', body: 'Connect Health Connect or Strava. Your workouts are credited automatically — even when the app is closed.' },
  { icon: 'flame', title: 'Build your streak', body: 'Stay active every day. Earn streak points. Climb your league. Win the challenge.' },
];

const reactionsList = ['🔥', '💪', '👏', '😂'];
const REACTION_ICON = { '🔥': 'flame', '💪': 'dumbbell', '👏': 'clap', '😂': 'sparkle' };

const SCORING_LABEL = {
  workouts: 'Workouts', days_active: 'Days active', steps: 'Steps',
  distance_km: 'Distance', duration_min: 'Active minutes', calories: 'Calories', custom: 'Custom',
};
const SCORING_ICON = {
  workouts: 'dumbbell', days_active: 'calendar', steps: 'footsteps',
  distance_km: 'ruler', duration_min: 'stopwatch', calories: 'flame', custom: 'star',
};
const ACT_LABEL = { run: 'Run', walk: 'Walk', cycle: 'Cycle', swim: 'Swim', lift: 'Lift', yoga: 'Yoga', hiit: 'HIIT', sport: 'Sport', other: 'Other' };
const ACT_OPTIONS = ['run', 'walk', 'cycle', 'swim', 'lift', 'yoga', 'hiit', 'sport', 'other'];
const TIER = {
  bronze: { label: 'Bronze', color: '#CB8A52', icon: 'medal' },
  silver: { label: 'Silver', color: '#C7D0D9', icon: 'medal' },
  gold: { label: 'Gold', color: '#F5B945', icon: 'trophy' },
  platinum: { label: 'Platinum', color: '#79C7F2', icon: 'gem' },
  diamond: { label: 'Diamond', color: '#B79BF7', icon: 'crown' },
};

// activity-type -> icon name
export const ACT_ICON = { run: 'run', walk: 'walk', cycle: 'cycle', swim: 'swim', lift: 'dumbbell', yoga: 'yoga', hiit: 'hiit', sport: 'sport', other: 'other', ganga: 'footsteps' };

export const DB = {
  me, U, feed, milestones, challenges, discover, league, extra,
  achievements, connections, notifPrefs, heatmap: buildHeatmap(), onboard,
  REACTION_ICON, reactionsList, SCORING_LABEL, SCORING_ICON, ACT_LABEL, ACT_OPTIONS, TIER,
};
