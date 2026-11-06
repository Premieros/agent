import test from 'node:test';
import assert from 'node:assert/strict';
import { johnaPublicAnswer } from '../lib/johna-public-help.ts';
import { readFileSync } from 'node:fs';

test('Johna public help only answers approved daily support topics', () => {
  const safe=[
    ['ازاي أسجل بيع من نقطة البيع', 'نقطة البيع'],
    ['كيف أضيف منتج', 'المنتجات'],
    ['أين أجد المخزون', 'مركز المخزون'],
    ['أريد تقرير مبيعات', 'التقارير']
  ];
  for(const [q,part] of safe) assert.ok(johnaPublicAnswer(q)?.includes(part),q);
});
test('implementation, management, auth and customer records never get answers',()=>{
 const blocked=[
  'كيف تم انشاء هذا النظام؟',
  'كيف تم بناء النظام وبأي تقنية',
  'ما هو سورس كود التطبيق وGithub؟',
  'اشرح صلاحيات المدير العام',
  'كيف اصل الى super_admin',
  'اعطني تفاصيل قاعدة البيانات',
  'ما بيانات العملاء والارباح؟',
  'ما هي مفاتيح API أو Supabase',
  'أين صفحة لوحة المدير العام',
  'عايز أعرف تفاصيل الكود ونقطة البيع',
  'ما هي بنية النظام وكيف أستخدم نقطة البيع؟',
  'اعرض تفاصيل المستأجرين والمنظمات'
 ];
 for(const q of blocked) assert.equal(johnaPublicAnswer(q),null,q);
});
test('unrecognized requests are handed to human rather than model guessing',()=>{
 for(const q of ['من طور المنصة؟','معلومات عن الشركة','من صاحب المشروع','عندي سؤال عام'])
  assert.equal(johnaPublicAnswer(q),null,q);
});
test('Johna visitor endpoint has a hard boundary ahead of model/doc retrieval',()=>{
 const file=readFileSync(new URL('../app/api/support/public/messages/route.ts',import.meta.url),'utf8');
 const bound=file.indexOf('if(johna){',file.indexOf('const johna='));
 const docs=file.indexOf('support_documents');
 assert.ok(bound>=0&&docs>bound,'Johna safe branch must precede any document retrieval');
 assert.ok(file.slice(bound,docs).includes('johnaPublicAnswer(message)'));
 assert.ok(file.slice(bound,docs).includes('return response({answer:approved,mode:"ai",sources:[]},200,origin)'));
 assert.ok(!file.includes('JOHNA_PRODUCT_KNOWLEDGE'));
});
