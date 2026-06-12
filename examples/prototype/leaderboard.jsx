/* StreakWar — Home feed */
(function () {
  const { useState, useEffect } = React;
  const e = React.createElement;

  // photo placeholder (no fake imagery — striped slot w/ mono label)
  function PhotoSlot({ label = 'workout photo', h = 200 }) {
    return e('div', { style:{
      height:h, borderRadius:14, overflow:'hidden', position:'relative',
      background:`repeating-linear-gradient(135deg, ${C.surface2}, ${C.surface2} 11px, ${C.surface} 11px, ${C.surface} 22px)`,
      border:`1px solid ${C.line}`, display:'flex', alignItems:'center', justifyContent:'center',
    }},
      e('span', { style:{ font:`500 11px ui-monospace, monospace`, color:C.text3, letterSpacing:.5, background:a(C.bg,.5), padding:'4px 10px', borderRadius:6 }}, label));
  }
  window.PhotoSlot = PhotoSlot;

  function ReactionBar({ post, onReact, onComment, onOpenSheet }) {
    const counts = post.reactions || {};
    const total = Object.values(counts).reduce((a,b)=>a+b,0);
    return e('div', { style:{ display:'flex', alignItems:'center', gap:8, marginTop:13 }},
      DB.reactionsList.map(r => {
        const on = post.myReaction === r;
        return e('button', { key:r, className:'sw-tap', onClick:()=>onReact(post.id, r), style:{
          display:'flex', alignItems:'center', gap:5, padding:'7px 11px', borderRadius:11, cursor:'pointer', minHeight:38,
          background: on ? a(C.primary,.16) : C.surface2, border:`1px solid ${on?a(C.primary,.4):C.line}`,
        }},
          e(Icon, { name:DB.REACTION_ICON[r], size:15, color: on?C.primary:C.text2, stroke:2 }),
          (counts[r] ? e('span', { style:{ font:`700 12.5px ${F.ui}`, color: on?C.primary:C.text2 }}, counts[r]) : null),
        );
      }),
      e('div', { style:{ flex:1 }}),
      e('button', { className:'sw-tap', onClick:()=>onOpenSheet(post), style:{
        display:'flex', alignItems:'center', gap:6, padding:'7px 11px', borderRadius:11, minHeight:38,
        background:C.surface2, border:`1px solid ${C.line}`, cursor:'pointer',
      }}, e(Icon, { name:'mail', size:15, color:C.text2, stroke:2 }), e('span', { style:{ font:`700 12.5px ${F.ui}`, color:C.text2 }}, post.comments || 0)),
    );
  }

  function PostCard({ post, onReact, openProfile, onOpenSheet }) {
    const u = DB.U[post.user];
    return e(Card, { pad:15, style:{ marginBottom:12 }},
      e('div', { style:{ display:'flex', alignItems:'center', gap:11 }},
        e(Avatar, { user:u, size:42, onClick:()=>openProfile(post.user) }),
        e('div', { style:{ flex:1, minWidth:0 }},
          e('div', { className:'sw-tap', onClick:()=>openProfile(post.user), style:{ font:`700 15px ${F.ui}`, color:C.text, display:'inline-block' }}, u.full_name),
          e('div', { style:{ display:'flex', alignItems:'center', gap:6, marginTop:1 }},
            e('span', { style:{ font:`500 12px ${F.ui}`, color:C.text2 }}, post.date),
            post.source!=='manual' && e('span', { style:{ display:'inline-flex', alignItems:'center', gap:3 }},
              e('span', { style:{ width:3, height:3, borderRadius:2, background:C.text3 }}),
              e(Icon, { name: post.source==='strava'?'strava':'healthconnect', size:12 }),
              e('span', { style:{ font:`500 11.5px ${F.ui}`, color:C.text3 }}, post.source==='strava'?'Strava':'auto')),
          ),
        ),
        e(ActIcon, { act:post.activity, size:40 }),
      ),
      post.caption && e('p', { style:{ font:`400 14.5px ${F.ui}`, color:C.text, lineHeight:1.5, margin:'12px 0 0', textWrap:'pretty' }}, post.caption),
      post.hasPhoto && e('div', { style:{ marginTop:12 }}, e(PhotoSlot, { h:188, label:`${DB.ACT_LABEL[post.activity].toLowerCase()} photo` })),
      // metric strip
      e('div', { style:{ display:'flex', gap:18, marginTop:13, paddingTop:13, borderTop:`1px solid ${C.line2}` }},
        [ post.mins!=null && ['stopwatch', post.mins, 'min'],
          post.km!=null && ['ruler', post.km, 'km'],
          post.kcal!=null && ['flame', post.kcal, 'kcal'],
        ].filter(Boolean).map(([ic,v,l],k)=> e('div', { key:k, style:{ display:'flex', alignItems:'center', gap:7 }},
          e(Icon, { name:ic, size:16, color:C.primary, stroke:2 }),
          e('span', { style:{ font:`700 16px ${F.disp}`, color:C.text }}, v),
          e('span', { style:{ font:`500 12px ${F.ui}`, color:C.text2 }}, l),
        ))),
      e(ReactionBar, { post, onReact, onOpenSheet }),
    );
  }

  function StreakHero({ streak, best, onShare }) {
    const toNext = 10 - (streak % 10 || 0) || 10;
    const milestone = Math.ceil((streak+1)/10)*10;
    const prog = (streak % 10) / 10;
    return e('div', { className:'sw-press', onClick:onShare, style:{
      position:'relative', overflow:'hidden', borderRadius:22, padding:'20px 20px 18px', marginBottom:14, cursor:'pointer',
      background:`linear-gradient(145deg, ${a(C.primary,.20)}, ${a(C.primaryDeep,.10)} 60%, ${C.surface})`,
      border:`1px solid ${a(C.primary,.3)}`, boxShadow:`0 16px 40px -18px ${a(C.primary,.6)}`,
    }},
      e('div', { style:{ position:'absolute', right:-30, top:-30, width:160, height:160, borderRadius:'50%', background:a(C.primary,.14), filter:'blur(30px)' }}),
      e('div', { style:{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', position:'relative' }},
        e('div', null,
          e('div', { style:{ display:'flex', alignItems:'baseline', gap:8 }},
            e('span', { style:{ font:`800 64px ${F.disp}`, color:C.primary, letterSpacing:'-2px', lineHeight:.9, textShadow:`0 4px 20px ${a(C.primary,.5)}` }}, streak),
            e('div', { style:{ animation:'sw-flame 2.2s ease-in-out infinite', transformOrigin:'bottom center' }}, e(Icon, { name:'flame', size:30, color:C.primaryBri, stroke:1.8 })),
          ),
          e('div', { style:{ font:`700 17px ${F.ui}`, color:C.text, marginTop:2 }}, 'day streak'),
          e('div', { style:{ font:`500 12.5px ${F.ui}`, color:C.text2, marginTop:2 }}, 'Personal best · ', e('span',{style:{color:C.amber,fontWeight:700}}, best+' days')),
        ),
        e('div', { style:{ display:'flex', alignItems:'center', gap:6, padding:'7px 11px', borderRadius:11, background:a(C.bg,.4), border:`1px solid ${C.line}` }},
          e(Icon, { name:'share', size:14, color:C.text, stroke:2 }), e('span', { style:{ font:`700 12.5px ${F.ui}`, color:C.text }}, 'Share')),
      ),
      e('div', { style:{ marginTop:16, position:'relative' }},
        e(Bar, { value:prog, color:C.primary, h:7, glow:true }),
        e('div', { style:{ display:'flex', justifyContent:'space-between', marginTop:8 }},
          e('span', { style:{ font:`500 12px ${F.ui}`, color:C.text2 }}, e('span',{style:{color:C.text,fontWeight:700}}, toNext+' days'), ' to ', milestone, '-day milestone'),
          e('span', { style:{ font:`700 12px ${F.ui}`, color:C.primary }}, milestone, e(Icon,{name:'flame',size:11,color:C.primary,stroke:2,style:{verticalAlign:'-1px',marginLeft:2}})),
        ),
      )
    );
  }

  function Banner({ icon, iconColor, title, sub, onClick, accent }) {
    return e('div', { className:'sw-press', onClick, style:{
      display:'flex', alignItems:'center', gap:13, padding:'13px 15px', marginBottom:10, borderRadius:16, cursor:'pointer',
      background:C.surface, border:`1px solid ${a(accent||iconColor,.28)}`,
    }},
      e('div', { style:{ width:42, height:42, borderRadius:12, flexShrink:0, background:a(iconColor,.14), border:`1px solid ${a(iconColor,.3)}`, display:'flex', alignItems:'center', justifyContent:'center' }},
        e(Icon, { name:icon, size:22, color:iconColor, stroke:2 })),
      e('div', { style:{ flex:1, minWidth:0 }},
        e('div', { style:{ font:`700 14.5px ${F.ui}`, color:C.text }}, title),
        e('div', { style:{ font:`500 12.5px ${F.ui}`, color:C.text2, marginTop:1 }}, sub)),
      e(Icon, { name:'chevR', size:18, color:C.text3 }),
    );
  }

  function MilestoneCard({ m, onReact, openProfile }) {
    const u = DB.U[m.user];
    return e(Card, { pad:14, style:{ marginBottom:10, background:`linear-gradient(120deg,${a(C.amber,.08)},${C.surface})`, borderColor:a(C.amber,.25) }},
      e('div', { style:{ display:'flex', alignItems:'center', gap:12 }},
        e('div', { style:{ position:'relative' }},
          e(Avatar, { user:u, size:44, onClick:()=>openProfile(m.user) }),
          e('div', { style:{ position:'absolute', right:-4, bottom:-4, width:22, height:22, borderRadius:11, background:C.amber, display:'flex', alignItems:'center', justifyContent:'center', border:`2px solid ${C.surface}` }},
            e(Icon, { name:'flame', size:12, color:C.onPrimary, stroke:2.4 })),
        ),
        e('div', { style:{ flex:1, minWidth:0 }},
          e('div', { style:{ font:`700 14px ${F.ui}`, color:C.text }}, u.full_name, ' hit a ', e('span',{style:{color:C.amber}}, m.streak+'-day'), ' streak'),
          e('div', { style:{ font:`500 12px ${F.ui}`, color:C.text2, marginTop:1 }}, m.ago, ' ago · send some hype'),
        ),
      ),
      e('div', { style:{ display:'flex', gap:7, marginTop:12 }},
        DB.reactionsList.map(r=>{
          const on = m.myReaction===r;
          return e('button', { key:r, className:'sw-tap', onClick:()=>onReact(m.id,r), style:{
            display:'flex', alignItems:'center', gap:5, padding:'6px 10px', borderRadius:10, cursor:'pointer', minHeight:36,
            background:on?a(C.amber,.18):C.surface2, border:`1px solid ${on?a(C.amber,.45):C.line}`,
          }}, e(Icon, { name:DB.REACTION_ICON[r], size:14, color:on?C.amber:C.text2, stroke:2 }),
             m.reactions[r]&&e('span',{style:{font:`700 12px ${F.ui}`,color:on?C.amber:C.text2}}, m.reactions[r]));
        })),
    );
  }

  function Home({ nav, openProfile }) {
    const [loading, setLoading] = useState(true);
    const [feed, setFeed] = useState(DB.feed);
    const [ms, setMs] = useState(DB.milestones);
    useEffect(()=>{ const t=setTimeout(()=>setLoading(false), 950); return ()=>clearTimeout(t); }, []);

    function react(id, r) {
      setFeed(f=>f.map(p=>{
        if (p.id!==id) return p;
        const rc={...p.reactions}; const prev=p.myReaction;
        if (prev) rc[prev]=(rc[prev]||1)-1;
        if (prev===r) return {...p, myReaction:null, reactions:rc};
        rc[r]=(rc[r]||0)+1; return {...p, myReaction:r, reactions:rc};
      }));
    }
    function reactMs(id,r){ setMs(m=>m.map(x=> x.id!==id?x:(()=>{ const rc={...x.reactions}; const prev=x.myReaction; if(prev)rc[prev]=(rc[prev]||1)-1; if(prev===r) return {...x,myReaction:null,reactions:rc}; rc[r]=(rc[r]||0)+1; return {...x,myReaction:r,reactions:rc}; })())); }

    const me = DB.me;
    const active = DB.challenges.filter(c=>c.status==='active').slice(0,2);
    const tier = DB.TIER[me.tier];

    return e(React.Fragment, null,
      e(Header, { big:true, title:`Hæ, ${me.full_name.split(' ')[0]}`, subtitle:"Ready to move today?",
        left: e(Avatar, { user:me, size:42, onClick:()=>nav('profile') }),
        right:[
          e('div', { key:'p', className:'sw-tap', onClick:()=>nav('leaderboard'), style:{ display:'flex', alignItems:'center', gap:6, padding:'8px 11px', borderRadius:12, background:C.surface, border:`1px solid ${C.line}` }},
            e(Icon, { name:'star', size:14, color:C.primary, stroke:2 }),
            e('span', { style:{ font:`700 14px ${F.disp}`, color:C.text, letterSpacing:'.3px' }}, me.total_points.toLocaleString())),
          e(IconBtn, { key:'b', name:'bell', onClick:()=>nav('profile') }),
        ]}),
      e(Screen, { style:{ padding:'14px 16px 24px' }},
        loading
          ? e('div', null,
              e(Skel, { h:150, r:22, style:{ marginBottom:14 }}),
              e(Skel, { h:64, r:16, style:{ marginBottom:10 }}),
              e(Skel, { h:64, r:16, style:{ marginBottom:18 }}),
              [0,1].map(k=> e('div', { key:k, style:{ marginBottom:12, padding:15, background:C.surface, border:`1px solid ${C.line}`, borderRadius:18 }},
                e('div',{style:{display:'flex',gap:11,alignItems:'center'}}, e(Skel,{w:42,h:42,r:21}), e('div',{style:{flex:1}}, e(Skel,{w:'55%',h:13,style:{marginBottom:7}}), e(Skel,{w:'35%',h:11})), e(Skel,{w:40,h:40,r:13})),
                e(Skel,{h:13,style:{marginTop:14}}), e(Skel,{w:'80%',h:13,style:{marginTop:8}}))),
            )
          : e('div', null,
              e(StreakHero, { streak:me.current_streak, best:me.longest_streak, onShare:()=>nav('recap') }),
              e(Banner, { icon:tier.icon, iconColor:tier.color, accent:tier.color, title:`#5 in ${tier.label} League`, sub:'3 days left · top 5 promote', onClick:()=>nav('leaderboard') }),
              e(Banner, { icon:'target', iconColor:C.primary, title:'Katrín is 162 pts ahead of you', sub:'Your rival this week · catch up', onClick:()=>nav('leaderboard') }),
              e('div', { style:{ display:'flex', alignItems:'center', justifyContent:'space-between', margin:'20px 2px 12px' }},
                e(SLabel, null, 'Active challenges'),
                e('button', { className:'sw-tap', onClick:()=>nav('challenges'), style:{ background:'none', border:'none', color:C.primary, font:`700 12.5px ${F.ui}`, cursor:'pointer' }}, 'See all')),
              active.map(c=> e(window.ChallengeRow, { key:c.id, c, onClick:()=>nav('challengeDetail',{ id:c.id }) })),
              e('div', { style:{ margin:'20px 2px 12px' }}, e(SLabel, null, 'Streak milestones')),
              ms.map(m=> e(MilestoneCard, { key:m.id, m, onReact:reactMs, openProfile })),
              e('div', { style:{ margin:'20px 2px 12px' }}, e(SLabel, null, 'Friends feed')),
              feed.map(p=> e(PostCard, { key:p.id, post:p, onReact:react, openProfile, onOpenSheet:(post)=>nav('comments',{ post }) })),
            )
      )
    );
  }

  Object.assign(window, { Home, PostCard, ReactionBar, StreakHero });
})();
