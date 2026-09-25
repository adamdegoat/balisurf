// The owner's player alert: the game posts here when someone starts playing, and this sends a one-line Telegram
// message. The bot key and chat id live in the Cloudflare project's settings (TG_TOKEN secret, TG_CHAT), never in code.
const SPOTS = ['Pantai Kuda', 'Tanjung Uma', 'Batu Hitam', 'Gunung Laut', 'Watu Kanan', 'Karang Hiu', 'Surf Ranch', 'the villa'];
export async function onRequestPost({ request, env }) {
  if (!env.TG_TOKEN || !env.TG_CHAT) return new Response(null, { status: 204 });
  let b = {}; try { b = await request.json(); } catch (e) {}
  const where = SPOTS.includes(b.where) ? b.where : 'the menu';   // (only known names get through: nobody can send you their own text)
  let country = request.cf && request.cf.country || '';
  try { country = new Intl.DisplayNames(['en'], { type: 'region' }).of(country) || country; } catch (e) {}
  const ua = request.headers.get('user-agent') || '', dev = /iPad|Tablet/i.test(ua) ? 'tablet' : /iPhone|Android|Mobile/i.test(ua) ? 'phone' : 'computer';
  const text = `${b.kind === 'back' ? 'A player is back' : 'New player'} at ${where}${country ? ` (${country}, ${dev})` : ` (${dev})`}`;
  await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: env.TG_CHAT, text, disable_notification: false }) });
  return new Response(null, { status: 204 });
}
