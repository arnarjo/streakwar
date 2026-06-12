/* StreakWar — Leaderboard + leagues + nudge */
(function () {
  const { useState } = React;
  const e = React.createElement;

  const NUDGES = [
    { ic:'dumbbell', label:'Get moving' }, { ic:'flame', label:'Keep it hot' },
    { ic:'clap', label:'Respect' }, { ic:'bolt', label:'Wake up' }, { ic:'sparkle', label:'Hype' },
  ];

  function NudgeModal({ target, onClose }) {
    const [sent, setSent] = useState(false);
    if (!target) return null;
    const u = DB.U[target];
    return e(Modal, { open:!!target, onClose, w:300 },
      sent
        ? e('div', { style:{ textAlign:'center', animation:'sw-pop .3s ease' }},
            e('div', { style:{ width:64, height:64, margin:'0 auto 14px', borderRadius:'50%', background:a(C.green,.15), border:`1.5px solid ${a(C.green,.4)}`, display:'flex', alignItems:'center', justifyContent:'center' }}, e(Icon,{name:'check',size:30,color:C.green,stroke:2.4})),
            e('div', { style:{ font:`700 20px ${F.disp}`, color:C.text, textTransform:'uppercase' }}, 'Nudge sent'),
            e('div', { style:{ font:`400 14px ${F.ui}`, color:C.text2, marginTop:6 }}, u.full_name.split(' ')[0]+' will feel the heat.'),
            e(Btn, { full:true, onClick:onClose, style:{ marginTop:18 }}, 'Done'))
        : e('div', null,
            e('div', { style:{ display:'flex', alignItems:'center', gap:11, marginBottom:16 }},
              e(Avatar, { user:u, size:44 }),
              e('div', null, e('div',{style:{font:`700 16px ${F.ui}`,color:C.text}}, 'Nudge '+u.full_name.split(' ')[0]),
                e('div',{style:{font:`500 12.5px ${F.ui}`,color:C.text2,marginTop:1}}, 'Pick your energy'))),
            e('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }},
              NUDGES.map(n=> e('button', { key:n.ic, className:'sw-press', onClick:()=>setSent(true), style:{
                display:'flex', alignItems:'center', gap:9, padding:'12px', borderRadius:13, cursor:'pointer',
                background:C.surface, border:`1px solid ${C.line}`,
              }}, e(Icon,{name:n.ic,size:20,color:C.primary,stroke:2}), e('span',{style:{font:`600 13px ${F.ui}`,color:C.text}}, n.label)))),
        )
    );
  }

  function ScoringStrip() {
    const items = [['dumbbell','1 / workout'],['footsteps','1 / 1k steps'],['ruler','1 / km'],['stopwatch','1 / 30min']];
    return e('div', { style:{ display:'flex', gap:6, padding:'0 16px', marginBottom:14 }},
      items.map(([ic,l],k)=> e('div', { key:k, style:{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'9px 4px', background:C.surface, border:`1px solid ${C.line}`, borderRadius:12 }},
        e(Icon,{name:ic,size:15,color:C.primary,stroke:2}),
        e('span',{style:{font:`600 10px ${F.ui}`,color:C.text2,textAlign:'center'}}, l))));
  }

  function Row({ rank, user, pts, me, following, onFollow, onNudge, openProfile, zone }) {
    const u = DB.U[user] || user;
    const medal = rank<=3;
    const mc = rank===1?C.gold:rank===2?C.silver:rank===3?C.bronze:C.text2;
    const zoneColor = zone==='promo'?C.green:zone==='releg'?C.red:null;
    return e('div', { style:{
      display:'flex', alignItems:'center', gap:11, padding:'10px 12px', marginBottom:7, borderRadius:14,
      background: me?a(C.primary,.1):C.surface,
      border:`1px solid ${me?a(C.primary,.4):C.line}`,
      borderLeft: zoneColor?`3px solid ${zoneColor}`:`1px solid ${me?a(C.primary,.4):C.line}`,
    }},
      e('div', { style:{ width:24, display:'flex', justifyContent:'center', flexShrink:0 }},
        medal ? e(Icon,{name:rank===1?'trophy':'medal',size:20,color:mc,stroke:2}) : e('span',{style:{font:`700 15px ${F.disp}`,color:C.text2}}, rank)),
      e(Avatar, { user:u, size:40, onClick: openProfile&&(()=>openProfile(user)) }),
      e('div', { style:{ flex:1, minWidth:0 }},
        e('div', { style:{ font:`700 14px ${F.ui}`, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}, u.full_name||u.name, me&&e('span',{style:{color:C.primary,fontWeight:600}}, '  you')),
        zone ? e('div', { style:{ font:`700 10.5px ${F.ui}`, color:zoneColor, marginTop:2, letterSpacing:.3, display:'flex', alignItems:'center', gap:3 }}, e(Icon,{name:zone==='promo'?'chevU':'chevD',size:11,color:zoneColor,stroke:2.4}), zone==='promo'?'Promotion zone':'Relegation zone')
              : e('div', { style:{ font:`500 11.5px ${F.ui}`, color:C.text2, marginTop:1 }}, '@'+(u.username||'user'))),
      e('div', { style:{ textAlign:'right', marginRight:4 }},
        e('div', { style:{ font:`700 18px ${F.disp}`, color: me?C.primary:C.text }}, pts.toLocaleString()),
        e('div', { style:{ font:`500 9.5px ${F.ui}`, color:C.text2 }}, 'pts')),
      !me && onFollow && e(IconBtn, { name: following?'check':'plus', size:36, ic:16, active:following, onClick:()=>onFollow(user), color:C.text2 }),
      !me && e(IconBtn, { name:'dumbbell', size:36, ic:16, onClick:()=>onNudge(user), color:C.text2 }),
    );
  }

  function Leaderboard({ nav, openProfile }) {
    const [tab, setTab] = useState('league');
    const [nudge, setNudge] = useState(null);
    const [follows, setFollows] = useState(new Set(['u_kata','u_bjarki']));
    const tier = DB.TIER[DB.me.tier];
    function toggleFollow(id){ setFollows(s=>{ const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; }); }

    // league members sorted
    const lm = [...DB.league.filter(x=>x.pts>0), ...DB.extra].sort((a,b)=>b.pts-a.pts);
    const total = lm.length;

    // week board (synthetic) — me outside top to demo pinned rank
    const week = [...Object.values(DB.U)].sort((a,b)=>b.total_points-a.total_points);

    const tabs = [
      { key:'league', label:'League', icon:tier.icon },
      { key:'week', label:'Week', icon:'calendar' },
      { key:'world', label:'All-time', icon:'globe' },
      { key:'friends', label:'Friends', icon:'users' },
    ];

    let body;
    if (tab==='league') {
      body = e('div', null,
        e('div', { style:{ display:'flex', alignItems:'center', gap:10, padding:'14px', marginBottom:14, borderRadius:16, background:`linear-gradient(120deg,${a(tier.color,.16)},${C.surface})`, border:`1px solid ${a(tier.color,.3)}` }},
          e('div', { style:{ width:46, height:46, borderRadius:13, background:a(tier.color,.18), border:`1px solid ${a(tier.color,.4)}`, display:'flex', alignItems:'center', justifyContent:'center' }}, e(Icon,{name:tier.icon,size:26,color:tier.color,stroke:2})),
          e('div', { style:{ flex:1 }},
            e('div', { style:{ font:`700 19px ${F.disp}`, color:tier.color, textTransform:'uppercase', letterSpacing:'.3px' }}, tier.label+' League'),
            e('div', { style:{ font:`500 12px ${F.ui}`, color:C.text2, marginTop:1 }}, 'Top 5 promote · bottom 5 relegate · 3 days left')),
        ),
        lm.map((m,i)=>{
          const rank=i+1; const me=m.u==='u_me';
          const zone = rank<=5?'promo': rank>total-5?'releg':null;
          return e(Row, { key:m.u||i, rank, user: DB.U[m.u]?m.u:m, pts:m.pts, me, onNudge:setNudge, openProfile, zone });
        }),
      );
    } else if (tab==='friends') {
      const fr = week.filter(u=>follows.has(u.id)||u.id==='u_me');
      body = fr.length>1 ? fr.sort((a,b)=>b.total_points-a.total_points).map((u,i)=> e(Row, { key:u.id, rank:i+1, user:u.id, pts:u.total_points, me:u.id==='u_me', following:follows.has(u.id), onFollow:toggleFollow, onNudge:setNudge, openProfile }))
        : e(window.Empty, { icon:'users', title:'No friends yet', sub:'Follow people from Week or All-time to build your friends board.' });
    } else {
      const data = week.slice(0, 6);
      body = e('div', null,
        data.map((u,i)=> e(Row, { key:u.id, rank:i+1, user:u.id, pts:u.total_points, me:u.id==='u_me', following:follows.has(u.id), onFollow:toggleFollow, onNudge:setNudge, openProfile })),
        // pinned own rank (outside top)
        e('div', { style:{ position:'sticky', bottom:0, marginTop:10, paddingTop:10, background:`linear-gradient(0deg,${C.bg} 70%,transparent)` }},
          e('div', { style:{ font:`700 10px ${F.ui}`, letterSpacing:1.4, color:C.text2, textTransform:'uppercase', marginBottom:7, marginLeft:4 }}, 'Your position'),
          e(Row, { rank:7, user:'u_me', pts:DB.me.total_points, me:true })),
      );
    }

    return e(React.Fragment, null,
      e(Header, { big:true, title:'Leaderboard',
        subtitle: tab==='week'?'#7 this week · catch Eva to break top 6':'#5 in Gold · push to promote',
        right: e('div', { className:'sw-tap', onClick:()=>nav('recap'), style:{ display:'flex', alignItems:'center', gap:6, padding:'8px 11px', borderRadius:12, background:C.surface, border:`1px solid ${C.line}` }}, e(Icon,{name:'star',size:14,color:C.primary,stroke:2}), e('span',{style:{font:`700 14px ${F.disp}`,color:C.text}}, DB.me.total_points.toLocaleString())) }),
      e(Screen, { style:{ padding:'14px 0 24px' }},
        tab!=='league' && e(ScoringStrip, null),
        e('div', { style:{ padding:'0 16px', marginBottom:16 }}, e(SegTabs, { tabs, value:tab, onChange:setTab })),
        e('div', { style:{ padding:'0 16px' }}, body),
      ),
      e(NudgeModal, { target:nudge, onClose:()=>setNudge(null) }),
    );
  }

  Object.assign(window, { Leaderboard, NudgeModal });
})();
