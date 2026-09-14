'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * One continuous, orchestrated intro: the Zana mark settles into a small
 * lockup, then a single route draws itself across a dark, abstract network,
 * lighting each of Zana's four real surfaces as it arrives — the same
 * "road with stops along it" idea as the customer page, told as a company
 * story instead of a journey. Runs once, then holds still; nothing loops.
 * A visitor who has asked their system for reduced motion sees the final
 * state immediately, with no animation at all.
 */

const NODES = [
  { id: 'rides', label: 'Rides', x: 155, y: 390 },
  { id: 'delivery', label: 'Delivery', x: 460, y: 165 },
  { id: 'shop', label: 'Shop', x: 790, y: 345 },
  { id: 'merchants', label: 'Merchants', x: 1055, y: 120 },
] as const;

// A single flowing path visiting all four nodes in order — hand-placed
// control points rather than a straight connect-the-dots, so it reads as
// a route rather than a wiring diagram.
const ROUTE_PATH =
  'M 155 390 C 260 330, 340 260, 460 165 C 560 90, 650 260, 790 345 C 890 405, 950 230, 1055 120';

// Roughly where along the 0–1 path length each node sits, used to time
// its label reveal against the traveling glow rather than guessing.
const NODE_PROGRESS = [0, 0.36, 0.68, 1];

const STAGE_DELAYS_MS = {
  wordmark: 300,
  tagline: 1300,
  settle: 2600,
  routeStart: 3300,
  routeDurationMs: 4200,
  finalPad: 900,
};

export default function CompanyHero() {
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState<'wordmark' | 'tagline' | 'network' | 'final'>(
    reduceMotion ? 'final' : 'wordmark',
  );
  const [litCount, setLitCount] = useState(reduceMotion ? NODES.length : 0);

  useEffect(() => {
    if (reduceMotion) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setStage('tagline'), STAGE_DELAYS_MS.tagline));
    timers.push(setTimeout(() => setStage('network'), STAGE_DELAYS_MS.settle));

    NODE_PROGRESS.forEach((p, i) => {
      timers.push(
        setTimeout(
          () => setLitCount(i + 1),
          STAGE_DELAYS_MS.routeStart + p * STAGE_DELAYS_MS.routeDurationMs,
        ),
      );
    });

    timers.push(
      setTimeout(
        () => setStage('final'),
        STAGE_DELAYS_MS.routeStart + STAGE_DELAYS_MS.routeDurationMs + STAGE_DELAYS_MS.finalPad,
      ),
    );

    return () => timers.forEach(clearTimeout);
  }, [reduceMotion]);

  const networkVisible = stage === 'network' || stage === 'final';

  return (
    <section className="company-hero">
      <div className="company-hero__glow" aria-hidden="true" />

      <motion.div
        className="company-hero__lockup"
        animate={networkVisible ? 'settled' : 'centered'}
        variants={{
          centered: { top: '50%', left: '50%', x: '-50%', y: '-50%', scale: 1 },
          settled: { top: '8%', left: '50%', x: '-50%', y: '0%', scale: 0.55 },
        }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.p
          className="company-hero__mark"
          initial={{ opacity: 0, letterSpacing: '0.35em' }}
          animate={{ opacity: 1, letterSpacing: '0.06em' }}
          transition={{ duration: 1, ease: 'easeOut' }}
        >
          ZANA
        </motion.p>
        <motion.p
          className="company-hero__tagline"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: stage === 'wordmark' ? 0 : 1, y: stage === 'wordmark' ? 8 : 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        >
          Kigali, in motion.
        </motion.p>
      </motion.div>

      <motion.div
        className="company-hero__network"
        initial={{ opacity: 0 }}
        animate={{ opacity: networkVisible ? 1 : 0 }}
        transition={{ duration: 1 }}
      >
        <svg viewBox="0 0 1200 520" className="company-hero__svg" preserveAspectRatio="xMidYMid meet">
          <path d={ROUTE_PATH} className="company-hero__route-base" />
          <motion.path
            d={ROUTE_PATH}
            className="company-hero__route-line"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: networkVisible ? litCount / NODES.length : 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.7, ease: 'linear' }}
          />
          {NODES.map((node, i) => {
            const lit = i < litCount;
            return (
              <g key={node.id}>
                <motion.circle
                  cx={node.x}
                  cy={node.y}
                  r={lit ? 7 : 4}
                  className={lit ? 'company-hero__node company-hero__node--lit' : 'company-hero__node'}
                  animate={{ r: lit ? 7 : 4 }}
                  transition={{ duration: 0.4 }}
                />
                {/* Position stays a plain, static SVG attribute — mixing
                    it with a Framer Motion–animated y here previously
                    applied as a CSS pixel transform stacked on top of the
                    SVG's own unit system, pushing the label far outside
                    the visible canvas instead of just nudging it. */}
                <motion.text
                  x={node.x}
                  y={node.y - 26}
                  textAnchor="middle"
                  className="company-hero__node-label"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: lit ? 1 : 0 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                >
                  {node.label}
                </motion.text>
              </g>
            );
          })}
        </svg>
      </motion.div>

      <motion.div
        className="company-hero__final"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: stage === 'final' ? 1 : 0, y: stage === 'final' ? 0 : 16 }}
        transition={{ duration: 1, ease: 'easeOut' }}
      >
        <h1>
          One city.
          <br />
          One connected network.
        </h1>
        <div className="company-hero__ctas">
          <a href="/" className="company-hero__cta company-hero__cta--primary">
            Explore Zana
          </a>
          <a href="#investors" className="company-hero__cta company-hero__cta--ghost">
            Investor overview
          </a>
        </div>
      </motion.div>
    </section>
  );
}
