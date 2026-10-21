/**
 * Mundaka Surf Academy — 30 s Spanish motion-graphics film for the instructor section of the website.
 * Scenes: intro · Mundaka · Xabier · his surf · lessons · trust · call to action.
 * Only facts confirmed by the academy (questionnaire, Instagram, Drive photos) are on screen.
 */
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { Bar, KenBurns, Pop, RevealUp, Rise } from './parts';
import { INK, SANS, SERIF, WHITE, YELLOW } from './theme';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const T = 15; // transition length (frames)
const D = { intro: 100, mundaka: 135, xabier: 170, surf: 175, classes: 190, trust: 105, cta: 110 };
export const PROMO_DURATION = Object.values(D).reduce((a, b) => a + b, 0) - 6 * T;

const Cond: React.CSSProperties = { fontStretch: '74%', fontWeight: 900, textTransform: 'uppercase', lineHeight: 0.86, letterSpacing: '-0.01em' };
const Caps: React.CSSProperties = { fontFamily: SANS, fontWeight: 700, letterSpacing: '0.32em', textTransform: 'uppercase' };

/* 1 · Intro: the logo springs in on its native black, yellow rings ripple out */
const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - 6, fps, config: { damping: 12, stiffness: 120 } });
  return (
    <AbsoluteFill style={{ background: INK, alignItems: 'center', justifyContent: 'center' }}>
      {[0, 1, 2].map((i) => {
        const r = interpolate(frame - i * 12, [0, 60], [0, 1], clamp);
        return (
          <div key={i} style={{ position: 'absolute', width: 1500 * r, height: 1500 * r, borderRadius: '50%', border: `6px solid ${YELLOW}`, opacity: (1 - r) * 0.7 }} />
        );
      })}
      <div style={{ position: 'absolute', top: 150, ...Caps, fontSize: 30, color: WHITE, opacity: interpolate(frame, [20, 40], [0, 1], clamp) }}>Bienvenidos a</div>
      <Img src={staticFile('img/logo.png')} style={{ width: 860, transform: `scale(${0.55 + 0.45 * s}) rotate(${(1 - s) * -6}deg)`, opacity: Math.min(1, s * 1.6) }} />
      <div style={{ position: 'absolute', bottom: 130 }}>
        <Bar delay={40} color={YELLOW} width={320} height={10} />
      </div>
    </AbsoluteFill>
  );
};

/* 2 · Mundaka: the word rises between the sky and the wave — the same trick as the website hero */
const Mundaka: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoom = interpolate(frame, [0, D.mundaka], [1.0, 1.08], clamp);
  const letters = [...'MUNDAKA'];
  return (
    <AbsoluteFill style={{ background: '#cfd7dc' }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: '50% 60%' }}>
        <Img src={staticFile('img/hero-mundaka-2048.webp')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', left: 340, right: 0, top: 210, display: 'flex', justifyContent: 'center', fontFamily: SANS, ...Cond, fontSize: 300, color: YELLOW, textShadow: '0 14px 40px rgba(0,0,0,.35)' }}>
          {letters.map((l, i) => {
            const s = spring({ frame: frame - 8 - i * 4, fps, config: { damping: 16, stiffness: 110 } });
            return <span key={i} style={{ display: 'inline-block', transform: `translateY(${(1 - s) * 110}%)` }}>{l}</span>;
          })}
        </div>
        <Img src={staticFile('img/hero-mundaka-fg-2048.webp')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,.55))' }} />
      <div style={{ position: 'absolute', left: 90, bottom: 80, color: WHITE }}>
        <RevealUp delay={45}><div style={{ ...Caps, fontSize: 26, color: YELLOW }}>Bizkaia · Euskadi</div></RevealUp>
        <Rise text="Una de las olas de izquierda más famosas de Europa" delay={55} stagger={2} style={{ fontSize: 50, fontWeight: 700, fontStretch: '86%', maxWidth: 1100, marginTop: 14 }} />
      </div>
    </AbsoluteFill>
  );
};

/* 3 · Xabier: name on yellow, two of his photos in white frames */
const Xabier: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const frameIn = spring({ frame: frame - 10, fps, config: { damping: 16, stiffness: 120 } });
  const second = spring({ frame: frame - 34, fps, config: { damping: 13, stiffness: 140 } });
  return (
    <AbsoluteFill style={{ background: YELLOW }}>
      <div style={{ position: 'absolute', left: 110, top: 200, color: INK }}>
        <RevealUp delay={4}><div style={{ ...Caps, fontSize: 30 }}>Conoce a tu monitor</div></RevealUp>
        <Rise text="XABIER" by="letter" delay={10} stagger={2} style={{ ...Cond, fontSize: 230, marginTop: 22 }} />
        <Rise text="GONDRA LEÓN" by="letter" delay={20} stagger={2} style={{ ...Cond, fontSize: 150, marginTop: 6 }} />
        <div style={{ marginTop: 34 }}><Bar delay={40} color={INK} width={180} height={10} /></div>
        <Rise text="Surfista y monitor en Mundaka" delay={46} stagger={3} style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 54, marginTop: 30 }} />
      </div>
      <div style={{ position: 'absolute', right: 120, top: 150, width: 640, height: 780, transform: `translateY(${(1 - frameIn) * 120}px) rotate(${(1 - frameIn) * 4}deg)`, opacity: frameIn }}>
        <div style={{ position: 'absolute', inset: 0, background: WHITE, padding: 16, boxShadow: '0 40px 80px -30px rgba(0,0,0,.45)' }}>
          <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
            <KenBurns src="img/xabier-trim-1600.webp" dur={D.xabier} from={1.25} to={1.08} position="45% 55%" />
          </div>
        </div>
        <div style={{ position: 'absolute', left: -190, bottom: -50, width: 420, height: 300, background: WHITE, padding: 12, boxShadow: '0 30px 60px -24px rgba(0,0,0,.5)', transform: `translateY(${(1 - second) * 140}px) rotate(${-5 + (1 - second) * -6}deg)`, opacity: Math.min(1, second * 1.5) }}>
          <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
            <KenBurns src="img/xabier-layback-1600.webp" dur={D.xabier} from={1.3} to={1.1} position="45% 40%" />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* 4 · His surf: quick bottom-to-top cuts of Xabier's photos */
const SHOTS = [
  { src: 'img/mundaka-santa-catalina-2400.webp', pos: '55% 60%' },
  { src: 'img/xabier-barrel-1600.webp', pos: '60% 50%' },
  { src: 'img/xabier-snap-1600.webp', pos: '55% 45%' },
  { src: 'img/xabier-bottom-turn-1600.webp', pos: '60% 50%' },
  { src: 'img/xabier-dark-barrel-1600.webp', pos: '60% 50%' },
];
const Surf: React.FC = () => {
  const frame = useCurrentFrame();
  const each = 35;
  return (
    <AbsoluteFill style={{ background: INK }}>
      {SHOTS.map((shot, i) => (
        <Sequence key={shot.src} from={i * each} durationInFrames={each + 12} layout="none">
          <AbsoluteFill>
            <RevealUp duration={14} style={{ position: 'absolute', inset: 0 }}>
              <div style={{ position: 'absolute', inset: 0 }}>
                <KenBurns src={shot.src} dur={each + 12} from={1.18} to={1.04} position={shot.pos} />
              </div>
            </RevealUp>
          </AbsoluteFill>
        </Sequence>
      ))}
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(0,0,0,.55), rgba(0,0,0,0) 55%)' }} />
      <div style={{ position: 'absolute', left: 100, bottom: 110, color: WHITE }}>
        <Rise text="SU SURF," by="letter" delay={6} stagger={2} style={{ ...Cond, fontSize: 190, color: YELLOW }} />
        <Rise text="su ola" delay={20} stagger={4} style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 110, marginTop: -6 }} />
        <RevealUp delay={34}><div style={{ ...Caps, fontSize: 26, marginTop: 24 }}>Mundaka · tubos · paredes · técnica</div></RevealUp>
      </div>
      <div style={{ position: 'absolute', right: 70, bottom: 70, ...Caps, fontSize: 24, color: INK, background: YELLOW, padding: '12px 22px', borderRadius: 999, letterSpacing: '0.18em' }}>
        {String(Math.min(SHOTS.length, Math.floor(frame / each) + 1)).padStart(2, '0')} / {String(SHOTS.length).padStart(2, '0')}
      </div>
    </AbsoluteFill>
  );
};

/* 5 · Lessons for everyone */
const CARDS = [
  { src: 'img/stock-private-1400.webp', label: 'Privadas', pos: '50% 30%' },
  { src: 'img/stock-group-1400.webp', label: 'En grupo', pos: '50% 50%' },
  { src: 'img/stock-kids-1400.webp', label: 'Infantiles', pos: '40% 50%' },
  { src: 'img/stock-courses-1600.webp', label: 'Campamentos y cursos', pos: '50% 50%' },
  { src: 'img/stock-adaptive-1400.webp', label: 'Surf adaptado', pos: '50% 60%' },
];
const Classes: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: WHITE, padding: '110px 100px' }}>
      <div style={{ color: INK }}>
        <RevealUp><div style={{ ...Caps, fontSize: 26, color: '#4a4a48' }}>Mundaka Surf Academy</div></RevealUp>
        <div style={{ position: 'relative', display: 'inline-block', marginTop: 16 }}>
          <div style={{ position: 'absolute', left: -10, right: -10, bottom: 14, height: 46, background: YELLOW, transformOrigin: 'left', transform: `scaleX(${interpolate(frame, [10, 30], [0, 1], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) })})` }} />
          <Rise text="CLASES PARA TODOS" delay={4} stagger={3} style={{ ...Cond, fontSize: 150, position: 'relative' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 28, marginTop: 60, height: 520 }}>
        {CARDS.map((c, i) => {
          const s = spring({ frame: frame - 26 - i * 7, fps, config: { damping: 15, stiffness: 130 } });
          return (
            <div key={c.label} style={{ position: 'relative', flex: 1, borderRadius: 26, overflow: 'hidden', transform: `translateY(${(1 - s) * 160}px)`, opacity: Math.min(1, s * 1.4), boxShadow: '0 30px 60px -30px rgba(0,0,0,.5)' }}>
              <KenBurns src={c.src} dur={D.classes} from={1.15} to={1.02} position={c.pos} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,.6))' }} />
              <div style={{ position: 'absolute', left: 22, right: 22, bottom: 22, padding: '14px 18px', borderRadius: 999, background: i % 2 ? WHITE : YELLOW, color: INK, fontFamily: SANS, fontWeight: 800, fontSize: 30, fontStretch: '86%', textAlign: 'center' }}>{c.label}</div>
            </div>
          );
        })}
      </div>
      <RevealUp delay={70}>
        <div style={{ ...Caps, fontSize: 30, color: INK, marginTop: 44, textAlign: 'center', letterSpacing: '0.24em' }}>Principiante · Intermedio · Avanzado</div>
      </RevealUp>
    </AbsoluteFill>
  );
};

/* 6 · Trust: what the visitor can count on (all confirmed by the academy) */
const POINTS = ['Horario mensual de marzo a septiembre', 'Reserva online, sin crear cuenta', 'Confirmamos disponibilidad antes de cobrar', 'Clases para cada nivel'];
const Trust: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const photo = spring({ frame: frame - 4, fps, config: { damping: 16, stiffness: 110 } });
  return (
    <AbsoluteFill style={{ background: YELLOW, padding: '110px 120px', color: INK }}>
      <div style={{ position: 'absolute', right: 120, top: 110, bottom: 110, width: 620, background: WHITE, padding: 16, boxShadow: '0 40px 80px -30px rgba(0,0,0,.45)', transform: `translateY(${(1 - photo) * 140}px)`, opacity: Math.min(1, photo * 1.5) }}>
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
          <KenBurns src="img/xabier-carve-1600.webp" dur={D.trust} from={1.35} to={1.18} position="50% 50%" />
        </div>
      </div>
      <Rise text="RESERVA CON" by="letter" delay={2} stagger={2} style={{ ...Cond, fontSize: 150 }} />
      <Rise text="tranquilidad" delay={12} style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 120, marginTop: -4 }} />
      <div style={{ display: 'grid', gap: 30, marginTop: 56 }}>
        {POINTS.map((p, i) => {
          const s = spring({ frame: frame - 22 - i * 8, fps, config: { damping: 14, stiffness: 150 } });
          return (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 22, opacity: Math.min(1, s * 1.4), transform: `translateX(${(1 - s) * -60}px)` }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: INK, display: 'grid', placeItems: 'center', flex: 'none', transform: `scale(${s})` }}>
                <svg width="34" height="34" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke={YELLOW} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="24" strokeDashoffset={24 * (1 - s)} /></svg>
              </div>
              <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 40, fontStretch: '90%', lineHeight: 1.15 }}>{p}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* 7 · Call to action: a bright Mundaka photo with the logo card rising over it */
const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = spring({ frame: frame - 2, fps, config: { damping: 16, stiffness: 120 } });
  const pill = spring({ frame: frame - 34, fps, config: { damping: 12, stiffness: 140 } });
  return (
    <AbsoluteFill style={{ background: WHITE }}>
      <KenBurns src="img/mundaka-santa-catalina-2400.webp" dur={D.cta} from={1.14} to={1.02} position="50% 55%" />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ width: 1180, padding: '60px 70px 56px', background: INK, boxShadow: '0 50px 100px -40px rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `translateY(${(1 - card) * 220}px)`, opacity: Math.min(1, card * 1.5) }}>
          <Pop delay={8}><Img src={staticFile('img/logo.png')} style={{ width: 340 }} /></Pop>
          <Rise text="RESERVA TU CLASE" delay={16} stagger={4} style={{ ...Cond, fontSize: 132, color: YELLOW, justifyContent: 'center', flexWrap: 'nowrap', marginTop: 22, marginRight: '-0.24em' }} />
          <div style={{ marginTop: 30, transform: `scale(${0.7 + 0.3 * pill})`, opacity: Math.min(1, pill * 1.5), display: 'inline-flex', alignItems: 'center', gap: 18, padding: '22px 46px', borderRadius: 999, background: YELLOW, color: INK, fontFamily: SANS, fontWeight: 800, fontSize: 34, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Reserva en nuestra web
            <svg width="34" height="34" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div style={{ ...Caps, fontSize: 24, color: WHITE, marginTop: 30, opacity: interpolate(frame, [50, 66], [0, 1], clamp) }}>Instagram · @xabigondra</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Promo: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={D.intro}><Intro /></TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: 'from-bottom' })} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence durationInFrames={D.mundaka}><Mundaka /></TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence durationInFrames={D.xabier}><Xabier /></TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: 'from-left' })} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence durationInFrames={D.surf}><Surf /></TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: 'from-bottom' })} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence durationInFrames={D.classes}><Classes /></TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: 'from-top' })} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence durationInFrames={D.trust}><Trust /></TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence durationInFrames={D.cta}><Cta /></TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
