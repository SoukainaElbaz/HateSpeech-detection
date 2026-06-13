/* HateGuard v5 — Pro animated background */
(function(){
  var cv = document.getElementById('bgc');
  if(!cv) return;
  var ctx = cv.getContext('2d');
  var W=0, H=0, pts=[], frame=0, currentTheme='mint';

  var ICONS = ['X','f','in','@','#','&#9829;','◎','&#10022;','&#9135;','&#10022;','&#9703;','&#9671;','&#10022;','&#9670;'];
  var ICON_CHARS = ['X','f','in','@','#','♥','◎','✦','◉','✦','⬟','◇','✦','◆'];

  var PALETTES = {
    mint:   [
      [34,197,94],[16,185,129],[6,182,212],[52,211,153],[20,184,166]
    ],
    dark:   [
      [148,163,184],[99,102,241],[139,92,246],[236,72,153],[59,130,246]
    ],
    light:  [
      [100,116,139],[59,130,246],[16,185,129],[245,158,11],[239,68,68]
    ],
    ocean:  [
      [14,165,233],[6,182,212],[56,189,248],[99,102,241],[34,211,238]
    ],
    sunset: [
      [251,146,60],[244,63,94],[251,191,36],[234,88,12],[249,115,22]
    ],
  };

  window._bgSetTheme = function(t){ currentTheme = t; };

  function rnd(a,b){ return a+Math.random()*(b-a); }

  function resize(){
    W = cv.width  = window.innerWidth;
    H = cv.height = window.innerHeight;
  }

  function mkPt(){
    return {
      x:rnd(0,W), y:rnd(0,H),
      vx:(Math.random()-.5)*.3,
      vy:(Math.random()-.5)*.3,
      r: rnd(2,5),
      phase: Math.random()*Math.PI*2,
      speed: rnd(0.008,0.02),
      icon: ICON_CHARS[Math.floor(Math.random()*ICON_CHARS.length)],
      sz: rnd(10,26),
      ci: Math.floor(Math.random()*5),
    };
  }

  function init(){
    pts=[];
    var n=Math.max(25, Math.floor(W*H/16000));
    for(var i=0;i<n;i++) pts.push(mkPt());
  }

  function col(pal, ci, a){
    var c=pal[ci%pal.length];
    return 'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')';
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    frame++;
    var pal = PALETTES[currentTheme] || PALETTES.mint;

    // 1. Draw connection lines
    for(var i=0;i<pts.length;i++){
      for(var j=i+1;j<pts.length;j++){
        var dx=pts[i].x-pts[j].x, dy=pts[i].y-pts[j].y;
        var d=Math.sqrt(dx*dx+dy*dy);
        if(d<130){
          var a=(1-d/130)*0.12;
          ctx.beginPath();
          ctx.strokeStyle=col(pal,i,a);
          ctx.lineWidth=0.6;
          ctx.moveTo(pts[i].x,pts[i].y);
          ctx.lineTo(pts[j].x,pts[j].y);
          ctx.stroke();
        }
      }
    }

    // 2. Draw particles
    pts.forEach(function(p,i){
      p.x+=p.vx; p.y+=p.vy; p.phase+=p.speed;
      if(p.x<-30)p.x=W+30; if(p.x>W+30)p.x=-30;
      if(p.y<-30)p.y=H+30; if(p.y>H+30)p.y=-30;

      var pulse=1+Math.sin(p.phase)*0.25;
      var alpha=0.18+Math.sin(p.phase+0.8)*0.08;

      // Outer glow
      var grd=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*5*pulse);
      grd.addColorStop(0, col(pal,p.ci,alpha*0.5));
      grd.addColorStop(1, col(pal,p.ci,0));
      ctx.beginPath();
      ctx.fillStyle=grd;
      ctx.arc(p.x,p.y,p.r*5*pulse,0,Math.PI*2);
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.fillStyle=col(pal,p.ci,alpha+0.1);
      ctx.arc(p.x,p.y,p.r*pulse,0,Math.PI*2);
      ctx.fill();

      // Floating social icon (ghost)
      if(i%4===0){
        ctx.font=p.sz+'px system-ui,sans-serif';
        ctx.fillStyle=col(pal,p.ci,0.055);
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        var ox=Math.cos(p.phase)*20, oy=Math.sin(p.phase*0.7)*14;
        ctx.fillText(p.icon, p.x+ox, p.y+oy);
      }
    });

    requestAnimationFrame(draw);
  }

  // Mouse repel
  window.addEventListener('mousemove',function(e){
    pts.forEach(function(p){
      var dx=p.x-e.clientX,dy=p.y-e.clientY,d=Math.sqrt(dx*dx+dy*dy);
      if(d<90&&d>0){
        var f=(90-d)/90*0.5;
        p.vx+=dx/d*f; p.vy+=dy/d*f;
        var spd=Math.sqrt(p.vx*p.vx+p.vy*p.vy);
        if(spd>1.8){p.vx=p.vx/spd*1.8;p.vy=p.vy/spd*1.8;}
      }
    });
  });

  window.addEventListener('resize',function(){resize();init();});
  resize(); init(); draw();
})();
