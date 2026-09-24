import { computeBill, formatRupees, FREE_DELIVERY_THRESHOLD } from '../../state/cart'

export function BillDetails({ subtotal }: { subtotal: number }) {
  const bill = computeBill(subtotal)
  return (
    <section className="card bill">
      <h2 className="card-title">Bill details</h2>
      <div className="bill-row">
        <span>Item total</span>
        <span>{formatRupees(bill.subtotal)}</span>
      </div>
      <div className="bill-row">
        <span>Delivery fee</span>
        {bill.deliveryFee === 0 ? (
          <span>
            <s className="muted">₹39</s> <b className="free">FREE</b>
          </span>
        ) : (
          <span>{formatRupees(bill.deliveryFee)}</span>
        )}
      </div>
      {bill.deliveryFee > 0 && (
        <p className="bill-hint">Add items worth {formatRupees(FREE_DELIVERY_THRESHOLD - subtotal)} more for free delivery</p>
      )}
      <div className="bill-row">
        <span>Platform fee</span>
        <span>{formatRupees(bill.platformFee)}</span>
      </div>
      <div className="bill-row">
        <span>GST &amp; restaurant charges</span>
        <span>{formatRupees(bill.taxes)}</span>
      </div>
      <div className="bill-row bill-total">
        <span>To pay</span>
        <span>{formatRupees(bill.total)}</span>
      </div>
    </section>
  )
}
