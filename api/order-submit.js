export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false
    });
  }

  try {
    const body = req.body || {};

    const q1 = cleanQty(body.q1);
    const q2 = cleanQty(body.q2);
    const q3 = cleanQty(body.q3);

    if (q1 + q2 + q3 <= 0) {
      return res.status(400).json({
        success: false,
        error: 'NO_PRODUCT'
      });
    }

    const customerName = cleanText(body.customerName, 100);
    const phone = cleanText(body.phone, 30);
    const address = cleanText(body.address, 300);

    if (!customerName || !phone || !address) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_CUSTOMER_INFO'
      });
    }

    const paymentMethod =
      body.paymentMethod === 'bank'
        ? '銀行轉帳'
        : 'TWQR';

    // -------------------------
    // Calculate price SERVER SIDE
    // -------------------------

    const subtotal =
      q1 * 420 +
      q2 * 1180 +
      q3 * 10;

    const shippingFee = 200;

    // -------------------------
    // Validate coupon SERVER SIDE
    // -------------------------

    const submittedCoupon =
      String(body.coupon || '').trim();

    const configuredCoupon =
      String(process.env.COUPON_CODE || '').trim();

    const couponValid =
      submittedCoupon &&
      configuredCoupon &&
      submittedCoupon.toLowerCase() ===
        configuredCoupon.toLowerCase();

    const discount = couponValid ? 50 : 0;

    const total = Math.max(
      0,
      subtotal + shippingFee - discount
    );

    // -------------------------
    // Slip
    // -------------------------

    const slipBase64 =
      String(body.slipBase64 || '');

    const slipMimeType =
      String(body.slipMimeType || '');

    if (!slipBase64) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_SLIP'
      });
    }

    if (![
      'image/jpeg',
      'image/png',
      'image/webp'
    ].includes(slipMimeType)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_SLIP'
      });
    }

    // -------------------------
    // Order ID
    // -------------------------

    const orderId = createOrderId();

    const payload = {
      orderId,

      customerName,
      phone,
      address,

      q1,
      q2,
      q3,

      subtotal,
      shippingFee,

      // Only save submitted coupon if it was valid
      coupon: couponValid
        ? submittedCoupon
        : '',

      discount,
      total,

      paymentMethod,

      slipBase64,
      slipMimeType
    };

    const scriptUrl =
      process.env.TTT_GOOGLE_SCRIPT_URL;

    if (!scriptUrl) {
      throw new Error(
        'TTT_GOOGLE_SCRIPT_URL is not configured'
      );
    }

    const googleResponse = await fetch(
      scriptUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json'
        },
        body: JSON.stringify(payload),
        redirect: 'follow'
      }
    );

    const text =
      await googleResponse.text();

    let googleData;

    try {
      googleData = JSON.parse(text);
    } catch {
      throw new Error(
        'Invalid response from Google Apps Script'
      );
    }

    if (!googleData.success) {
      throw new Error(
        googleData.error ||
        'Google Sheet sync failed'
      );
    }

    return res.status(200).json({
      success: true,
      orderId,
      subtotal,
      shippingFee,
      discount,
      total
    });

  } catch (error) {
    console.error(
      'TTT order error:',
      error.message
    );

    return res.status(500).json({
      success: false,
      error: 'ORDER_FAILED'
    });
  }
}


function cleanQty(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) return 0;

  return Math.max(
    0,
    Math.min(30, Math.floor(n))
  );
}


function cleanText(value, maxLength) {
  return String(value || '')
    .trim()
    .slice(0, maxLength);
}


function createOrderId() {
  const now = new Date();

  const date =
    now.getUTCFullYear().toString() +
    String(
      now.getUTCMonth() + 1
    ).padStart(2, '0') +
    String(
      now.getUTCDate()
    ).padStart(2, '0');

  const random =
    Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase();

  return `TTT-${date}-${random}`;
}
