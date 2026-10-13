export const steps = ['المشروع', 'التفاصيل', 'التواصل', 'المراجعة'];
export const normalizeDigits = value => String(value).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776));
export function validPhone(value) { return /^(?:05\d{8}|(?:\+?966)5\d{8})$/.test(normalizeDigits(value).replace(/[\s()-]/g,'')); }
export function validateStep(step,data,allowedServices) {
 const errors={};
 if(step===0){if(!allowedServices.includes(data.service))errors.service='اختر الخدمة المطلوبة.';if(!['فيلا','شقة','مجلس','محل تجاري'].includes(data.property))errors.property='اختر نوع العقار.';if(!data.city?.trim()||data.city.trim().length>80)errors.city='أدخل المدينة، حتى 80 حرفًا.';}
 if(step===1){const area=Number(normalizeDigits(data.area));if(!data.area?.trim()||!Number.isFinite(area)||area<1||area>100000)errors.area='أدخل مساحة بين 1 و100,000 م².';if(!data.description?.trim()||data.description.trim().length<10||data.description.length>2000)errors.description='اكتب وصفًا بين 10 و2,000 حرف.';}
 if(step===2){if(!data.name?.trim()||data.name.trim().length<2||data.name.length>100)errors.name='أدخل اسمًا بين حرفين و100 حرف.';if(!validPhone(data.phone))errors.phone='أدخل رقم جوال سعودي صحيحًا، مثل 05XXXXXXXX.';if(data.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))errors.email='تحقق من البريد الإلكتروني.';if(!data.consent)errors.consent='أكد اطلاعك على آلية مشاركة الطلب.';}
 return errors;
}
export function quoteText(d,files=[]){return ['طلب تسعيرة — '+d.brand,'الخدمة: '+d.service,'نوع العقار: '+d.property,'المدينة: '+d.city,'المساحة التقريبية: '+normalizeDigits(d.area)+' م²','الميزانية: '+(d.budget||'غير محددة'),'الوصف: '+d.description,'الاسم: '+d.name,'الجوال: '+normalizeDigits(d.phone),'البريد: '+(d.email||'غير محدد'),'المرفقات: '+(files.length?files.map(f=>f.name).join('، '):'لا يوجد'),'المصدر: طلب من موقع '+d.brand+' الإلكتروني','ملاحظة: إعداد الطلب لا يعني إرساله أو اعتماد سعر. تُرفق الملفات يدويًا عند الإرسال.'].join('\n');}
export function validateFiles(files){if(files.length>5)return 'الحد الأقصى خمسة ملفات.';if(files.reduce((s,f)=>s+f.size,0)>20*1024*1024)return 'حجم الملفات الإجمالي يجب ألا يتجاوز 20 MB.';if(files.some(f=>!(/\.(jpe?g|png|webp|pdf)$/i.test(f.name)&&['image/jpeg','image/png','image/webp','application/pdf',''].includes(f.type))))return 'الملفات المدعومة: JPG وPNG وWebP وPDF.';return null;}
export function whatsappURL(number,text){if(!/^9665\d{8}$/.test(number||''))return null;return 'https://wa.me/'+number+'?text='+encodeURIComponent(text);}

// Standards-compliant uncompressed ZIP: keeps all processing on the visitor's device.
function crc32(bytes){let crc=-1;for(const byte of bytes){crc^=byte;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^-1)>>>0;}
// MS-DOS date/time fields: zero values are invalid (month/day 0) and show as broken dates in some extractors.
function dosDateTime(d=new Date()){const year=Math.max(1980,d.getFullYear());return {time:(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),date:((year-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate()};}
export async function makeQuoteZip(text,files=[],now=new Date()){
 const enc=new TextEncoder(), chunks=[],central=[];let offset=0;const stamp=dosDateTime(now);
 const entries=[{name:'request.txt',data:enc.encode(text)},...await Promise.all(files.map(async(f,i)=>({name:`attachments/${i+1}-${f.name.replace(/[\\/\x00-\x1f]/g,'_')}`,data:new Uint8Array(await f.arrayBuffer())})))];
 const header=(size)=>{let bytes=new Uint8Array(size);return {bytes,view:new DataView(bytes.buffer)};};
 for(const entry of entries){let name=enc.encode(entry.name),crc=crc32(entry.data),local=header(30);let v=local.view;v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(10,stamp.time,true);v.setUint16(12,stamp.date,true);v.setUint32(14,crc,true);v.setUint32(18,entry.data.length,true);v.setUint32(22,entry.data.length,true);v.setUint16(26,name.length,true);chunks.push(local.bytes,name,entry.data);
 let c=header(46);v=c.view;v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint16(12,stamp.time,true);v.setUint16(14,stamp.date,true);v.setUint32(16,crc,true);v.setUint32(20,entry.data.length,true);v.setUint32(24,entry.data.length,true);v.setUint16(28,name.length,true);v.setUint32(42,offset,true);central.push(c.bytes,name);offset+=30+name.length+entry.data.length;}
 const centralSize=central.reduce((n,c)=>n+c.length,0),end=header(22);end.view.setUint32(0,0x06054b50,true);end.view.setUint16(8,entries.length,true);end.view.setUint16(10,entries.length,true);end.view.setUint32(12,centralSize,true);end.view.setUint32(16,offset,true);return new Blob([...chunks,...central,end.bytes],{type:'application/zip'});
}
