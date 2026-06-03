/* StreakWar — app shell, navigation, bottom nav, screen jumper */
(function () {
  const { useState, useRef } = React;
  const e = React.createElement;

  const TABS = [
    { key:'home', label:'Home', icon:'home' },
    { key:'challenges', label:'Challenges', icon:'trophy' },
    { key:'leaderboard', label:'Ranks', icon:'podium' },
    { key:'profile', label:'Profile', icon:'user' },
  ];
  const TAB_KEYS = TABS.map(t=>t.key);
  const AUTH = ['onboarding','login','signup','reset'];

  function BottomNav({ active, onTab, onLog }) {
    return e('div', { style:{ flexShrink:0, position:'relative', background:a(C.bg,.92), backdropFilter:'blur(14px)', borderTop:`1px solid ${C.line}`, padding:'9px 10px 7px', display:'flex', alignItems:'center', justifyContent:'space-between' }},
      TABS.slice(0,2).map(t=> e(NavItem, { key:t.key, t, on:active===t.key, onClick:()=>onTab(t.key) })),
      // center FAB
      e('button', { className:'sw-press', onClick:onLog, style:{
        width:58, height:58, borderRadius:20, marginTop:-24, flexShrink:0, cursor:'pointer',
        background:`linear-gradient(180deg,${C.primaryBri},${C.primary})`, border:`4px solid ${C.bg}`,
        display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 8px 22px -6px ${a(C.primary,.8)}`,
      }}, e(Icon, { name:'plus', size:28, color:C.onPrimary, stroke:2.6 })),
      TABS.slice(2).map(t=> e(NavItem, { key:t.key, t, on:active===t.key, onClick:()=>onTab(t.key) })),
    );
  }
  function NavItem({ t, on, onClick }) {
    return e('button', { className:'sw-tap', onClick, style:{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, background:'none', border:'none', cursor:'pointer', padding:'4px 0', minWidth:54 }},
      e(Icon, { name:t.icon, size:23, color: on?C.primary:C.text3, stroke: on?2.2:2 }),
      e('span', { style:{ font:`700 10px ${F.ui}`, color: on?C.primary:C.text3, letterSpacing:.2 }}, t.label));
  }

  const SCREENS = {
    onboarding: Onboarding, login: Login, signup: Signup, reset: Reset,
    home: Home, challenges: Challenges, leaderboard: Leaderboard, profile: Profile,
    log: LogWorkout, challengeDetail: ChallengeDetail, create: CreateChallenge,
    devices: ConnectDevices, recap: WeeklyRecap, editProfile: EditProfile,
    userProfile: UserProfile, comments: Comments,
  };
  const SCREEN_LABELS = {
    onboarding:'Onboarding', login:'Login', signup:'Sign up', reset:'Reset password',
    home:'Home feed', challenges:'Challenges', leaderboard:'Leaderboard', profile:'Profile',
    log:'Log workout', challengeDetail:'Challenge detail', create:'Create challenge',
    devices:'Connect devices', recap:'Weekly recap', editProfile:'Edit profile',
    userProfile:'User profile', comments:'Comments',
  };

  function App() {
    const [authed, setAuthed] = useState(false);
    const [stack, setStack] = useState([{ screen:'onboarding', params:{} }]);
    const [upgrade, setUpgrade] = useState(false);
    const dir = useRef('push');
    const top = stack[stack.length-1];

    function nav(screen, params={}) {
      if (TAB_KEYS.includes(screen)) { dir.current='fade'; setStack([{ screen, params }]); return; }
      dir.current='push'; setStack(s=>[...s, { screen, params }]);
    }
    function back() { dir.current='pop'; setStack(s=> s.length>1 ? s.slice(0,-1) : s); }
    function tab(key) { dir.current='fade'; setStack([{ screen:key, params:{} }]); }
    function signIn() { setAuthed(true); dir.current='fade'; setStack([{ screen:'home', params:{} }]); }
    function openProfile(id) { nav('userProfile', { id }); }

    const Comp = SCREENS[top.screen];
    const props = { nav, back, tab, params:top.params, signIn, openProfile, openUpgrade:()=>setUpgrade(true) };
    const isAuth = AUTH.includes(top.screen);
    const showNav = !isAuth && top.screen!=='log' && TAB_KEYS.includes(top.screen);
    const anim = dir.current==='pop' ? 'sw-slideR' : dir.current==='push' ? 'sw-slideL' : 'sw-fade';

    return e('div', { style:{ minHeight:'100vh', width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:34, padding:'28px 24px',
      background:`radial-gradient(1200px 700px at 50% -10%, #161E2A, #0A0D12 60%)`, fontFamily:F.ui }},
      e(ScreenJumper, { current:top.screen, go:(s)=>{ if(AUTH.includes(s)){ setAuthed(false);} else { setAuthed(true);} dir.current='fade'; setStack([{ screen:s, params: s==='userProfile'?{id:'u_kata'}: s==='comments'?{post:DB.feed[0]}: s==='challengeDetail'?{id:'c1'}:{} }]); }, labels:SCREEN_LABELS }),
      e(Phone, null,
        e('div', { style:{ flex:1, minHeight:0, display:'flex', flexDirection:'column' }},
          e('div', { key: stack.length+top.screen, style:{ flex:1, minHeight:0, display:'flex', flexDirection:'column' }},
            e(Comp, props)),
          showNav && e(BottomNav, { active:top.screen, onTab:tab, onLog:()=>nav('log') }),
        ),
        e(Upgrade, { open:upgrade, onClose:()=>setUpgrade(false) }),
      ),
    );
  }

  // floating review menu (outside phone)
  function ScreenJumper({ current, go, labels }) {
    const [open, setOpen] = useState(true);
    const groups = [
      ['Onboarding & auth', ['onboarding','login','signup','reset']],
      ['Main tabs', ['home','challenges','leaderboard','profile']],
      ['Flows & detail', ['log','challengeDetail','create','comments','userProfile','editProfile','devices','recap']],
    ];
    if (!open) return e('button', { className:'sw-tap', onClick:()=>setOpen(true), style:{ position:'fixed', left:18, top:18, zIndex:50, width:44, height:44, borderRadius:12, background:C.surface, border:`1px solid ${C.line}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}, e(Icon,{name:'grid',size:20,color:C.text2,stroke:2}));
    return e('div', { style:{ width:230, flexShrink:0, maxHeight:'88vh', overflowY:'auto', background:a(C.surface,.7), backdropFilter:'blur(12px)', border:`1px solid ${C.line}`, borderRadius:20, padding:16, alignSelf:'center' }, className:'sw-scroll' },
      e('div', { style:{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }},
        e(Wordmark, { size:17 }),
        e(IconBtn, { name:'x', size:30, ic:14, bg:'transparent', onClick:()=>setOpen(false) })),
      e('div', { style:{ font:`500 11px ${F.ui}`, color:C.text3, marginBottom:14, lineHeight:1.4 }}, 'Redesign preview — jump to any screen.'),
      groups.map(([title, keys])=> e('div', { key:title, style:{ marginBottom:14 }},
        e('div', { style:{ font:`700 10px ${F.ui}`, letterSpacing:1.3, color:C.text3, textTransform:'uppercase', marginBottom:7 }}, title),
        keys.map(k=> e('button', { key:k, className:'sw-tap', onClick:()=>go(k), style:{
          display:'block', width:'100%', textAlign:'left', padding:'8px 11px', marginBottom:4, borderRadius:9, cursor:'pointer',
          background: current===k ? a(C.primary,.16) : 'transparent', border:`1px solid ${current===k?a(C.primary,.4):'transparent'}`,
          color: current===k?C.primary:C.text2, font:`600 13px ${F.ui}`,
        }}, labels[k]))),
      ),
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(e(App));
})();
