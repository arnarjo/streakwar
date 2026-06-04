/* StreakWar — Challenges, Discover, Detail, Create */
(function () {
  const { useState } = React;
  const e = React.createElement;

  const statusMeta = {
    active:    { label:'Active',    color:C.green },
    upcoming:  { label:'Upcoming',  color:C.blue },
    completed: { label:'Completed', color:C.text3 },
  };

  function ChallengeRow({ c, onClick }) {
    const sc = DB.SCORING_LABEL[c.scoring[0]];
    const si = DB.SCORING_ICON[c.scoring[0]];
    const st = statusMeta[c.status];
    const win = c.status==='completed' && c.myRank===1;
    return e(Card, { onClick, pad:15, style:{ marginBottom:10 }},
      e('div', { style:{ display:'flex', alignItems:'flex-start', gap:12 }},
        e('div', { style:{ width:46, height:46, borderRadius:13, flexShrink:0, background:a(C.primary,.13), border:`1px solid ${a(C.primary,.26)}`, display:'flex', alignItems:'center', justifyContent:'center' }},
          e(Icon, { name:si, size:23, color:C.primary, stroke:2 })),
        e('div', { style:{ flex:1, minWidth:0 }},
          e('div', { style:{ display:'flex', alignItems:'center', gap:8 }},
            e('span', { style:{ font:`700 16px ${F.ui}`, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}, c.name),
            !c.isPublic && e(Icon, { name:'lock', size:13, color:C.text3, stroke:2 }),
          ),
          e('div', { style:{ display:'flex', alignItems:'center', gap:8, marginTop:5, flexWrap:'wrap' }},
            e('span', { style:{ display:'inline-flex', alignItems:'center', gap:5, font:`600 12px ${F.ui}`, color:st.color }},
              e('span', { style:{ width:6, height:6, borderRadius:4, background:st.color }}), st.label),
            e('span', { style:{ width:3, height:3, borderRadius:2, background:C.text3 }}),
            e('span', { style:{ display:'inline-flex', alignItems:'center', gap:4, font:`500 12px ${F.ui}`, color:C.text2 }}, e(Icon,{name:'users',size:13,color:C.text2,stroke:2}), c.members),
            e('span', { style:{ width:3, height:3, borderRadius:2, background:C.text3 }}),
            e('span', { style:{ font:`500 12px ${F.ui}`, color:C.text2 }}, sc),
          ),
        ),
        c.myRank && e('div', { style:{ textAlign:'right' }},
          e('div', { style:{ display:'flex', alignItems:'center', gap:3, justifyContent:'flex-end' }},
            win && e(Icon, { name:'trophy', size:14, color:C.gold, stroke:2 }),
            e('span', { style:{ font:`700 20px ${F.disp}`, color: win?C.gold:C.text }}, '#'+c.myRank)),
          e('div', { style:{ font:`600 11px ${F.ui}`, color:C.text2 }}, c.myScore+' pts'),
        ),
      ),
      c.status==='active' && e('div', { style:{ marginTop:13, display:'flex', alignItems:'center', gap:10 }},
        e(Bar, { value: 1 - c.daysLeft/30, color:C.primary, h:5, style:{ flex:1 }}),
        e('span', { style:{ font:`600 11.5px ${F.ui}`, color:C.text2, whiteSpace:'nowrap' }}, c.daysLeft+'d left'),
      ),
    );
  }
  window.ChallengeRow = ChallengeRow;

  function DiscoverCard({ d, onJoin }) {
    const si = DB.SCORING_ICON[d.scoring[0]];
    return e(Card, { pad:15, style:{ marginBottom:10 }},
      e('div', { style:{ display:'flex', gap:12 }},
        e('div', { style:{ width:46, height:46, borderRadius:13, flexShrink:0, background:a(C.primary,.13), border:`1px solid ${a(C.primary,.26)}`, display:'flex', alignItems:'center', justifyContent:'center' }},
          e(Icon, { name:si, size:23, color:C.primary, stroke:2 })),
        e('div', { style:{ flex:1, minWidth:0 }},
          e('div', { style:{ display:'flex', alignItems:'center', gap:8 }},
            e('span', { style:{ font:`700 16px ${F.ui}`, color:C.text }}, d.name),
            e(Tag, { color:C.primary, bg:a(C.primary,.13) }, d.tag)),
          e('p', { style:{ font:`400 13px ${F.ui}`, color:C.text2, lineHeight:1.45, margin:'6px 0 0', textWrap:'pretty' }}, d.desc),
        ),
      ),
      e('div', { style:{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:13 }},
        e('span', { style:{ display:'inline-flex', alignItems:'center', gap:5, font:`500 12.5px ${F.ui}`, color:C.text2 }}, e(Icon,{name:'users',size:14,color:C.text2,stroke:2}), d.members.toLocaleString()+' competing'),
        e(Btn, { size:'sm', onClick:()=>onJoin(d) }, 'Join'),
      ),
    );
  }

  function Challenges({ nav }) {
    const [tab, setTab] = useState('active');
    const [join, setJoin] = useState(false);
    const [quick, setQuick] = useState(false);
    const [code, setCode] = useState('');
    const list = DB.challenges.filter(c=> c.status===tab || (tab==='completed'&&c.status==='completed'));
    const tabs = [
      { key:'active', label:'Active' }, { key:'upcoming', label:'Upcoming' },
      { key:'completed', label:'Done' }, { key:'discover', label:'Discover', icon:'search' },
    ];
    return e(React.Fragment, null,
      e(Header, { big:true, title:'Challenges',
        right:[
          e(IconBtn, { key:1, name:'key', onClick:()=>setJoin(true) }),
          e(Btn, { key:2, size:'sm', icon:'plus', onClick:()=>nav('create') }, 'New'),
        ]}),
      e(Screen, { style:{ padding:'14px 16px 24px' }},
        e('div', { className:'sw-press', onClick:()=>setQuick(true), style:{
          display:'flex', alignItems:'center', gap:13, padding:'14px 15px', marginBottom:16, borderRadius:16, cursor:'pointer',
          background:`linear-gradient(120deg,${a(C.primary,.16)},${C.surface})`, border:`1px solid ${a(C.primary,.3)}`,
        }},
          e('div', { style:{ width:42, height:42, borderRadius:12, background:a(C.primary,.18), border:`1px solid ${a(C.primary,.34)}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }},
            e(Icon, { name:'bolt', size:22, color:C.primary, stroke:2 })),
          e('div', { style:{ flex:1 }},
            e('div', { style:{ font:`700 15px ${F.ui}`, color:C.text }}, 'Challenge a friend'),
            e('div', { style:{ font:`500 12.5px ${F.ui}`, color:C.text2, marginTop:1 }}, 'Private 7-day 1v1 in seconds')),
          e(Icon, { name:'chevR', size:18, color:C.primary }),
        ),
        e(SegTabs, { tabs, value:tab, onChange:setTab, style:{ marginBottom:16 }}),
        tab==='discover'
          ? DB.discover.map(d=> e(DiscoverCard, { key:d.id, d, onJoin:()=>nav('challengeDetail',{ id:DB.challenges[0].id }) }))
          : list.length
            ? list.map(c=> e(ChallengeRow, { key:c.id, c, onClick:()=>nav('challengeDetail',{ id:c.id }) }))
            : e(Empty, { icon: tab==='upcoming'?'calendar':'trophy', title:`No ${tab} challenges`, sub: tab==='active'?'Start one and invite your crew.':'Nothing here yet.', cta: tab==='active'&&e(Btn,{onClick:()=>nav('create')},'Create a challenge') }),
      ),
      // join code sheet
      e(Sheet, { open:join, onClose:()=>setJoin(false), title:'Join with a code' },
        e('p', { style:{ font:`400 14px ${F.ui}`, color:C.text2, margin:'0 0 16px' }}, 'Enter the invite code a friend shared with you.'),
        e('input', { value:code, onChange:ev=>setCode(ev.target.value.toUpperCase().slice(0,8)), placeholder:'AB12CD34', style:{
          width:'100%', textAlign:'center', font:`800 30px ${F.disp}`, letterSpacing:'10px', color:C.primary,
          background:C.surface2, border:`1.5px solid ${a(C.primary,.4)}`, borderRadius:14, padding:'16px 0', marginBottom:16,
        }}),
        e(Btn, { full:true, size:'lg', disabled:code.length<4, onClick:()=>{ setJoin(false); setCode(''); nav('challengeDetail',{ id:DB.challenges[0].id }); }}, 'Join challenge'),
      ),
      e(QuickSheet, { open:quick, onClose:()=>setQuick(false) }),
    );
  }

  function QuickSheet({ open, onClose }) {
    const [step, setStep] = useState(0);
    const [name, setName] = useState('7-Day Showdown');
    const close = ()=>{ onClose(); setTimeout(()=>setStep(0),250); };
    return e(Sheet, { open, onClose:close, title: step===0?'Quick 1v1':'Challenge ready' },
      step===0
        ? e('div', null,
            e('p', { style:{ font:`400 14px ${F.ui}`, color:C.text2, margin:'0 0 16px' }}, 'Private 7-day workout duel. First to log most wins.'),
            e('div', { style:{ display:'flex', gap:8, marginBottom:16 }},
              ['7 days','Workouts','Private'].map(t=> e(Tag, { key:t, color:C.primary, bg:a(C.primary,.13) }, t))),
            e(Field, { label:'Challenge name', value:name, onChange:setName, icon:'flame', style:{ marginBottom:18 }}),
            e(Btn, { full:true, size:'lg', icon:'bolt', onClick:()=>setStep(1) }, 'Create & get code'),
          )
        : e('div', { style:{ animation:'sw-rise .3s ease' }},
            e('p', { style:{ font:`400 14px ${F.ui}`, color:C.text2, margin:'0 0 14px' }}, 'Share this code with your friend to start the duel.'),
            e('div', { style:{ textAlign:'center', font:`800 38px ${F.disp}`, letterSpacing:'10px', color:C.primary, background:C.surface2, border:`1.5px solid ${a(C.primary,.45)}`, borderRadius:16, padding:'22px 0', marginBottom:16 }}, 'XK29PD'),
            e(Btn, { full:true, size:'lg', icon:'share', onClick:close }, 'Share invite code'),
            e(Btn, { full:true, variant:'ghost', onClick:close, style:{ marginTop:8 }}, 'Done'),
          )
    );
  }

  function Empty({ icon, title, sub, cta }) {
    return e('div', { style:{ textAlign:'center', padding:'60px 30px', display:'flex', flexDirection:'column', alignItems:'center', gap:8 }},
      e('div', { style:{ width:72, height:72, borderRadius:20, background:C.surface, border:`1px solid ${C.line}`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:6 }},
        e(Icon, { name:icon, size:34, color:C.text3, stroke:1.7 })),
      e('div', { style:{ font:`700 18px ${F.ui}`, color:C.text }}, title),
      sub && e('div', { style:{ font:`400 14px ${F.ui}`, color:C.text2, maxWidth:240, lineHeight:1.45 }}, sub),
      cta && e('div', { style:{ marginTop:10 }}, cta),
    );
  }
  window.Empty = Empty;

  // ── Challenge Detail ──
  function ChallengeDetail({ nav, back, params }) {
    const c = DB.challenges.find(x=>x.id===params.id) || DB.challenges[0];
    const host = DB.U[c.host];
    const si = DB.SCORING_ICON[c.scoring[0]];
    const board = c.board.length ? c.board : [{u:'u_kata',s:0},{u:'u_me',s:0}];
    const max = Math.max(...board.map(b=>b.s), 1);
    return e(React.Fragment, null,
      e(Header, { title:c.name, onBack:back, right: e(IconBtn, { name:'share', onClick:()=>{} }) }),
      e(Screen, { style:{ padding:'16px 16px 110px' }},
        // hero
        e('div', { style:{ position:'relative', overflow:'hidden', borderRadius:20, padding:18, marginBottom:16,
          background:`linear-gradient(140deg,${a(C.primary,.18)},${C.surface})`, border:`1px solid ${a(C.primary,.26)}` }},
          e('div', { style:{ display:'flex', gap:13, alignItems:'flex-start' }},
            e('div', { style:{ width:54, height:54, borderRadius:15, flexShrink:0, background:a(C.primary,.2), border:`1px solid ${a(C.primary,.35)}`, display:'flex', alignItems:'center', justifyContent:'center' }},
              e(Icon, { name:si, size:28, color:C.primary, stroke:2 })),
            e('div', { style:{ flex:1 }},
              e('div', { style:{ display:'flex', gap:6, marginBottom:7 }},
                e(Tag, { icon:'flame', color:C.green, bg:a(C.green,.13) }, statusMeta[c.status].label),
                e(Tag, { icon: c.isPublic?'globe':'lock', color:C.text2 }, c.isPublic?'Public':'Private')),
              e('p', { style:{ font:`400 14px ${F.ui}`, color:C.text, lineHeight:1.45, margin:0, textWrap:'pretty' }}, c.desc),
            ),
          ),
          e('div', { style:{ display:'flex', gap:0, marginTop:16, paddingTop:14, borderTop:`1px solid ${C.line}` }},
            [['Members',c.members,'users'],['Your rank', c.myRank?'#'+c.myRank:'—','medal'],[c.status==='completed'?'Ended':'Days left', c.status==='completed'?'—':c.daysLeft,'calendar']].map(([l,v,ic],k)=>
              e('div', { key:k, style:{ flex:1, textAlign:'center', borderLeft: k?`1px solid ${C.line}`:'none' }},
                e('div', { style:{ font:`700 24px ${F.disp}`, color:C.text }}, v),
                e('div', { style:{ font:`600 11px ${F.ui}`, color:C.text2, marginTop:2 }}, l))),
          ),
        ),
        // host + scoring
        e('div', { style:{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }},
          e(Avatar, { user:host, size:34, onClick:()=>nav('userProfile',{ id:c.host }) }),
          e('div', { style:{ flex:1 }},
            e('span', { style:{ font:`500 12.5px ${F.ui}`, color:C.text2 }}, 'Hosted by '),
            e('span', { style:{ font:`700 13px ${F.ui}`, color:C.text }}, host.full_name)),
          e('div', { style:{ display:'flex', alignItems:'center', gap:6, padding:'7px 11px', borderRadius:10, background:C.surface2, border:`1px solid ${C.line}` }},
            e('span', { style:{ font:`600 11px 'ui-monospace',monospace`, color:C.text2, letterSpacing:1 }}, c.code),
            e(Icon, { name:'link', size:14, color:C.primary, stroke:2 })),
        ),
        // leaderboard
        e('div', { style:{ display:'flex', alignItems:'center', justifyContent:'space-between', margin:'2px 2px 12px' }},
          e(SLabel, null, 'Standings'),
          e('span', { style:{ font:`600 12px ${F.ui}`, color:C.text2 }}, DB.SCORING_LABEL[c.scoring[0]]+' scoring')),
        board.map((b,i)=>{
          const u = DB.U[b.u]; const me = b.u==='u_me'; const rank=i+1;
          const medal = rank<=3;
          const mc = rank===1?C.gold:rank===2?C.silver:rank===3?C.bronze:C.text2;
          return e('div', { key:i, style:{
            display:'flex', alignItems:'center', gap:12, padding:'11px 13px', marginBottom:7, borderRadius:14,
            background: me?a(C.primary,.1):C.surface, border:`1px solid ${me?a(C.primary,.4):C.line}`,
          }},
            e('div', { style:{ width:26, textAlign:'center', font:`700 16px ${F.disp}`, color:mc }}, medal? '' : '#'+rank),
            medal && e(Icon, { name: rank===1?'trophy':'medal', size:20, color:mc, stroke:2, style:{ marginLeft:-26, width:26 }}),
            e(Avatar, { user:u, size:38, onClick:()=>nav('userProfile',{ id:b.u }) }),
            e('div', { style:{ flex:1, minWidth:0 }},
              e('div', { style:{ font:`700 14px ${F.ui}`, color:C.text }}, u.full_name, me&&e('span',{style:{color:C.primary,fontWeight:600}},'  you')),
              e(Bar, { value:b.s/max, color: me?C.primary:C.text3, h:4, style:{ marginTop:6, maxWidth:150 }})),
            e('div', { style:{ font:`700 18px ${F.disp}`, color: me?C.primary:C.text }}, b.s),
          );
        }),
      ),
      // sticky CTA
      c.status!=='completed' && e('div', { style:{ position:'absolute', bottom:0, left:0, right:0, padding:'14px 16px 18px', background:`linear-gradient(0deg,${C.bg} 60%,transparent)` }},
        e(Btn, { full:true, size:'lg', icon:'plus', onClick:()=>nav('log',{ challengeId:c.id }) }, 'Log a workout')),
    );
  }

  // ── Create challenge ──
  function CreateChallenge({ back }) {
    const [name, setName] = useState('');
    const [scoring, setScoring] = useState('workouts');
    const [pub, setPub] = useState(false);
    const [photo, setPhoto] = useState(false);
    const [len, setLen] = useState('7');
    const scoringOpts = Object.keys(DB.SCORING_LABEL).filter(k=>k!=='custom');
    return e(React.Fragment, null,
      e(Header, { title:'New challenge', onBack:back }),
      e(Screen, { style:{ padding:'16px 16px 110px' }},
        e(Field, { label:'Challenge name', value:name, onChange:setName, icon:'trophy', placeholder:'e.g. June Burn', style:{ marginBottom:20 }}),
        e(SLabel, { style:{ marginBottom:10 }}, 'Scoring'),
        e('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:20 }},
          scoringOpts.map(k=>{
            const on = scoring===k;
            return e('button', { key:k, className:'sw-press', onClick:()=>setScoring(k), style:{
              display:'flex', alignItems:'center', gap:9, padding:'12px 12px', borderRadius:13, cursor:'pointer',
              background: on?a(C.primary,.14):C.surface, border:`1.5px solid ${on?a(C.primary,.5):C.line}`,
            }},
              e(Icon, { name:DB.SCORING_ICON[k], size:18, color:on?C.primary:C.text2, stroke:2 }),
              e('span', { style:{ font:`600 13.5px ${F.ui}`, color:on?C.text:C.text2 }}, DB.SCORING_LABEL[k]));
          })),
        e(SLabel, { style:{ marginBottom:10 }}, 'Length'),
        e(ChipRow, { items:[{key:'7',label:'7 days'},{key:'14',label:'14 days'},{key:'30',label:'30 days'},{key:'custom',label:'Custom'}], value:len, onChange:setLen, style:{ marginBottom:20 }}),
        e('div', { style:{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:16, overflow:'hidden', marginBottom:20 }},
          e(SettingRow, { icon:'globe', title:'Public challenge', sub:'Anyone can discover & join', on:pub, set:setPub }),
          e('div', { style:{ height:1, background:C.line2, margin:'0 14px' }}),
          e(SettingRow, { icon:'camera', title:'Require photo proof', sub:'Members must attach a photo', on:photo, set:setPhoto }),
        ),
      ),
      e('div', { style:{ position:'absolute', bottom:0, left:0, right:0, padding:'14px 16px 18px', background:`linear-gradient(0deg,${C.bg} 60%,transparent)` }},
        e(Btn, { full:true, size:'lg', disabled:!name.trim(), icon:'check', onClick:back }, 'Create challenge')),
    );
  }

  function SettingRow({ icon, title, sub, on, set }) {
    return e('div', { style:{ display:'flex', alignItems:'center', gap:13, padding:'14px' }},
      e('div', { style:{ width:38, height:38, borderRadius:11, background:C.surface2, border:`1px solid ${C.line}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }},
        e(Icon, { name:icon, size:18, color:C.text2, stroke:2 })),
      e('div', { style:{ flex:1 }},
        e('div', { style:{ font:`700 14px ${F.ui}`, color:C.text }}, title),
        e('div', { style:{ font:`500 12px ${F.ui}`, color:C.text2, marginTop:1 }}, sub)),
      e(Toggle, { on, onChange:set }),
    );
  }
  window.SettingRow = SettingRow;

  Object.assign(window, { Challenges, ChallengeDetail, CreateChallenge });
})();
