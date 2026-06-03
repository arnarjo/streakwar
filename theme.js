/* StreakWar — Log Workout + celebration */
(function () {
  const { useState, useRef, useEffect } = React;
  const e = React.createElement;

  function Confetti() {
    const cols = [C.primary, C.amber, C.green, C.blue, C.primaryBri, '#fff'];
    const pieces = Array.from({length:30}, (_,i)=>({
      left: Math.random()*100, color: cols[i%cols.length],
      delay: Math.random()*0.5, dur: 1.6+Math.random()*1.2,
      w: 6+Math.random()*7, rot: Math.random()*360, round: Math.random()>0.6,
    }));
    return e('div', { style:{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:1 }},
      pieces.map((p,i)=> e('div', { key:i, style:{
        position:'absolute', top:-20, left:`${p.left}%`, width:p.w, height:p.w*(p.round?1:0.5),
        background:p.color, borderRadius: p.round?'50%':2, transform:`rotate(${p.rot}deg)`,
        animation:`sw-confetti ${p.dur}s ${p.delay}s ease-in forwards`,
      }})));
  }
  window.Confetti = Confetti;

  // Celebration overlay — used on log + milestones
  function Celebration({ streak, milestone, onDone }) {
    return e('div', { style:{
      position:'absolute', inset:0, zIndex:80, background:'rgba(4,7,12,.82)', backdropFilter:'blur(4px)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:30, animation:'sw-fade .25s ease',
    }},
      e(Confetti, null),
      e('div', { style:{ position:'relative', textAlign:'center', animation:'sw-pop .5s cubic-bezier(.2,.9,.2,1)' }},
        e('div', { style:{ position:'relative', width:148, height:148, margin:'0 auto 24px' }},
          [0,1].map(k=> e('div', { key:k, style:{ position:'absolute', inset:0, borderRadius:'50%', border:`2px solid ${a(C.primary,.5)}`, animation:`sw-ring 1.6s ${k*0.5}s ease-out infinite` }})),
          e('div', { style:{ position:'absolute', inset:0, borderRadius:'50%', background:`radial-gradient(circle,${a(C.primary,.3)},${a(C.primary,.06)})`, border:`2px solid ${a(C.primary,.6)}`, display:'flex', alignItems:'center', justifyContent:'center' }},
            e('div', { style:{ animation:'sw-flame 1.8s ease-in-out infinite', transformOrigin:'bottom' }}, e(Icon, { name:'flame', size:74, color:C.primary, stroke:1.7 }))),
        ),
        e('div', { style:{ font:`800 80px ${F.disp}`, color:C.primary, letterSpacing:'-3px', lineHeight:.85, textShadow:`0 6px 30px ${a(C.primary,.6)}` }}, streak),
        e('div', { style:{ font:`700 22px ${F.disp}`, color:C.text, textTransform:'uppercase', letterSpacing:'.5px', marginTop:4 }}, milestone ? `${streak}-day milestone!` : 'Day streak'),
        e('div', { style:{ font:`400 15px ${F.ui}`, color:C.text2, marginTop:8, maxWidth:260 }},
          milestone ? 'Legendary. Your peers just got notified — flex it.' : 'Workout logged. Streak alive. Keep the fire going.'),
        e(Btn, { size:'lg', onClick:onDone, style:{ marginTop:26, minWidth:200 }, icon: milestone?'share':'check' }, milestone?'Share milestone':'Nice'),
      ),
    );
  }
  window.Celebration = Celebration;

  function LogWorkout({ back, params }) {
    const [act, setAct] = useState('run');
    const [mins, setMins] = useState('');
    const [km, setKm] = useState('');
    const [kcal, setKcal] = useState('');
    const [steps, setSteps] = useState('');
    const [caption, setCaption] = useState('');
    const [photo, setPhoto] = useState(false);
    const [ch, setCh] = useState(params?.challengeId || null);
    const [date, setDate] = useState('Today');
    const [run, setRun] = useState(false);
    const [sec, setSec] = useState(0);
    const [celebrate, setCelebrate] = useState(false);
    const tref = useRef(null);
    useEffect(()=>()=>clearInterval(tref.current), []);
    function toggleTimer(){ if(run){ clearInterval(tref.current); setRun(false);} else { tref.current=setInterval(()=>setSec(s=>s+1),1000); setRun(true);} }
    const tdisp = `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
    const active = DB.challenges.filter(c=>c.status==='active');
    const valid = mins||km||kcal||steps||caption.trim();

    return e(React.Fragment, null,
      e('div', { style:{ position:'sticky', top:0, zIndex:10, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:a(C.bg,.9), backdropFilter:'blur(12px)', borderBottom:`1px solid ${C.line2}` }},
        e('button', { className:'sw-tap', onClick:back, style:{ background:'none', border:'none', color:C.text2, font:`600 15px ${F.ui}`, cursor:'pointer', padding:6 }}, 'Cancel'),
        e('div', { style:{ font:`700 18px ${F.disp}`, color:C.text, textTransform:'uppercase', letterSpacing:'.3px', whiteSpace:'nowrap' }}, 'Log workout'),
        e(Btn, { size:'sm', disabled:!valid, onClick:()=>setCelebrate(true) }, 'Save'),
      ),
      e(Screen, { style:{ padding:'18px 16px 40px' }},
        e(SLabel, { style:{ marginBottom:11 }}, 'Activity'),
        e('div', { style:{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:24 }},
          DB.ACT_OPTIONS.map(t=>{
            const on = act===t;
            return e('button', { key:t, className:'sw-tap', onClick:()=>setAct(t), style:{
              display:'flex', alignItems:'center', gap:7, padding:'9px 13px', borderRadius:12, cursor:'pointer', minHeight:42,
              background: on?a(C.primary,.15):C.surface, border:`1.5px solid ${on?a(C.primary,.5):C.line}`,
            }},
              e(Icon, { name:ACT_ICON[t], size:18, color:on?C.primary:C.text2, stroke:2 }),
              e('span', { style:{ font:`600 13.5px ${F.ui}`, color:on?C.text:C.text2 }}, DB.ACT_LABEL[t]));
          })),
        // timer
        e(SLabel, { style:{ marginBottom:11 }}, 'Live timer'),
        e('div', { style:{ background:`linear-gradient(160deg,${C.surface2},${C.surface})`, border:`1px solid ${C.line}`, borderRadius:18, padding:'20px 18px', marginBottom:24, textAlign:'center' }},
          e('div', { style:{ font:`700 56px ${F.disp}`, color: run?C.primary:C.text, letterSpacing:'2px', fontVariantNumeric:'tabular-nums', lineHeight:1 }}, tdisp),
          e('div', { style:{ display:'flex', gap:10, justifyContent:'center', marginTop:16 }},
            e(Btn, { variant: run?'danger':'success', icon: run?'x':'stopwatch', onClick:toggleTimer }, run?'Pause':sec>0?'Resume':'Start'),
            sec>0 && !run && e(Btn, { onClick:()=>{ setMins(String(Math.max(1,Math.round(sec/60)))); setSec(0); }, iconR:'arrowR' }, 'Use time'),
            sec>0 && e(Btn, { variant:'ghost', onClick:()=>{ clearInterval(tref.current); setRun(false); setSec(0); }}, 'Reset'),
          ),
        ),
        // stats
        e(SLabel, { style:{ marginBottom:11 }}, 'Stats'),
        e('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:24 }},
          [['Duration','min',mins,setMins,'stopwatch'],['Distance','km',km,setKm,'ruler'],['Calories','kcal',kcal,setKcal,'flame'],['Steps','',steps,setSteps,'footsteps']].map(([l,u,v,set,ic])=>
            e('div', { key:l, style:{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:14, padding:'11px 13px' }},
              e('div', { style:{ display:'flex', alignItems:'center', gap:6, marginBottom:7 }}, e(Icon,{name:ic,size:14,color:C.text2,stroke:2}), e('span',{style:{font:`600 11.5px ${F.ui}`,color:C.text2}}, l)),
              e('div', { style:{ display:'flex', alignItems:'baseline', gap:5 }},
                e('input', { value:v, onChange:ev=>set(ev.target.value.replace(/[^0-9.]/g,'')), placeholder:'0', inputMode:'decimal', style:{ width:'100%', background:'transparent', border:'none', color:C.text, font:`700 24px ${F.disp}`, padding:0 }}),
                u && e('span', { style:{ font:`600 12px ${F.ui}`, color:C.text3 }}, u)),
            )),
        ),
        // date
        e(SLabel, { style:{ marginBottom:11 }}, 'Date'),
        e(ChipRow, { items:[{key:'Today',label:'Today',icon:'calendar'},{key:'Yesterday',label:'Yesterday'},{key:'pick',label:'Pick date…'}], value:date, onChange:setDate, style:{ marginBottom:24 }}),
        // challenge
        active.length>0 && e('div', null,
          e(SLabel, { style:{ marginBottom:11 }}, 'Attach to challenge'),
          e('div', { style:{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:24 }},
            [{id:null,name:'None'},...active].map(c=>{
              const on = ch===c.id;
              return e('button', { key:c.id||'none', className:'sw-tap', onClick:()=>setCh(c.id), style:{
                padding:'9px 14px', borderRadius:20, cursor:'pointer', maxWidth:200, minHeight:40,
                background:on?a(C.primary,.15):C.surface, border:`1.5px solid ${on?a(C.primary,.5):C.line}`,
                font:`600 13px ${F.ui}`, color:on?C.primary:C.text2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
              }}, c.name);
            })),
        ),
        // photo
        e(SLabel, { style:{ marginBottom:11 }}, 'Photo'),
        photo
          ? e('div', null, e(PhotoSlot, { h:180, label:'your photo' }),
              e('button', { className:'sw-tap', onClick:()=>setPhoto(false), style:{ display:'block', margin:'8px auto 0', background:'none', border:'none', color:C.red, font:`600 13px ${F.ui}`, cursor:'pointer' }}, 'Remove photo'))
          : e('button', { className:'sw-press', onClick:()=>setPhoto(true), style:{ width:'100%', display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'26px', borderRadius:16, background:C.surface, border:`1.5px dashed ${C.line}`, cursor:'pointer' }},
              e(Icon, { name:'camera', size:28, color:C.text3, stroke:1.8 }), e('span', { style:{ font:`600 13.5px ${F.ui}`, color:C.text2 }}, 'Add a photo')),
        e('div', { style:{ marginTop:24 }}, e(SLabel, { style:{ marginBottom:11 }}, 'Caption')),
        e(Field, { value:caption, onChange:setCaption, multiline:true, placeholder:'How did it go?' }),
        e(Btn, { full:true, size:'lg', icon:'flame', disabled:!valid, onClick:()=>setCelebrate(true), style:{ marginTop:24 }}, 'Save workout'),
      ),
      celebrate && e(Celebration, { streak: DB.me.current_streak+1, milestone:false, onDone:back }),
    );
  }

  Object.assign(window, { LogWorkout });
})();
