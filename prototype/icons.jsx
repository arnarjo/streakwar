/* StreakWar — Connect Devices, Weekly Recap, Upgrade, Comments */
(function () {
  const { useState } = React;
  const e = React.createElement;

  function ProviderRow({ p, onToggle, onSamsung }) {
    const [open, setOpen] = useState(false);
    return e('div', { style:{ background:C.surface, border:`1px solid ${p.connected?a(C.green,.3):C.line}`, borderRadius:16, padding:14, marginBottom:10 }},
      e('div', { style:{ display:'flex', gap:13, alignItems:'flex-start' }},
        e('div', { style:{ width:44, height:44, borderRadius:12, background:C.surface2, border:`1px solid ${C.line}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}, e(Icon,{name:p.icon,size:26})),
        e('div', { style:{ flex:1, minWidth:0 }},
          e('div', { style:{ display:'flex', alignItems:'center', gap:8 }},
            e('span', { style:{ font:`700 15px ${F.ui}`, color:C.text, whiteSpace:'nowrap' }}, p.label),
            p.connected && e('span', { style:{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 7px', borderRadius:6, background:a(C.green,.16) }}, e('span',{style:{width:5,height:5,borderRadius:3,background:C.green}}), e('span',{style:{font:`700 10px ${F.ui}`,color:C.green}},'Connected'))),
          e('div', { style:{ font:`500 12px ${F.ui}`, color:C.text2, marginTop:3, lineHeight:1.4 }}, p.desc),
          p.connected && p.lastSync && e('div', { style:{ font:`600 11px ${F.ui}`, color:C.green, marginTop:5 }}, 'Last synced '+p.lastSync),
        ),
      ),
      e(Btn, { full:true, size:'sm', variant: p.connected?'danger':'primary', onClick: p.provider==='samsung'&&!p.connected?onSamsung:()=>onToggle(p.provider), style:{ marginTop:12 }},
        p.connected?'Disconnect':'Connect'),
    );
  }

  function ConnectDevices({ back }) {
    const [conns, setConns] = useState(DB.connections);
    const [samsung, setSamsung] = useState(false);
    const [showData, setShowData] = useState(false);
    function toggle(prov){ setConns(cs=>cs.map(c=>c.provider===prov?{...c,connected:!c.connected,lastSync:!c.connected?'just now':undefined}:c)); }
    const connected = conns.filter(c=>c.connected).length;
    const data = [['run','Workouts & activities'],['footsteps','Steps'],['ruler','Distance'],['flame','Active energy'],['stopwatch','Exercise minutes']];
    return e(React.Fragment, null,
      e(Header, { title:'Connect devices', onBack:back }),
      e(Screen, { style:{ padding:'18px 16px 40px' }},
        e('div', { style:{ textAlign:'center', padding:'8px 20px 22px' }},
          e('div', { style:{ width:64, height:64, margin:'0 auto 14px', borderRadius:18, background:`linear-gradient(150deg,${a(C.primary,.2)},${a(C.primary,.05)})`, border:`1px solid ${a(C.primary,.3)}`, display:'flex', alignItems:'center', justifyContent:'center' }}, e(Icon,{name:'bolt',size:32,color:C.primary,stroke:1.8})),
          e('div', { style:{ font:`700 22px ${F.disp}`, color:C.text, textTransform:'uppercase', letterSpacing:'.3px', lineHeight:1.12 }}, 'Auto-sync your workouts'),
          e('p', { style:{ font:`400 13.5px ${F.ui}`, color:C.text2, lineHeight:1.5, maxWidth:300, margin:'12px auto 0', textWrap:'pretty' }}, 'Connect your health apps and StreakWar credits new workouts automatically — even when the app is closed.')),
        connected>0 && e('div', { style:{ display:'flex', alignItems:'center', gap:9, padding:'11px 14px', marginBottom:20, borderRadius:13, background:a(C.green,.1), border:`1px solid ${a(C.green,.3)}` }},
          e('span', { style:{ width:7, height:7, borderRadius:4, background:C.green }}),
          e('span', { style:{ flex:1, font:`600 13px ${F.ui}`, color:C.green }}, connected+' source'+(connected!==1?'s':'')+' connected · auto-syncing'),
          e('button', { className:'sw-tap', style:{ background:'none', border:'none', color:C.primary, font:`700 12.5px ${F.ui}`, cursor:'pointer' }}, 'Sync now')),
        e(SLabel, { style:{ marginBottom:10 }}, 'Health platform'),
        e(ProviderRow, { p:conns[0], onToggle:toggle }),
        e(SLabel, { style:{ margin:'10px 0 10px' }}, 'Apps & devices'),
        e(ProviderRow, { p:conns[1], onToggle:toggle }),
        e(ProviderRow, { p:conns[2], onToggle:toggle, onSamsung:()=>setSamsung(true) }),
        // what we sync (GDPR transparency)
        e('button', { className:'sw-press', onClick:()=>setShowData(!showData), style:{ width:'100%', display:'flex', alignItems:'center', gap:11, padding:'13px 14px', marginTop:6, borderRadius:14, background:C.surface, border:`1px solid ${C.line}`, cursor:'pointer' }},
          e(Icon, { name:'shield', size:18, color:C.text2, stroke:2 }),
          e('span', { style:{ flex:1, textAlign:'left', font:`700 13.5px ${F.ui}`, color:C.text }}, 'What data we sync'),
          e(Icon, { name: showData?'chevU':'chevD', size:17, color:C.text3 })),
        showData && e('div', { style:{ background:C.surface, border:`1px solid ${C.line}`, borderTop:'none', borderRadius:'0 0 14px 14px', padding:'4px 14px 14px', marginTop:-8, animation:'sw-fade .2s ease' }},
          e('p', { style:{ font:`400 12px ${F.ui}`, color:C.text2, lineHeight:1.5, margin:'12px 0' }}, 'We only read these activity types. We never read location traces, heart rate or sleep. You can disconnect anytime.'),
          e('div', { style:{ display:'flex', flexWrap:'wrap', gap:8 }}, data.map(([ic,l])=> e(Tag,{key:l,icon:ic,color:C.text2}, l)))),
        e('p', { style:{ font:`400 11.5px ${F.ui}`, color:C.text3, lineHeight:1.6, textAlign:'center', marginTop:22 }}, 'Background sync runs every 15 minutes. Strava activities arrive within 60 seconds via webhook.'),
      ),
      // Samsung guided sheet (fixes dead-end)
      e(Sheet, { open:samsung, onClose:()=>setSamsung(false), title:'Connect Samsung Health' },
        e('p', { style:{ font:`400 14px ${F.ui}`, color:C.text2, margin:'0 0 18px' }}, 'Samsung Health syncs through Health Connect. Three quick steps:'),
        [['Open Samsung Health','Settings → Health Connect → turn on sharing'],
         ['Allow activity data','Enable Steps, Exercise & Distance'],
         ['Connect Health Connect','Come back and connect Health Connect above']].map(([t,d],i)=>
          e('div', { key:i, style:{ display:'flex', gap:13, marginBottom:14 }},
            e('div', { style:{ width:28, height:28, borderRadius:14, flexShrink:0, background:a(C.primary,.16), border:`1px solid ${a(C.primary,.4)}`, display:'flex', alignItems:'center', justifyContent:'center', font:`700 14px ${F.disp}`, color:C.primary }}, i+1),
            e('div', null, e('div',{style:{font:`700 14px ${F.ui}`,color:C.text}}, t), e('div',{style:{font:`500 12.5px ${F.ui}`,color:C.text2,marginTop:2,lineHeight:1.4}}, d)))),
        e(Btn, { full:true, size:'lg', icon:'link', onClick:()=>setSamsung(false), style:{ marginTop:6 }}, 'Open Samsung Health'),
      ),
    );
  }

  // ── Weekly Recap (shareable) ──
  function WeeklyRecap({ back }) {
    const me = DB.me;
    return e(React.Fragment, null,
      e(Header, { title:'Weekly recap', onBack:back, right:e(IconBtn,{name:'share',onClick:()=>{}}) }),
      e(Screen, { style:{ padding:'16px 16px 30px' }},
        e('div', { style:{ position:'relative', overflow:'hidden', borderRadius:24, padding:'24px 22px', background:`linear-gradient(160deg,${a(C.primary,.22)},${a(C.primaryDeep,.12)} 55%,${C.surface})`, border:`1px solid ${a(C.primary,.3)}` }},
          e('div', { style:{ position:'absolute', right:-40, top:-40, width:180, height:180, borderRadius:'50%', background:a(C.primary,.16), filter:'blur(36px)' }}),
          e('div', { style:{ position:'relative' }},
            e('div', { style:{ display:'flex', alignItems:'center', justifyContent:'space-between' }},
              e('div', null, e('div',{style:{font:`700 12px ${F.ui}`,letterSpacing:1.4,color:C.primary,textTransform:'uppercase'}}, 'Week 23 · 2026'),
                e('div',{style:{marginTop:6}},
                  e('div',{style:{font:`800 28px ${F.disp}`,color:C.text,textTransform:'uppercase',letterSpacing:'-.5px',lineHeight:1.05,whiteSpace:'nowrap'}}, 'Your week'),
                  e('div',{style:{font:`800 28px ${F.disp}`,color:C.text,textTransform:'uppercase',letterSpacing:'-.5px',lineHeight:1.05,whiteSpace:'nowrap'}}, 'in StreakWar'))),
              e('div', { style:{ animation:'sw-flame 2.4s ease-in-out infinite', transformOrigin:'bottom' }}, e(Icon,{name:'flame',size:44,color:C.primaryBri,stroke:1.7}))),
            e('div', { style:{ display:'flex', gap:0, marginTop:22, paddingTop:18, borderTop:`1px solid ${a(C.primary,.25)}` }},
              [['318','points','star'],['7','workouts','dumbbell'],['+2','rank ↑','podium']].map(([v,l,ic],k)=>
                e('div', { key:k, style:{ flex:1, textAlign:'center', borderLeft: k?`1px solid ${a(C.primary,.2)}`:'none' }},
                  e('div',{style:{font:`800 34px ${F.disp}`,color:C.primary,lineHeight:1}}, v),
                  e('div',{style:{font:`600 11px ${F.ui}`,color:C.text2,marginTop:3}}, l))))),
        ),
        e('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:14 }},
          [['Top activity','Running','run',C.primary],['Best day','Saturday','calendar',C.amber],['Active days','6 / 7','checkCircle',C.green],['Longest workout','88 min','stopwatch',C.blue]].map(([l,v,ic,col])=>
            e('div', { key:l, style:{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:16, padding:'14px' }},
              e('div', { style:{ display:'flex', alignItems:'center', gap:6 }}, e(Icon,{name:ic,size:16,color:col,stroke:2}), e('span',{style:{font:`600 11px ${F.ui}`,color:C.text2}}, l)),
              e('div', { style:{ font:`700 22px ${F.disp}`, color:C.text, marginTop:7 }}, v))),
        ),
        e('div', { style:{ display:'flex', alignItems:'center', gap:12, marginTop:14, padding:'15px', borderRadius:16, background:`linear-gradient(120deg,${a(C.gold,.1)},${C.surface})`, border:`1px solid ${a(C.gold,.3)}` }},
          e('div', { style:{ width:46, height:46, borderRadius:13, background:a(C.gold,.16), border:`1px solid ${a(C.gold,.4)}`, display:'flex', alignItems:'center', justifyContent:'center' }}, e(Icon,{name:'trophy',size:24,color:C.gold,stroke:2})),
          e('div', { style:{ flex:1 }}, e('div',{style:{font:`700 14.5px ${F.ui}`,color:C.text}}, 'You held your Gold spot'), e('div',{style:{font:`500 12.5px ${F.ui}`,color:C.text2,marginTop:1}}, '2 spots from promotion to Platinum'))),
        e(Btn, { full:true, size:'lg', icon:'share', onClick:back, style:{ marginTop:18 }}, 'Share my week'),
      )
    );
  }

  // ── Upgrade modal ──
  function Upgrade({ open, onClose }) {
    const feats = [['trophy','Unlimited challenges','Free plan caps at 3 active'],
      ['shield','Streak freezes','Protect your streak on rest days'],
      ['gem','Pro badge & themes','Stand out on every leaderboard'],
      ['podium','Advanced stats','Deep trends & weekly recaps']];
    return e(Modal, { open, onClose, w:340 },
      e('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }},
        e('div', { style:{ display:'flex', alignItems:'center', gap:9 }},
          e('div', { style:{ width:38, height:38, borderRadius:11, background:`linear-gradient(150deg,${C.amber},${C.primary})`, display:'flex', alignItems:'center', justifyContent:'center' }}, e(Icon,{name:'bolt',size:21,color:'#1A0E04',stroke:2.2})),
          e('div', { style:{ font:`800 24px ${F.disp}`, color:C.text, letterSpacing:'.5px' }}, 'STREAKWAR ', e('span',{style:{color:C.amber}},'PRO'))),
        e(IconBtn, { name:'x', size:34, ic:16, onClick:onClose, bg:'transparent' })),
      e('p', { style:{ font:`400 13.5px ${F.ui}`, color:C.text2, margin:'4px 0 18px' }}, 'Go all-in on the competition.'),
      e('div', { style:{ display:'flex', flexDirection:'column', gap:13, marginBottom:20 }},
        feats.map(([ic,t,d])=> e('div', { key:t, style:{ display:'flex', gap:12, alignItems:'center' }},
          e('div', { style:{ width:38, height:38, borderRadius:11, background:a(C.amber,.14), border:`1px solid ${a(C.amber,.3)}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}, e(Icon,{name:ic,size:19,color:C.amber,stroke:2})),
          e('div', null, e('div',{style:{font:`700 14px ${F.ui}`,color:C.text}}, t), e('div',{style:{font:`500 12px ${F.ui}`,color:C.text2,marginTop:1}}, d))))),
      e('div', { style:{ display:'flex', alignItems:'baseline', justifyContent:'center', gap:6, marginBottom:14 }},
        e('span', { style:{ font:`800 36px ${F.disp}`, color:C.text }}, '$4.99'),
        e('span', { style:{ font:`500 13px ${F.ui}`, color:C.text2 }}, '/ month')),
      e(Btn, { full:true, size:'lg', variant:'primary', onClick:onClose, style:{ background:`linear-gradient(180deg,${C.amber},${C.primary})` }}, 'Start 7-day free trial'),
      e('button', { className:'sw-tap', onClick:onClose, style:{ width:'100%', background:'none', border:'none', color:C.text2, font:`500 13px ${F.ui}`, marginTop:10, cursor:'pointer', padding:6 }}, 'Restore purchase'),
    );
  }
  window.Upgrade = Upgrade;

  // ── Comments (pushed) ──
  function Comments({ back, params }) {
    const post = params.post;
    const u = DB.U[post.user];
    const [list, setList] = useState([
      { user:'u_dagur', text:'Beast mode. That pace is unreal.', ago:'1h' },
      { user:'u_lena', text:'Inspiring! Joining you next time.', ago:'42m' },
      { user:'u_me', text:'Let’s gooo 🔥 — keep it up.', ago:'12m' },
    ]);
    const [txt, setTxt] = useState('');
    function send(){ if(!txt.trim())return; setList(l=>[...l,{user:'u_me',text:txt.trim(),ago:'now'}]); setTxt(''); }
    return e(React.Fragment, null,
      e(Header, { title:'Comments', onBack:back }),
      e(Screen, { style:{ padding:'14px 16px 20px' }},
        e(window.PostCard, { post, onReact:()=>{}, openProfile:()=>{}, onOpenSheet:()=>{} }),
        e('div', { style:{ margin:'8px 2px 14px' }}, e(SLabel, null, list.length+' comments')),
        list.map((c,i)=>{ const cu=DB.U[c.user]; const me=c.user==='u_me';
          return e('div', { key:i, style:{ display:'flex', gap:11, marginBottom:16 }},
            e(Avatar, { user:cu, size:36 }),
            e('div', { style:{ flex:1 }},
              e('div', { style:{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:14, borderTopLeftRadius:4, padding:'10px 13px' }},
                e('div', { style:{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}, e('span',{style:{font:`700 13px ${F.ui}`,color: me?C.primary:C.text, whiteSpace:'nowrap'}}, cu.full_name), e('span',{style:{font:`500 11px ${F.ui}`,color:C.text3, whiteSpace:'nowrap'}}, c.ago)),
                e('div', { style:{ font:`400 13.5px ${F.ui}`, color:C.text, lineHeight:1.45 }}, c.text))));
        }),
      ),
      e('div', { style:{ padding:'10px 14px 14px', borderTop:`1px solid ${C.line}`, background:C.bg, display:'flex', gap:9, alignItems:'center' }},
        e(Avatar, { user:DB.me, size:36 }),
        e('input', { value:txt, onChange:ev=>setTxt(ev.target.value), placeholder:'Add a comment…', onKeyDown:ev=>ev.key==='Enter'&&send(), style:{ flex:1, background:C.surface2, border:`1px solid ${C.line}`, borderRadius:22, padding:'11px 16px', color:C.text, font:`500 14px ${F.ui}` }}),
        e(IconBtn, { name:'arrowR', size:42, ic:19, onClick:send, bg:C.primary, color:C.onPrimary, style:{ border:'none' }}),
      ),
    );
  }

  Object.assign(window, { ConnectDevices, WeeklyRecap, Comments });
})();
