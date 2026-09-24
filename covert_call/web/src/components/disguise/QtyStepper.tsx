export function QtyStepper({
  qty,
  onInc,
  onDec,
  size = 'md',
}: {
  qty: number
  onInc: () => void
  onDec: () => void
  size?: 'sm' | 'md'
}) {
  return (
    <div className={`stepper stepper-${size}`} onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={onDec} aria-label="Decrease quantity">
        −
      </button>
      <span aria-live="polite">{qty}</span>
      <button type="button" onClick={onInc} aria-label="Increase quantity">
        +
      </button>
    </div>
  )
}
