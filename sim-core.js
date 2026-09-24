/* 動く物理ノート — シミュレーション共通部品
 * 使い方: PhysSim({ controls, state, init, step, draw, readout, down, move, up, reset, resize })
 * ページ側に #sim(canvas), #controls, #readout, #reset が必要。
 */
(function(){
  "use strict";
  function css(name){ return getComputedStyle(document.body).getPropertyValue(name).trim(); }

  window.PhysSim = function(opt){
    var canvas = document.getElementById('sim');
    var ctx = canvas.getContext('2d');
    var v = { ctx:ctx, W:0, H:0, C:{}, t:0 };

    function readColors(){
      v.C = {
        ink:css('--ink'), soft:css('--ink-soft'), faint:css('--ink-faint'),
        line:css('--line'), grid:css('--grid'), card:css('--paper-card-2'),
        accent:css('--accent'), accent2:css('--accent-2'), paper:css('--paper')
      };
    }
    function fit(){
      var r = canvas.getBoundingClientRect();
      var d = window.devicePixelRatio || 1;
      v.W = r.width; v.H = r.height;
      canvas.width = Math.round(r.width*d); canvas.height = Math.round(r.height*d);
      ctx.setTransform(d,0,0,d,0,0);
    }

    // ---- drawing helpers ----
    v.clear = function(){ ctx.clearRect(0,0,v.W,v.H); };
    v.circle = function(x,y,r,fill,stroke){
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fillStyle = fill; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = stroke || v.C.ink; ctx.stroke();
    };
    v.line = function(x1,y1,x2,y2,color,width,dash){
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width || 1.5;
      ctx.setLineDash(dash || []);
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); ctx.restore();
    };
    v.arrow = function(x1,y1,x2,y2,color,width){
      var len = Math.hypot(x2-x1,y2-y1); if(len < 2) return;
      var a = Math.atan2(y2-y1,x2-x1), h = Math.min(10, len*0.5);
      v.line(x1,y1,x2,y2,color,width||2.2);
      ctx.beginPath(); ctx.moveTo(x2,y2);
      ctx.lineTo(x2-h*Math.cos(a-0.45), y2-h*Math.sin(a-0.45));
      ctx.lineTo(x2-h*Math.cos(a+0.45), y2-h*Math.sin(a+0.45));
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    };
    v.text = function(s,x,y,color,size,align,base){
      ctx.font = (size||12)+'px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillStyle = color || v.C.soft; ctx.textAlign = align || 'left';
      ctx.textBaseline = base || 'alphabetic';
      ctx.fillText(s,x,y);
    };
    v.label = function(s,x,y,color,size,align){
      ctx.font = '500 '+(size||12)+'px "Noto Sans JP", sans-serif';
      ctx.fillStyle = color || v.C.soft; ctx.textAlign = align || 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(s,x,y);
    };

    // ---- controls ----
    var box = document.getElementById('controls');
    (opt.controls||[]).forEach(function(c){
      var wrap = document.createElement('div'); wrap.className = 'ctrl';
      var id = 'c-'+c.key;
      var lab = document.createElement('label'); lab.htmlFor = id;
      var name = document.createElement('span'); name.textContent = c.label;
      var out = document.createElement('output');
      var input = document.createElement('input');
      input.type='range'; input.id=id; input.min=c.min; input.max=c.max; input.step=c.step;
      input.value = opt.state[c.key];
      function show(){ out.textContent = c.fmt ? c.fmt(opt.state[c.key]) : opt.state[c.key]; }
      input.addEventListener('input', function(){
        opt.state[c.key] = parseFloat(input.value); show();
        if(c.onChange) c.onChange(v); else if(opt.onChange) opt.onChange(v, c.key);
      });
      show();
      lab.appendChild(name); lab.appendChild(out);
      wrap.appendChild(lab); wrap.appendChild(input); box.appendChild(wrap);
    });

    // ---- readout ----
    var ro = document.getElementById('readout');
    var roItems = [];
    function updateReadout(){
      if(!opt.readout || !ro) return;
      var rows = opt.readout(v);
      if(roItems.length !== rows.length){
        ro.innerHTML = ''; roItems = [];
        rows.forEach(function(){
          var li = document.createElement('li'); var b = document.createElement('b'); var s = document.createElement('span');
          li.appendChild(b); li.appendChild(s); ro.appendChild(li); roItems.push([b,s]);
        });
      }
      rows.forEach(function(r,i){
        if(roItems[i][0].textContent !== r[0]) roItems[i][0].textContent = r[0];
        if(roItems[i][1].textContent !== r[1]) roItems[i][1].textContent = r[1];
      });
    }

    // ---- pointer ----
    function pos(e){ var r = canvas.getBoundingClientRect(); return {x:e.clientX-r.left, y:e.clientY-r.top}; }
    var active = false;
    canvas.addEventListener('pointerdown', function(e){
      active = true; try{ canvas.setPointerCapture(e.pointerId); }catch(_){}
      opt.down && opt.down(v, pos(e)); e.preventDefault();
    });
    canvas.addEventListener('pointermove', function(e){ if(active && opt.move) opt.move(v, pos(e)); });
    function end(e){ if(!active) return; active = false; opt.up && opt.up(v, pos(e)); }
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    // ---- buttons ----
    var rb = document.getElementById('reset');
    if(rb) rb.addEventListener('click', function(){ v.t = 0; opt.reset && opt.reset(v); });
    v.extraButton = function(id, fn){ var b = document.getElementById(id); if(b) b.addEventListener('click', function(){ fn(v); }); };

    // ---- lifecycle ----
    var ro2 = null;
    window.addEventListener('resize', function(){ fit(); opt.resize && opt.resize(v); });
    if(window.matchMedia){
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if(mq.addEventListener) mq.addEventListener('change', readColors);
    }
    readColors(); fit();
    opt.init && opt.init(v);

    var last = null, acc = 0;
    function loop(ts){
      if(last === null) last = ts;
      var dt = Math.min((ts-last)/1000, 0.05); last = ts;
      // 固定刻みで計算(精度と再現性のため)
      acc += dt; var h = 1/240;
      while(acc >= h){ opt.step && opt.step(v, h); v.t += h; acc -= h; }
      opt.draw && opt.draw(v);
      updateReadout();
      requestAnimationFrame(loop);
    }
    document.addEventListener('visibilitychange', function(){ last = null; acc = 0; });
    requestAnimationFrame(loop);
    return v;
  };
})();
