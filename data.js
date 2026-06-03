/* StreakWar — auth screens: Onboarding, Login, Signup, Reset */
(function () {
  const { useState } = React;
  const e = React.createElement;

  function Wordmark({ size = 26 }) {
    return e('div', { style:{ display:'flex', alignItems:'center', gap:9 }},
      e('div', { style:{
        width:size*1.3, height:size*1.3, borderRadius:size*0.38,
        background:`linear-gradient(150deg,${C.primaryBri},${C.primaryDeep})`,
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:`0 6px 18px -6px ${a(C.primary,.8)}`,
      }}, e(Icon, { name:'flame', size:size*0.82, color:'#fff', stroke:2.2 })),
      e('div', { style:{ font:`800 ${size}px ${F.disp}`, color:C.text, letterSpacing:'1.5px' }}, 'STREAK',
        e('span', { style:{ color:C.primary }}, 'WAR')),
    );
  }
  window.Wordmark = Wordmark;

  // ── Onboarding ──
  function Onboarding({ nav }) {
    const [i, setI] = useState(0);
    const slides = DB.onboard;
    const s = slides[i];
    const last = i === slides.length - 1;
    return e(Screen, { style:{ padding:'0', display:'flex', flexDirection:'column' }},
      e('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 18px 0' }},
        e(Wordmark, { size:20 }),
        e('button', { className:'sw-tap', onClick:()=>nav('signup'), style:{ background:'none', border:'none', color:C.text2, font:`600 14px ${F.ui}`, cursor:'pointer', padding:8 }}, 'Skip'),
      ),
      e('div', { key:i, style:{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'0 24px', textAlign:'center' }},
        e('div', { style:{ position:'relative', marginBottom:34 }},
          e('div', { style:{ position:'absolute', inset:-18, borderRadius:'50%', background:a(C.primary,.12), filter:'blur(14px)' }}),
          e('div', { style:{
            width:150, height:150, borderRadius:'50%', position:'relative',
            background:`radial-gradient(circle at 50% 35%, ${a(C.primary,.22)}, ${a(C.primary,.04)})`,
            border:`1.5px solid ${a(C.primary,.35)}`,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}, e(Icon, { name:s.icon, size:66, color:C.primary, stroke:1.6 })),
        ),
        e('div', { style:{ width:44, height:4, borderRadius:2, background:C.primary, marginBottom:22 }}),
        e('h1', { style:{ font:`700 33px ${F.disp}`, color:C.text, letterSpacing:'-.5px', textTransform:'uppercase', lineHeight:1.12, margin:'0 0 18px', flexShrink:0 }}, s.title),
        e('p', { style:{ font:`400 16px ${F.ui}`, color:C.text2, lineHeight:1.5, margin:0, maxWidth:300, textWrap:'pretty', flexShrink:0 }}, s.body),
      ),
      e('div', { style:{ padding:'0 24px 22px' }},
        e('div', { style:{ display:'flex', justifyContent:'center', gap:7, marginBottom:22 }},
          slides.map((_,k)=> e('div', { key:k, onClick:()=>setI(k), className:'sw-tap', style:{
            height:7, borderRadius:4, cursor:'pointer', transition:'all .25s ease',
            width: k===i?26:7, background: k===i?C.primary:'rgba(255,255,255,.18)',
          }}))),
        e(Btn, { full:true, size:'lg', onClick:()=> last ? nav('signup') : setI(i+1), iconR: last?undefined:'arrowR' }, last ? 'Create your account' : 'Next'),
        last && e('button', { className:'sw-tap', onClick:()=>nav('login'), style:{ width:'100%', background:'none', border:'none', color:C.text2, font:`500 14px ${F.ui}`, marginTop:14, cursor:'pointer', padding:6 }},
          'Already have an account? ', e('span', { style:{ color:C.primary, fontWeight:700 }}, 'Sign in')),
      )
    );
  }

  // ── Social button (real brand marks) ──
  function Social({ brand, label, onClick, bg, color, border }) {
    return e('button', { className:'sw-press', onClick, style:{
      display:'flex', alignItems:'center', justifyContent:'center', gap:11, width:'100%', minHeight:50,
      borderRadius:14, cursor:'pointer', font:`700 15px ${F.ui}`,
      background: bg||C.surface2, color: color||C.text, border:`1px solid ${border||C.line}`,
    }}, e(Icon, { name:brand, size:20 }), label);
  }

  function AuthShell({ children, onBack }) {
    return e(Screen, { style:{ padding:'8px 24px 30px' }},
      onBack && e('button', { className:'sw-tap', onClick:onBack, style:{ display:'flex', alignItems:'center', gap:4, background:'none', border:'none', color:C.text2, font:`600 14px ${F.ui}`, cursor:'pointer', padding:'8px 0', marginBottom:4 }},
        e(Icon, { name:'chevL', size:18, color:C.text2 }), 'Back'),
      e('div', { style:{ display:'flex', justifyContent:'center', margin:'14px 0 26px' }}, e(Wordmark, { size:24 })),
      children,
    );
  }

  // ── Login ──
  function Login({ nav, signIn }) {
    const [email, setEmail] = useState('arnar@streakwar.app');
    const [pw, setPw] = useState('••••••••');
    const [show, setShow] = useState(false);
    const [err, setErr] = useState('');
    return e(AuthShell, { onBack:()=>nav('onboarding') },
      e('h1', { style:{ font:`700 32px ${F.disp}`, color:C.text, letterSpacing:'-.4px', textTransform:'uppercase', margin:'0 0 6px' }}, 'Welcome back'),
      e('p', { style:{ font:`400 15px ${F.ui}`, color:C.text2, margin:'0 0 26px' }}, 'Sign in to keep your streak alive.'),
      e(Field, { label:'Email', value:email, onChange:setEmail, icon:'mail', placeholder:'you@example.com', error:err, style:{ marginBottom:16 }}),
      e(Field, { label:'Password', value:pw, onChange:setPw, icon:'lock', type: show?'text':'password', placeholder:'••••••••',
        right: e('button', { onClick:()=>setShow(!show), className:'sw-tap', style:{ background:'none', border:'none', cursor:'pointer', padding:6 }}, e(Icon, { name: show?'eyeOff':'eye', size:18, color:C.text3 })),
      }),
      e('button', { className:'sw-tap', onClick:()=>nav('reset'), style:{ display:'block', marginLeft:'auto', background:'none', border:'none', color:C.primary, font:`600 13px ${F.ui}`, cursor:'pointer', padding:'10px 2px 18px' }}, 'Forgot password?'),
      e(Btn, { full:true, size:'lg', onClick:signIn }, 'Sign in'),
      e('div', { style:{ display:'flex', alignItems:'center', gap:12, margin:'22px 0' }},
        e('div', { style:{ flex:1, height:1, background:C.line }}),
        e('span', { style:{ font:`500 12.5px ${F.ui}`, color:C.text3 }}, 'or continue with'),
        e('div', { style:{ flex:1, height:1, background:C.line }}),
      ),
      e('div', { style:{ display:'flex', flexDirection:'column', gap:10 }},
        e(Social, { brand:'google', label:'Continue with Google', onClick:signIn }),
        e(Social, { brand:'apple', label:'Continue with Apple', onClick:signIn }),
      ),
      e('div', { style:{ textAlign:'center', marginTop:24, font:`500 14px ${F.ui}`, color:C.text2 }},
        "New here? ", e('button', { className:'sw-tap', onClick:()=>nav('signup'), style:{ background:'none', border:'none', color:C.primary, font:`700 14px ${F.ui}`, cursor:'pointer' }}, 'Create account')),
    );
  }

  // ── Signup ──
  function Signup({ nav, signIn }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [pw, setPw] = useState('');
    const [show, setShow] = useState(false);
    const strong = pw.length >= 8;
    return e(AuthShell, { onBack:()=>nav('onboarding') },
      e('h1', { style:{ font:`700 32px ${F.disp}`, color:C.text, letterSpacing:'-.4px', textTransform:'uppercase', margin:'0 0 6px' }}, 'Join the war'),
      e('p', { style:{ font:`400 15px ${F.ui}`, color:C.text2, margin:'0 0 24px' }}, 'Start a streak. Challenge your friends.'),
      e('div', { style:{ display:'flex', flexDirection:'column', gap:16 }},
        e(Field, { label:'Full name', value:name, onChange:setName, icon:'user', placeholder:'Arnar Jónsson' }),
        e(Field, { label:'Email', value:email, onChange:setEmail, icon:'mail', placeholder:'you@example.com' }),
        e(Field, { label:'Password', value:pw, onChange:setPw, icon:'lock', type: show?'text':'password', placeholder:'At least 8 characters',
          right: e('button', { onClick:()=>setShow(!show), className:'sw-tap', style:{ background:'none', border:'none', cursor:'pointer', padding:6 }}, e(Icon, { name: show?'eyeOff':'eye', size:18, color:C.text3 })) }),
      ),
      e('div', { style:{ display:'flex', gap:6, margin:'12px 2px 0' }},
        [0,1,2].map(k=> e('div', { key:k, style:{ flex:1, height:4, borderRadius:2, background: (pw.length> k*3) ? (strong?C.green:C.amber) : C.surface3 }}))),
      e('div', { style:{ font:`500 12px ${F.ui}`, color: strong?C.green:C.text3, marginTop:8 }}, strong?'Strong password':'Use 8+ characters'),
      e(Btn, { full:true, size:'lg', onClick:signIn, style:{ marginTop:20 }}, 'Create account'),
      e('p', { style:{ font:`400 11.5px ${F.ui}`, color:C.text3, textAlign:'center', lineHeight:1.5, margin:'16px 0 0' }},
        'By continuing you agree to our ', e('span',{style:{color:C.text2}},'Terms'), ' & ', e('span',{style:{color:C.text2}},'Privacy Policy'), '.'),
      e('div', { style:{ textAlign:'center', marginTop:18, font:`500 14px ${F.ui}`, color:C.text2 }},
        "Have an account? ", e('button', { className:'sw-tap', onClick:()=>nav('login'), style:{ background:'none', border:'none', color:C.primary, font:`700 14px ${F.ui}`, cursor:'pointer' }}, 'Sign in')),
    );
  }

  // ── Reset password ──
  function Reset({ nav }) {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    return e(AuthShell, { onBack:()=>nav('login') },
      sent
        ? e('div', { style:{ textAlign:'center', paddingTop:20, animation:'sw-rise .3s ease' }},
            e('div', { style:{ width:80, height:80, margin:'0 auto 20px', borderRadius:'50%', background:a(C.green,.14), border:`1.5px solid ${a(C.green,.4)}`, display:'flex', alignItems:'center', justifyContent:'center' }},
              e(Icon, { name:'mail', size:36, color:C.green, stroke:1.8 })),
            e('h1', { style:{ font:`700 28px ${F.disp}`, color:C.text, textTransform:'uppercase', margin:'0 0 10px' }}, 'Check your inbox'),
            e('p', { style:{ font:`400 15px ${F.ui}`, color:C.text2, lineHeight:1.5, maxWidth:280, margin:'0 auto 26px' }},
              'We sent a reset link to ', e('span', { style:{ color:C.text, fontWeight:600 }}, email||'your email'), '. Follow it to set a new password.'),
            e(Btn, { full:true, size:'lg', variant:'outline', onClick:()=>nav('login') }, 'Back to sign in'),
          )
        : e('div', null,
            e('h1', { style:{ font:`700 32px ${F.disp}`, color:C.text, letterSpacing:'-.4px', textTransform:'uppercase', margin:'0 0 6px' }}, 'Reset password'),
            e('p', { style:{ font:`400 15px ${F.ui}`, color:C.text2, margin:'0 0 24px' }}, 'Enter your email and we’ll send a reset link.'),
            e(Field, { label:'Email', value:email, onChange:setEmail, icon:'mail', placeholder:'you@example.com', style:{ marginBottom:20 }}),
            e(Btn, { full:true, size:'lg', onClick:()=>setSent(true), disabled:!email.includes('@') }, 'Send reset link'),
          )
    );
  }

  Object.assign(window, { Onboarding, Login, Signup, Reset });
})();
