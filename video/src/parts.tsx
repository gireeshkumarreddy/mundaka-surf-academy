import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { SANS } from './theme';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Photo with a slow push-in (and optional drift), always filling its box. */
export const KenBurns: React.FC<{ src: string; dur?: number; from?: number; to?: number; x?: number; y?: number; position?: string; style?: React.CSSProperties }> = ({
  src, dur = 150, from = 1.14, to = 1, x = 0, y = 0, position = '50% 50%', style,
}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, dur], [0, 1], clamp);
  const scale = from + (to - from) * t;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', ...style }}>
      <Img
        src={staticFile(src)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: position, transform: `translate(${x * t}px, ${y * t}px) scale(${scale})` }}
      />
    </AbsoluteFill>
  );
};

/** Each word (or letter) rises out of its own mask with a spring, staggered. */
export const Rise: React.FC<{
  text: string; delay?: number; stagger?: number; by?: 'word' | 'letter'; style?: React.CSSProperties; damping?: number;
}> = ({ text, delay = 0, stagger = 3, by = 'word', style, damping = 18 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const parts = by === 'letter' ? [...text] : text.split(' ');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', fontFamily: SANS, ...style }}>
      {parts.map((p, i) => {
        const s = spring({ frame: frame - delay - i * stagger, fps, config: { damping, stiffness: 140 } });
        return (
          // the mask is padded upwards so accents on capitals (LEÓN) are not clipped
          <span key={i} style={{ display: 'inline-block', overflow: 'hidden', padding: '0.16em 0 0.06em', margin: `-0.16em ${by === 'word' ? '0.24em' : 0} 0 0` }}>
            <span style={{ display: 'inline-block', transform: `translateY(${(1 - s) * 110}%)`, opacity: Math.min(1, s * 1.4) }}>{p === ' ' ? ' ' : p}</span>
          </span>
        );
      })}
    </div>
  );
};

/** Uncovers its children from the bottom edge upwards (same move as the website's images). */
export const RevealUp: React.FC<{ delay?: number; duration?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  delay = 0, duration = 22, children, style,
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - delay, [0, duration], [0, 1], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  return (
    <div style={{ clipPath: `inset(${(1 - p) * 100}% 0 0 0)`, transform: `translateY(${(1 - p) * 60}px)`, ...style }}>{children}</div>
  );
};

/** Appears with a spring (scale + fade). */
export const Pop: React.FC<{ delay?: number; children: React.ReactNode; style?: React.CSSProperties; from?: number }> = ({ delay = 0, children, style, from = 0.85 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 160 } });
  return <div style={{ transform: `scale(${from + (1 - from) * s})`, opacity: Math.min(1, s * 1.5), ...style }}>{children}</div>;
};

/** Thin animated underline/bar. */
export const Bar: React.FC<{ delay?: number; color: string; width: number; height?: number; style?: React.CSSProperties }> = ({ delay = 0, color, width, height = 8, style }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - delay, [0, 18], [0, 1], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  return <div style={{ width: width * p, height, borderRadius: height, background: color, ...style }} />;
};
