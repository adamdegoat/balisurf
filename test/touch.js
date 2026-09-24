// Real touch events for play-testing the controls (what a phone sends), incl. two fingers at once.
let id = 10;
const mk = (el, t) => new Touch({ identifier: t.id, target: el, clientX: t.x, clientY: t.y });
function fire(el, type, touches, changed) {
  el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: touches.map((t) => mk(el, t)), targetTouches: touches.filter((t) => t.el === el).map((t) => mk(el, t)), changedTouches: changed.map((t) => mk(el, t)) }));
}
const live = [];
export function down(el, x, y) { const t = { id: id++, el, x, y }; live.push(t); fire(el, 'touchstart', live, [t]); return t; }
export function move(t, x, y) { t.x = x; t.y = y; fire(t.el, 'touchmove', live, [t]); }
export function up(t) { live.splice(live.indexOf(t), 1); fire(t.el, 'touchend', live, [t]); }
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// play one wave like a person: wait for the moment, hold PADDLE with a finger, then hand over to `ride` (async, gets the game)
export async function playWave(ride, stopWhen) {
  const g = window.__g, pad = document.getElementById('pad'), pb = document.getElementById('paddle');
  let n = 0; while (g.rider.state !== 'WAIT' && n++ < 200) await wait(50);
  n = 0; while (g.rider.zRel > g.rider.wave.cond.speed * 2.4 && n++ < 400) await wait(40);
  const f = down(pb, 70, 300);
  n = 0; while ((g.rider.state === 'WAIT' || g.rider.state === 'PADDLE') && n++ < 250) await wait(30);
  up(f);
  if (ride) await ride(g, pad, pb);
  if (stopWhen) { n = 0; while (!stopWhen(g.rider) && n++ < 1500) await wait(30); }
  return g.rider.state + ' ' + g.rider.why;
}
