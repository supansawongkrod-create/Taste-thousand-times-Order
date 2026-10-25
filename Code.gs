const SHEET_NAME = 'Orders';
const SLIP_FOLDER_NAME = 'TTT－付款證明';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    if (!data.orderId) throw new Error('Missing orderId');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Sheet "Orders" not found');

    if (sheet.getLastRow() > 1) {
      const ids = sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues().flat();
      if (ids.includes(data.orderId)) return jsonResponse({success:true,duplicate:true,orderId:data.orderId});
    }

    let slipUrl = '';
    if (data.slipBase64) slipUrl = saveSlip(data.slipBase64,data.slipMimeType,data.orderId);

    sheet.appendRow([
      safeText(data.orderId), new Date(), safeText(data.customerName), safeText(data.phone), safeText(data.address),
      Number(data.q1||0), Number(data.q2||0), Number(data.q3||0), Number(data.subtotal||0), Number(data.shippingFee||0),
      safeText(data.coupon||''), Number(data.discount||0), Number(data.total||0), safeText(data.paymentMethod), slipUrl, '待確認'
    ]);
    const row=sheet.getLastRow();
    if (slipUrl) sheet.getRange(row,15).setRichTextValue(SpreadsheetApp.newRichTextValue().setText('查看付款證明').setLinkUrl(slipUrl).build());
    return jsonResponse({success:true,orderId:data.orderId});
  } catch(err) {
    console.error(err);
    return jsonResponse({success:false,error:String(err.message||err)});
  }
}

function saveSlip(base64Data,mimeType,orderId) {
  const clean=String(base64Data).replace(/^data:[^;]+;base64,/, '');
  const bytes=Utilities.base64Decode(clean);
  if(bytes.length>2000000) throw new Error('Payment slip is too large');
  const allowed=['image/jpeg','image/png','image/webp'];
  if(!allowed.includes(mimeType)) throw new Error('Unsupported image type');
  const folders=DriveApp.getFoldersByName(SLIP_FOLDER_NAME);
  const folder=folders.hasNext()?folders.next():DriveApp.createFolder(SLIP_FOLDER_NAME);
  const ext=mimeType==='image/png'?'png':mimeType==='image/webp'?'webp':'jpg';
  return folder.createFile(Utilities.newBlob(bytes,mimeType,`${orderId}.${ext}`)).getUrl();
}

function safeText(value){let text=String(value??'').trim();if(/^[=+\-@]/.test(text))text="'"+text;return text;}
function jsonResponse(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
