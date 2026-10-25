export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ valid: false });
  }

  const configuredCode = String(process.env.COUPON_CODE || '').trim();
  const submittedCode = String(req.body?.code || '').trim();

  if (!configuredCode || !submittedCode) {
    return res.status(200).json({ valid: false, discount: 0 });
  }

  const valid = submittedCode.toLowerCase() === configuredCode.toLowerCase();
  return res.status(200).json({ valid, discount: valid ? 50 : 0 });
}
