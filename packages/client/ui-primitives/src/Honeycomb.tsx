/** Honeycomb identity artwork; state belongs to the composing feature. */
import clsx from 'clsx'
import css from './Honeycomb.module.css'

/** Decorative wax-cell brand mark.
 * @param props - Requested edge and optional positioning class.
 * @returns An accessibility-hidden vector mark.
 */
export function HoneycombMark({ size = 40, className }: { size?: number; className?: string | undefined }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={clsx(css.mark, className)}>
      <path className={css.wax} d="M24 3.6 41.67 13.8v20.4L24 44.4 6.33 34.2V13.8Z" />
      <path className={css.ink} d="m24 9.4 12.64 7.3v14.6L24 38.6l-12.64-7.3V16.7Z" />
      <path className={css.honey} d="M11.36 19.2h25.28v12.1L24 38.6l-12.64-7.3Z" />
      <path className={css.cream} d="M11.36 19.2h25.28v2.15H11.36Z" />
    </svg>
  )
}

/** Atmospheric bee and honey cells, accelerated only by real activity.
 * @param props - Whether the owning Session is running.
 * @returns Decorative, reduced-motion-aware mascot.
 */
export function HiveStatus({ active = false }: { active?: boolean }) {
  return (
    <div className={css.mascot} data-active={active || undefined} aria-hidden="true">
      <div className={css.comb}><i /><i /><i /><i /><i /><i /><i /></div>
      <svg className={css.bee} viewBox="0 0 16 12" shapeRendering="crispEdges">
        <g className={css.wing}><path className={css.cream} d="M3 2h2v1H3zM2 3h3v1H2zM11 2h2v1h-2zM11 3h3v1h-3z" /></g>
        <path className={css.wax} d="M7 3h2v6H7zM10 3h2v6h-2z" />
        <path className={css.ink} d="M6 4h1v2H6zM9 3h1v6H9zM12 4h1v4h-1zM13 5h1v2h-1zM8 9h1v1H8zM11 9h1v1h-1z" />
      </svg>
      <span className={css.speck} /><span className={css.speck} /><span className={css.speck} />
    </div>
  )
}
