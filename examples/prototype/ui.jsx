/* StreakWar — Profile, Edit Profile, User Profile, heatmap, achievements */
(function () {
  const { useState } = React;
  const e = React.createElement;
  const MONTHS = ['Mar','Apr','May','Jun'];

  function Heatmap() {
    const cols = DB.heatmap;
    const dayLabels = ['M','','W','','F','','S'];
    const shade = v => v<=0 ? C.surface2 : a(C.primary, [0,.28,.5,.74,1][v]);
    return e('div', { style:{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:18, padding:16, marginBottom:24 }},
      // month labels
      e('div', { style:{ display:'flex', marginLeft:20, marginBottom:6 }},
        MONTHS.map((m,i)=> e('div', { key:i, style:{ flex:1, font:`600 11px ${F.ui}`, color:C.text2 }}, m))),
      e('div', { style:{ display:'flex', gap:5 }},
        // day labels
        e('div', { style:{ display:'flex', flexDirection:'column', gap:4, marginRight:4 }},
          dayLabels.map((d,i)=> e('div', { key:i, style:{ height:13, font:`600 9px ${F.ui}`, color:C.text3, display:'flex', alignItems:'center' }}, d))),
        e('div', { style:{ flex:1, display:'flex', gap:4, justifyContent:'space-between' }},
          cols.map((col,ci)=> e('div', { key:ci, style:{ display:'flex', flexDirection:'column', gap:4, flex:1 }},
            col.map((v,di)=> e('div', { key:di, style:{
              aspectRatio:'1', borderRadius:3, background: v<0?'transparent':shade(v),
              border: v>0?`0.5px solid ${a(C.primary,.2)}`:'none',
            }}))))),
      ),
      e('div', { style:{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6, marginTop:12 }},
        e('span', { style:{ font:`500 10px ${F.ui}`, color:C.text3 }}, 'Less'),
        [0,1,2,3,4].map(v=> e('div', { key:v, style:{ width:11, height:11, borderRadius:3, background:shade(v), border: v>0?`0.5px solid ${a(C.primary,.2)}`:'none' }})),
        e('span', { style:{ font:`500 10px ${F.ui}`, color:C.text3 }}, 'More')),
    );
  }

  function AchCard({ a:ach }) {
    const earned = ach.earned;
    return e('div', { style:{
      position:'relative', background:C.surface, border:`1px solid ${earned?a(C.primary,.3):C.line}`, borderRadius:16, padding:14, overflow:'hidden',
    }},
      earned && e('div', { style:{ position:'absolute', right:-16, top:-16, width:60, height:60, borderRadius:'50%', background:a(C.primary,.12), filter:'blur(12px)' }}),
      e('div', { style:{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }},
        e('div', { style:{ width:42, height:42, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center',
          background: earned?a(C.primary,.16):C.surface2, border:`1px solid ${earned?a(C.primary,.35):C.line}` }},
          e(Icon, { name:earned?ach.icon:'lock', size:22, color: earned?C.primary:C.text3, stroke:earned?1.9:2 })),
        earned && e(Icon, { name:'checkCircle', size:18, color:C.green, stroke:2 })),
      e('div', { style:{ font:`700 13.5px ${F.ui}`, color: earned?C.text:C.text2, marginTop:11 }}, ach.title),
      e('div', { style:{ font:`500 11.5px ${F.ui}`, color:C.text2, marginTop:2, lineHeight:1.35 }}, earned?ach.desc:ach.desc),
      earned
        ? e('div', { style:{ font:`600 10.5px ${F.ui}`, color:C.primary, marginTop:8 }}, 'Earned '+ach.date)
        : e('div', { style:{ marginTop:9 }},
            e(Bar, { value:ach.prog, color:C.amber, h:5 }),
            e('div', { style:{ font:`600 10.5px ${F.ui}`, color:C.text2, marginTop:6 }}, ach.progLabel)),
    );
  }

  function Profile({ nav }) {
    const me = DB.me;
    const tier = DB.TIER[me.tier];
    const [prefs, setPrefs] = useState({ ...DB.notifPrefs });
    function tp(k){ setPrefs(p=>({ ...p, [k]:!p[k] })); }
    const stats = [
      { icon:'star', value:me.total_points.toLocaleString(), label:'Total points' },
      { icon:'dumbbell', value:'62', label:'Workouts' },
      { icon:'trophy', value:'5', label:'Challenges' },
      { icon:'medal', value:'3', label:'Wins' },
    ];
    const recent = DB.challenges.slice(0,3);
    return e(React.Fragment, null,
      e(Header, { big:true, title:'Profile', right: e(IconBtn, { name:'settings', onClick:()=>{} }) }),
      e(Screen, { style:{ padding:'8px 16px 30px' }},
        // identity
        e('div', { style:{ display:'flex', flexDirection:'column', alignItems:'center', padding:'14px 0 20px' }},
          e('div', { style:{ position:'relative' }},
            e(Avatar, { user:me, size:88, ring:true }),
            e('button', { className:'sw-tap', onClick:()=>nav('editProfile'), style:{ position:'absolute', right:-2, bottom:-2, width:30, height:30, borderRadius:15, background:C.primary, border:`3px solid ${C.bg}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }},
              e(Icon, { name:'camera', size:15, color:C.onPrimary, stroke:2.2 }))),
          e('div', { style:{ font:`700 26px ${F.disp}`, color:C.text, marginTop:14, letterSpacing:'-.3px', whiteSpace:'nowrap', lineHeight:1.1 }}, me.full_name),
          e('div', { style:{ font:`500 14px ${F.ui}`, color:C.text2, marginTop:1 }}, '@'+me.username),
          e('div', { style:{ display:'flex', gap:8, marginTop:12 }},
            e(Tag, { icon:tier.icon, color:tier.color, bg:a(tier.color,.13) }, tier.label+' League'),
            me.isPro && e(Tag, { icon:'bolt', color:C.amber, bg:a(C.amber,.13) }, 'PRO')),
          e(Btn, { variant:'outline', size:'sm', icon:'edit', onClick:()=>nav('editProfile'), style:{ marginTop:14 }}, 'Edit profile'),
        ),
        // streak
        e('div', { style:{ display:'flex', gap:10, marginBottom:14 }},
          e('div', { style:{ flex:1, background:`linear-gradient(150deg,${a(C.primary,.16)},${C.surface})`, border:`1px solid ${a(C.primary,.3)}`, borderRadius:16, padding:'15px' }},
            e('div', { style:{ display:'flex', alignItems:'center', gap:6 }}, e(Icon,{name:'flame',size:16,color:C.primary,stroke:2}), e('span',{style:{font:`600 11.5px ${F.ui}`,color:C.text2}}, 'Current')),
            e('div', { style:{ font:`800 38px ${F.disp}`, color:C.primary, lineHeight:1, marginTop:6 }}, me.current_streak),
            e('div', { style:{ font:`600 11px ${F.ui}`, color:C.text2 }}, 'day streak')),
          e('div', { style:{ flex:1, background:C.surface, border:`1px solid ${C.line}`, borderRadius:16, padding:'15px' }},
            e('div', { style:{ display:'flex', alignItems:'center', gap:6 }}, e(Icon,{name:'bolt',size:16,color:C.amber,stroke:2}), e('span',{style:{font:`600 11.5px ${F.ui}`,color:C.text2}}, 'Best')),
            e('div', { style:{ font:`800 38px ${F.disp}`, color:C.text, lineHeight:1, marginTop:6 }}, me.longest_streak),
            e('div', { style:{ font:`600 11px ${F.ui}`, color:C.text2 }}, 'day record')),
        ),
        me.isPro && e('button', { className:'sw-press', style:{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'12px', marginBottom:24, borderRadius:13, background:a(C.green,.12), border:`1px solid ${a(C.green,.35)}`, cursor:'pointer' }},
          e(Icon, { name:'shield', size:17, color:C.green, stroke:2 }), e('span',{style:{font:`700 13.5px ${F.ui}`,color:C.green}}, 'Protect today’s streak · 2 freezes left')),
        // stats
        e(SLabel, { style:{ marginBottom:11 }}, 'Stats'),
        e('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:24 }},
          stats.map(s=> e(Stat, { key:s.label, ...s }))),
        // heatmap
        e('div', { style:{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:11 }},
          e(SLabel, null, 'Activity'), e('span',{style:{font:`600 11.5px ${F.ui}`,color:C.text2}}, 'Last 13 weeks')),
        e(Heatmap, null),
        // sync
        e(SLabel, { style:{ marginBottom:11 }}, 'Auto-sync'),
        e('button', { className:'sw-press', onClick:()=>nav('devices'), style:{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'13px 14px', marginBottom:24, borderRadius:16, background:a(C.green,.08), border:`1px solid ${a(C.green,.28)}`, cursor:'pointer' }},
          e('div', { style:{ display:'flex', marginRight:-4 }}, e(Icon,{name:'healthconnect',size:26}), e(Icon,{name:'strava',size:26,style:{marginLeft:-8}})),
          e('div', { style:{ flex:1, textAlign:'left' }},
            e('div', { style:{ font:`700 14px ${F.ui}`, color:C.text }}, '2 sources connected'),
            e('div', { style:{ display:'flex', alignItems:'center', gap:5, marginTop:2 }}, e('span',{style:{width:6,height:6,borderRadius:3,background:C.green}}), e('span',{style:{font:`500 12px ${F.ui}`,color:C.green}}, 'Auto-syncing · 4 min ago'))),
          e(Icon, { name:'chevR', size:18, color:C.text3 })),
        // achievements
        e('div', { style:{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:11 }},
          e(SLabel, null, 'Achievements'), e('span',{style:{font:`600 11.5px ${F.ui}`,color:C.text2}}, '5 of 9')),
        e('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:24 }},
          DB.achievements.map(ach=> e(AchCard, { key:ach.key, a:ach }))),
        // recent challenges
        e(SLabel, { style:{ marginBottom:11 }}, 'Recent challenges'),
        recent.map(c=> e(window.ChallengeRow, { key:c.id, c, onClick:()=>nav('challengeDetail',{ id:c.id }) })),
        // notifications
        e(SLabel, { style:{ margin:'14px 0 11px' }}, 'Notifications'),
        e('div', { style:{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:16, overflow:'hidden', marginBottom:24 }},
          [['streakReminder','flame','Streak reminder','Daily nudge to keep your streak'],
           ['challengeUpdates','trophy','Challenge updates','When challenges start or end'],
           ['reactions','heart','Reactions & comments','When someone reacts to your post'],
           ['leagueAlerts','medal','League alerts','Promotion & relegation warnings']].map(([k,ic,t,d],i,arr)=>
            e('div', { key:k, style:{ display:'flex', alignItems:'center', gap:13, padding:'14px', borderBottom: i<arr.length-1?`1px solid ${C.line2}`:'none' }},
              e('div', { style:{ width:36, height:36, borderRadius:10, background:C.surface2, border:`1px solid ${C.line}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}, e(Icon,{name:ic,size:17,color:prefs[k]?C.primary:C.text3,stroke:2})),
              e('div', { style:{ flex:1 }}, e('div',{style:{font:`700 13.5px ${F.ui}`,color:C.text}}, t), e('div',{style:{font:`500 11.5px ${F.ui}`,color:C.text2,marginTop:1}}, d)),
              e(Toggle, { on:prefs[k], onChange:()=>tp(k) }))),
        ),
        e(Btn, { full:true, variant:'danger', icon:'logout', onClick:()=>nav('onboarding') }, 'Sign out'),
        e('div', { style:{ display:'flex', justifyContent:'center', gap:14, marginTop:18 }},
          ['Privacy Policy','Terms of Service'].map(t=> e('span', { key:t, style:{ font:`500 11.5px ${F.ui}`, color:C.text3 }}, t))),
      )
    );
  }

  // ── Edit Profile ──
  function EditProfile({ back }) {
    const me = DB.me;
    const [name, setName] = useState(me.full_name);
    const [un, setUn] = useState(me.username);
    const [bio, setBio] = useState(me.bio);
    return e(React.Fragment, null,
      e(Header, { title:'Edit profile', onBack:back, right: e(Btn, { size:'sm', onClick:back }, 'Save') }),
      e(Screen, { style:{ padding:'20px 16px 30px' }},
        e('div', { style:{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:26 }},
          e('div', { style:{ position:'relative' }},
            e(Avatar, { user:me, size:96, ring:true }),
            e('div', { style:{ position:'absolute', inset:0, borderRadius:'50%', background:'rgba(0,0,0,.35)', display:'flex', alignItems:'center', justifyContent:'center' }}, e(Icon,{name:'camera',size:26,color:'#fff',stroke:2}))),
          e('button', { className:'sw-tap', style:{ background:'none', border:'none', color:C.primary, font:`700 13.5px ${F.ui}`, marginTop:12, cursor:'pointer' }}, 'Change photo')),
        e('div', { style:{ display:'flex', flexDirection:'column', gap:18 }},
          e(Field, { label:'Full name', value:name, onChange:setName, icon:'user' }),
          e(Field, { label:'Username', value:un, onChange:setUn, icon:'star', right:e(Icon,{name:'checkCircle',size:18,color:C.green,stroke:2}) }),
          e(Field, { label:'Bio', value:bio, onChange:setBio, multiline:true }),
        ),
        e('div', { style:{ height:1, background:C.line2, margin:'24px 0' }}),
        e(Btn, { full:true, variant:'outline', icon:'key', onClick:()=>{}, style:{ marginTop:4 }}, 'Change password'),
      )
    );
  }

  // ── User profile (read-only, from feed/board) ──
  function UserProfile({ back, params, nav }) {
    const u = DB.U[params.id] || DB.U.u_kata;
    const [following, setFollowing] = useState(false);
    const tier = u.total_points>4500?'gold':u.total_points>3500?'silver':'bronze';
    const tm = DB.TIER[tier];
    const posts = DB.feed.filter(p=>p.user===params.id).slice(0,3);
    return e(React.Fragment, null,
      e(Header, { title:u.full_name, onBack:back, right:e(IconBtn,{name:'share',onClick:()=>{}}) }),
      e(Screen, { style:{ padding:'8px 16px 30px' }},
        e('div', { style:{ display:'flex', flexDirection:'column', alignItems:'center', padding:'14px 0 18px' }},
          e(Avatar, { user:u, size:84, ring:true }),
          e('div', { style:{ font:`700 25px ${F.disp}`, color:C.text, marginTop:13, whiteSpace:'nowrap', lineHeight:1.1 }}, u.full_name),
          e('div', { style:{ font:`500 14px ${F.ui}`, color:C.text2 }}, '@'+u.username),
          e('div', { style:{ display:'flex', gap:8, marginTop:12 }},
            e(Tag, { icon:tm.icon, color:tm.color, bg:a(tm.color,.13) }, tm.label),
            e(Tag, { icon:'flame', color:C.primary, bg:a(C.primary,.13) }, u.current_streak+'-day streak')),
          e('div', { style:{ display:'flex', gap:10, marginTop:16, width:'100%' }},
            e(Btn, { full:true, variant: following?'success':'primary', icon: following?'check':'plus', onClick:()=>setFollowing(!following) }, following?'Following':'Follow'),
            e(IconBtn, { name:'dumbbell', size:48, ic:20, onClick:()=>{} })),
        ),
        e('div', { style:{ display:'flex', gap:10, marginBottom:24 }},
          e(Stat, { icon:'star', value:u.total_points.toLocaleString(), label:'Points' }),
          e(Stat, { icon:'flame', value:u.current_streak, label:'Streak' }),
          e(Stat, { icon:'medal', value: tier==='gold'?'2':'4', label:'Wins' })),
        posts.length>0 && e('div', null,
          e(SLabel, { style:{ marginBottom:12 }}, 'Recent activity'),
          posts.map(p=> e(window.PostCard, { key:p.id, post:p, onReact:()=>{}, openProfile:()=>{}, onOpenSheet:()=>{} }))),
        posts.length===0 && e(window.Empty, { icon:'dumbbell', title:'No public workouts', sub:'This user hasn’t shared any workouts recently.' }),
      )
    );
  }

  Object.assign(window, { Profile, EditProfile, UserProfile });
})();
