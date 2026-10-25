export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'METHOD_NOT_ALLOWED' });
  try {
    const body = req.body || {};
    const q1 = cleanQty(body.q1), q2 = cleanQty(body.q2), q3 = cleanQty(body.q3);
    if (q1 + q2 + q3 < 1) return res.status(400).json({ success:false, error:'NO_PRODUCT' });
    const customerName = cleanText(body.customerName,100);
    const phone = cleanText(body.phone,30).replace(/[\s-]/g,'');
    const address = cleanText(body.address,300);
    if (!customerName || !/^09\d{8}$/.test(phone) || !address) return res.status(400).json({success:false,error:'INVALID_CUSTOMER_INFO'});
    const subtotal = q1*420 + q2*1180 + q3*10;
    const shippingFee = 200;
    const submittedCoupon = String(body.coupon || '').trim();
    const configuredCoupon = String(process.env.COUPON_CODE || '').trim();
    const couponValid = Boolean(submittedCoupon && configuredCoupon && submittedCoupon.toLowerCase() === configuredCoupon.toLowerCase());
    const discount = couponValid ? 50 : 0;
    const total = Math.max(0, subtotal + shippingFee - discount);
    const paymentMethod = body.paymentMethod === 'bank' ? '銀行轉帳' : 'TWQR';
    const slipBase64 = String(body.slipBase64 || '');
    const slipMimeType = String(body.slipMimeType || '');
    if (!slipBase64 || !['image/jpeg','image/png','image/webp'].includes(slipMimeType)) return res.status(400).json({success:false,error:'INVALID_SLIP'});
    if (slipBase64.length > 2800000) return res.status(413).json({success:false,error:'SLIP_TOO_LARGE'});
    const scriptUrl = process.env.TTT_GOOGLE_SCRIPT_URL;
    if (!scriptUrl) throw new Error('TTT_GOOGLE_SCRIPT_URL_NOT_CONFIGURED');
    const orderId = createOrderId();
    const payload = {orderId,customerName,phone,address,q1,q2,q3,subtotal,shippingFee,coupon:couponValid?submittedCoupon:'',discount,total,paymentMethod,slipBase64,slipMimeType};
    const googleResponse = await fetch(scriptUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'follow'});
    const text = await googleResponse.text();
    let googleData; try { googleData = JSON.parse(text); } catch { throw new Error('INVALID_GOOGLE_RESPONSE'); }
    if (!googleData.success) throw new Error(googleData.error || 'GOOGLE_SYNC_FAILED');
    return res.status(200).json({success:true,orderId,subtotal,shippingFee,discount,total});
  } catch (error) {
    console.error('TTT order error:', error?.message || error);
    return res.status(500).json({success:false,error:'ORDER_FAILED'});
  }
}
function cleanQty(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(30,Math.floor(n))):0;}
function cleanText(v,max){return String(v||'').trim().slice(0,max);}
function createOrderId(){const d=new Date();const date=d.getUTCFullYear()+String(d.getUTCMonth()+1).padStart(2,'0')+String(d.getUTCDate()).padStart(2,'0');const r=Math.random().toString(36).slice(2,8).toUpperCase();return `TTT-${date}-${r}`;}
