'use client';
// app/components/MultiStepForm.tsx
//
// A fluid, headless multi-step form wrapper for the CFO console.
//
// HEADLESS STRATEGY
//   All wizard behaviour (step index, next/back, forward-gating via per-step
//   validate(), progress, completion) lives in a React context exposed through
//   `useMultiStepForm()`. The presentation is a set of *optional* compound
//   subcomponents (<MultiStepForm.Progress/Panels/Panel/Nav>) that consume that
//   context. Consumers can use the styled parts as-is, mix them, or ignore them
//   entirely and drive their own UI straight off the hook.
//
// DESIGN TOKENS
//   Styling is styled-jsx (matching BriefingComposer et al.) and reads ONLY the
//   global :root tokens from app/globals.css — --navy(-2), --teal(-2), --border,
//   --sub, --muted, --band-* and the shadow/sheen vars — each with a hex
//   fallback so the component is safe outside a token scope. No new colours.
//
// FLUID + REM
//   Every dimension is expressed in rem (and clamp() for fluid spacing/type), and
//   ALL breakpoints are rem-based media queries. Because rem tracks the root font
//   size, the layout — and the points at which it reflows — scale together when a
//   user zooms or bumps their base font, so the breakpoints can't be "escaped"
//   the way px breakpoints are.
//
// USAGE
//   const steps = [
//     { id: 'entity',  title: 'Business',   validate: () => !!name },
//     { id: 'figures', title: 'Financials', validate: () => turnover > 0 },
//     { id: 'review',  title: 'Review' },
//   ];
//   <MultiStepForm.Root steps={steps} onComplete={submit}>
//     <MultiStepForm.Progress />
//     <MultiStepForm.Panels>
//       <MultiStepForm.Panel stepId="entity"> …fields… </MultiStepForm.Panel>
//       <MultiStepForm.Panel stepId="figures"> …fields… </MultiStepForm.Panel>
//       <MultiStepForm.Panel stepId="review"> …summary… </MultiStepForm.Panel>
//     </MultiStepForm.Panels>
//     <MultiStepForm.Nav submitLabel="Save & recompute" />
//   </MultiStepForm.Root>

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

export interface Step {
  /** Stable key — matched by <Panel stepId>. */
  id: string;
  /** Short label shown in the progress rail. */
  title: string;
  /** Optional steps render a subtle "Optional" hint and never block Continue. */
  optional?: boolean;
  /**
   * Forward gate. Return false to keep the user on this step (Continue disables).
   * Called during render, so keep it pure/derived from state you already hold.
   */
  validate?: () => boolean;
}

export interface MultiStepFormContextValue {
  steps: Step[];
  index: number;
  step: Step;
  isFirst: boolean;
  isLast: boolean;
  /** 0…1 across the rail (0 on step 1, 1 on the last step / when complete). */
  progress: number;
  /** step.validate?.() ?? true — whether Continue is allowed right now. */
  canAdvance: boolean;
  /** 'active' while stepping, 'complete' once the last step is confirmed. */
  status: 'active' | 'complete';
  /** aria/id prefix, unique per Root instance. */
  baseId: string;
  next: () => void;
  back: () => void;
  /** Jump to a step index (clamped). Forward gating is the caller's choice. */
  goTo: (i: number) => void;
}

const Ctx = createContext<MultiStepFormContextValue | null>(null);

/** Headless access to the wizard state. Throws outside <MultiStepForm.Root>. */
export function useMultiStepForm(): MultiStepFormContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMultiStepForm must be used within <MultiStepForm.Root>.');
  return ctx;
}

interface RootProps {
  steps: Step[];
  /** Uncontrolled starting step (default 0). */
  initialStep?: number;
  /** Fired when the last step is confirmed (Continue on isLast). */
  onComplete?: () => void;
  /** Fired on every step change with the new index + step. */
  onStepChange?: (index: number, step: Step) => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

function Root({
  steps,
  initialStep = 0,
  onComplete,
  onStepChange,
  children,
  className,
  style,
}: RootProps) {
  const baseId = useId();
  const clampIndex = useCallback(
    (i: number) => Math.max(0, Math.min(steps.length - 1, i)),
    [steps.length],
  );

  const [index, setIndex] = useState(() => clampIndex(initialStep));
  const [status, setStatus] = useState<'active' | 'complete'>('active');

  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;
  const canAdvance = step?.validate ? !!step.validate() : true;
  const progress =
    status === 'complete' || steps.length <= 1 ? 1 : index / (steps.length - 1);

  const goTo = useCallback(
    (i: number) => {
      const to = clampIndex(i);
      setStatus('active');
      setIndex((cur) => {
        if (to !== cur) onStepChange?.(to, steps[to]);
        return to;
      });
    },
    [clampIndex, onStepChange, steps],
  );

  const next = useCallback(() => {
    if (!canAdvance) return;
    if (isLast) {
      setStatus('complete');
      onComplete?.();
    } else {
      goTo(index + 1);
    }
  }, [canAdvance, isLast, index, goTo, onComplete]);

  const back = useCallback(() => {
    if (!isFirst) goTo(index - 1);
  }, [isFirst, index, goTo]);

  const value = useMemo<MultiStepFormContextValue>(
    () => ({ steps, index, step, isFirst, isLast, progress, canAdvance, status, baseId, next, back, goTo }),
    [steps, index, step, isFirst, isLast, progress, canAdvance, status, baseId, next, back, goTo],
  );

  return (
    <Ctx.Provider value={value}>
      <section className={`msf${className ? ` ${className}` : ''}`} style={style} data-status={status}>
        {children}
        <style jsx>{`
          .msf {
            /* Fluid: fill the parent up to a comfortable form measure. */
            width: 100%;
            max-width: 46rem;
            margin-inline: auto;
            display: flex;
            flex-direction: column;
            gap: clamp(1rem, 0.5rem + 1.6vw, 1.75rem);
            font-family: var(--font-sans), system-ui, sans-serif;
            color: var(--foreground, #0f172a);
          }
        `}</style>
      </section>
    </Ctx.Provider>
  );
}

/**
 * Fluid stepper rail. Completed steps show a check and are clickable (go back);
 * upcoming steps are disabled. Labels collapse away on narrow viewports so the
 * dots + connectors always fit.
 */
function Progress({ className }: { className?: string }) {
  const { steps, index, progress, baseId, goTo } = useMultiStepForm();

  return (
    <ol className={`rail${className ? ` ${className}` : ''}`} aria-label="Progress">
      <div className="track" aria-hidden="true">
        <div className="track-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>

      {steps.map((s, i) => {
        const state = i < index ? 'done' : i === index ? 'current' : 'todo';
        return (
          <li key={s.id} className="node" data-state={state}>
            <button
              type="button"
              className="dot"
              id={`${baseId}-step-${i}`}
              onClick={() => goTo(i)}
              disabled={i >= index}
              aria-current={i === index ? 'step' : undefined}
              aria-label={`Step ${i + 1}: ${s.title}`}
            >
              {i < index ? '✓' : i + 1}
            </button>
            <span className="label">
              {s.title}
              {s.optional && <em className="opt">Optional</em>}
            </span>
          </li>
        );
      })}

      <style jsx>{`
        .rail {
          position: relative;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.5rem;
          margin: 0;
          padding: 0.25rem 0.25rem 0;
          list-style: none;
        }
        /* Connector track sits behind the dots, aligned to their vertical centre. */
        .track {
          position: absolute;
          top: calc(0.25rem + 1.125rem);
          left: 1.5rem;
          right: 1.5rem;
          height: 0.1875rem;
          border-radius: 999px;
          background: var(--border, #e2eaf4);
          overflow: hidden;
        }
        .track-fill {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, var(--teal-2, #14b8a6), var(--teal, #0f766e));
          transition: width 0.3s ease;
        }
        .node {
          position: relative;
          z-index: 1;
          flex: 1 1 0;
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.4rem;
          text-align: center;
        }
        .dot {
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 999px;
          border: 0.125rem solid var(--border, #e2eaf4);
          background: #fff;
          color: var(--muted, #94a3b8);
          font-size: 0.8125rem;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          display: grid;
          place-items: center;
          cursor: default;
          transition: border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }
        .node[data-state='done'] .dot {
          border-color: var(--teal, #0f766e);
          background: linear-gradient(180deg, var(--teal-2, #14b8a6), var(--teal, #0f766e));
          color: #fff;
          cursor: pointer;
        }
        .node[data-state='current'] .dot {
          border-color: var(--teal-2, #14b8a6);
          color: var(--navy, #0b2e4f);
          box-shadow: 0 0 0 0.25rem rgba(20, 184, 166, 0.18);
        }
        .label {
          font-size: 0.75rem;
          font-weight: 700;
          line-height: 1.25;
          color: var(--muted, #94a3b8);
          max-width: 8rem;
        }
        .node[data-state='current'] .label {
          color: var(--navy, #0b2e4f);
        }
        .node[data-state='done'] .label {
          color: var(--sub, #475569);
        }
        .opt {
          display: block;
          font-style: normal;
          font-size: 0.625rem;
          font-weight: 600;
          color: var(--muted, #94a3b8);
        }
        /* Below 34rem the labels would crowd — drop them to keep the dots aligned. */
        @media (max-width: 34rem) {
          .label {
            display: none;
          }
          .dot {
            width: 2rem;
            height: 2rem;
          }
          .track {
            top: calc(0.25rem + 1rem);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .track-fill,
          .dot {
            transition: none;
          }
        }
      `}</style>
    </ol>
  );
}

/**
 * Animated region that renders only the active <Panel>. The inner wrapper is
 * keyed on the step index so the entrance animation replays on each transition.
 */
function Panels({ children, className }: { children: ReactNode; className?: string }) {
  const { index, baseId } = useMultiStepForm();
  return (
    <div className={`panels${className ? ` ${className}` : ''}`}>
      <div
        key={index}
        className="panel-anim"
        role="group"
        aria-labelledby={`${baseId}-step-${index}`}
      >
        {children}
      </div>
      <style jsx>{`
        .panels {
          position: relative;
          background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
          border: 0.0625rem solid var(--border, #e2eaf4);
          border-radius: 1rem;
          box-shadow: var(--shadow-card, 0 1px 2px rgba(15, 23, 42, 0.04)), var(--sheen, inset 0 1px 0 rgba(255, 255, 255, 0.75));
          padding: clamp(1rem, 0.6rem + 1.6vw, 1.75rem);
        }
        .panel-anim {
          animation: msfRise 0.32s ease both;
        }
        @keyframes msfRise {
          from {
            opacity: 0;
            transform: translateY(0.5rem);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .panel-anim {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

/** Renders its children only when its step is the active one. */
function Panel({ stepId, children }: { stepId: string; children: ReactNode }) {
  const { step } = useMultiStepForm();
  if (step.id !== stepId) return null;
  return <>{children}</>;
}

/**
 * Back / Continue bar. Continue is disabled until the current step's validate()
 * passes; on the last step it becomes the submit button (teal), otherwise navy.
 */
function Nav({ submitLabel = 'Submit', backLabel = 'Back', nextLabel = 'Continue', className }: {
  submitLabel?: string;
  backLabel?: string;
  nextLabel?: string;
  className?: string;
}) {
  const { back, next, isFirst, isLast, canAdvance, index, steps } = useMultiStepForm();

  return (
    <div className={`nav${className ? ` ${className}` : ''}`}>
      <button type="button" className="btn ghost" onClick={back} disabled={isFirst}>
        {backLabel}
      </button>
      <span className="count num">
        Step {index + 1} of {steps.length}
      </span>
      <button
        type="button"
        className={`btn ${isLast ? 'submit' : 'next'}`}
        onClick={next}
        disabled={!canAdvance}
      >
        {isLast ? submitLabel : nextLabel}
      </button>

      <style jsx>{`
        .nav {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .count {
          margin-inline: auto;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--muted, #94a3b8);
        }
        .btn {
          border: 0;
          border-radius: 0.75rem;
          padding: 0.75rem 1.5rem;
          font-size: 0.875rem;
          font-weight: 800;
          color: #fff;
          cursor: pointer;
          transition: transform 0.15s ease, filter 0.15s ease, box-shadow 0.15s ease;
        }
        .btn:active:not(:disabled) {
          transform: translateY(0.0625rem);
        }
        .btn.next {
          background: linear-gradient(180deg, var(--navy-2, #103f6b) 0%, var(--navy, #0b2e4f) 100%);
          box-shadow: 0 0.5rem 1.125rem -0.5rem rgba(11, 46, 79, 0.55), inset 0 0.0625rem 0 rgba(255, 255, 255, 0.18);
        }
        .btn.submit {
          background: linear-gradient(180deg, var(--teal-2, #14b8a6) 0%, var(--teal, #0f766e) 100%);
          box-shadow: 0 0.5rem 1.125rem -0.5rem rgba(15, 118, 110, 0.6), inset 0 0.0625rem 0 rgba(255, 255, 255, 0.28);
        }
        .btn.next:hover:not(:disabled),
        .btn.submit:hover:not(:disabled) {
          transform: translateY(-0.0625rem);
          filter: brightness(1.06);
        }
        .btn.ghost {
          background: #fff;
          color: var(--sub, #475569);
          border: 0.0625rem solid var(--border, #e2eaf4);
        }
        .btn.ghost:hover:not(:disabled) {
          filter: brightness(0.98);
        }
        .btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          box-shadow: none;
        }
        /* On very narrow screens stack the count above full-width buttons. */
        @media (max-width: 30rem) {
          .count {
            order: -1;
            flex-basis: 100%;
            text-align: center;
            margin: 0 0 0.25rem;
          }
          .btn {
            flex: 1 1 0;
          }
        }
      `}</style>
    </div>
  );
}

/** Compound export — pair the headless hook with the styled parts. */
export const MultiStepForm = { Root, Progress, Panels, Panel, Nav };

export default MultiStepForm;
