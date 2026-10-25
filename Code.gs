const SHEET_NAME = 'Orders';
const SLIP_FOLDER_NAME = 'TTT－付款證明';
const SLIP_FOLDER_ID_KEY = 'TTT_SLIP_FOLDER_ID';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    if (!data.orderId) throw new Error('Missing orderId');

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Sheet "Orders" not found');

    let slipUrl = '';
    if (data.slipBase64) {
      slipUrl = saveSlip_(data.slipBase64, data.slipMimeType, data.orderId);
    }

    // One Sheet write only. The slip link is written as a trusted formula,
    // so we do not need appendRow -> getLastRow -> setRichTextValue.
    const slipCell = slipUrl
      ? '=HYPERLINK("' + slipUrl.replace(/"/g, '""') + '","查看付款證明")'
      : '';

    sheet.appendRow([
      safeText_(data.orderId),
      new Date(),
      safeText_(data.customerName),
      safeText_(data.phone),
      safeText_(data.address),
      Number(data.q1 || 0),
      Number(data.q2 || 0),
      Number(data.q3 || 0),
      Number(data.subtotal || 0),
      Number(data.shippingFee || 0),
      safeText_(data.coupon || ''),
      Number(data.discount || 0),
      Number(data.total || 0),
      safeText_(data.paymentMethod),
      slipCell,
      '待確認'
    ]);

    return jsonResponse_({ success: true, orderId: data.orderId });
  } catch (err) {
    console.error(err);
    return jsonResponse_({ success: false, error: String(err.message || err) });
  }
}

function saveSlip_(base64Data, mimeType, orderId) {
  const clean = String(base64Data).replace(/^data:[^;]+;base64,/, '');
  const bytes = Utilities.base64Decode(clean);
  if (bytes.length > 2000000) throw new Error('Payment slip is too large');

  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(mimeType)) throw new Error('Unsupported image type');

  const folder = getSlipFolder_();
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const file = folder.createFile(Utilities.newBlob(bytes, mimeType, `${orderId}.${ext}`));
  return file.getUrl();
}

function getSlipFolder_() {
  const props = PropertiesService.getScriptProperties();
  const cachedId = props.getProperty(SLIP_FOLDER_ID_KEY);
  if (cachedId) {
    try {
      return DriveApp.getFolderById(cachedId);
    } catch (e) {
      props.deleteProperty(SLIP_FOLDER_ID_KEY);
    }
  }

  const folders = DriveApp.getFoldersByName(SLIP_FOLDER_NAME);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(SLIP_FOLDER_NAME);
  props.setProperty(SLIP_FOLDER_ID_KEY, folder.getId());
  return folder;
}

function safeText_(value) {
  let text = String(value ?? '').trim();
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return text;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
