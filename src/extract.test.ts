import { describe, expect, it } from 'vitest';
import { extractDocument } from './extract.ts';

describe('extractDocument', () => {
  it('reads a simplified Chinese insurance policy', () => {
    const result = extractDocument(`平安保险单
被保险人：李娜
保费：¥1,280.00
生效日期：2026年1月1日
有效期至：2026年12月31日`);
    expect(result).toMatchObject({
      title: '平安保险单',
      category: 'insurance',
      amount: 1280,
      currency: 'CNY',
      validFrom: '2026-01-01',
      validUntil: '2026-12-31',
    });
  });

  it('reads the same policy again from stored raw text', () => {
    const raw = '平安保险单\n保费：¥1,280.00\n有效期至：2026年12月31日';
    expect(extractDocument(raw)).toEqual(extractDocument(extractDocument(raw).title ? raw : raw));
    expect(extractDocument(raw).validUntil).toBe('2026-12-31');
  });

  it('normalizes traditional characters and fullwidth digits', () => {
    expect(extractDocument('平安保險單\n保費：¥1,280.00\n有效期至：2026年12月31日')).toMatchObject({
      title: '平安保险单',
      category: 'insurance',
      amount: 1280,
      currency: 'CNY',
      validUntil: '2026-12-31',
    });
    expect(extractDocument('水电费账单\n金额合计：２５６．８０元\n截止日期：２０２６年１１月０５日')).toMatchObject({
      category: 'bill',
      amount: 256.8,
      currency: 'CNY',
      validUntil: '2026-11-05',
    });
  });

  it('keeps passport expiry and ignores the birth date', () => {
    const result = extractDocument(`PASSPORT
姓名 Name: LI NA
Date of birth: 02 Jan 1990
Date of expiry: 22 Oct 2030`);
    expect(result.category).toBe('id');
    expect(result.validUntil).toBe('2030-10-22');
    expect(result.validFrom).toBeNull();
    expect(result.amount).toBeNull();
  });

  it('separates a contract issue date from the end date', () => {
    const result = extractDocument(`房屋租赁合同
月租金 RMB 3,500
签发日期: 2024-03-01
到期日: 2027-03-01`);
    expect(result.category).toBe('contract');
    expect(result.amount).toBe(3500);
    expect(result.currency).toBe('CNY');
    expect(result.validFrom).toBe('2024-03-01');
    expect(result.validUntil).toBe('2027-03-01');
  });

  it('reads day/month/year and Hong Kong dollars', () => {
    const result = extractDocument(`Insurance policy
Premium HK$199.50
Expiry: 22/10/2026`);
    expect(result.category).toBe('insurance');
    expect(result.amount).toBe(199.5);
    expect(result.currency).toBe('HKD');
    expect(result.validUntil).toBe('2026-10-22');
  });

  it('treats a second number above 12 as month/day', () => {
    const result = extractDocument(`Invoice
Amount due: $15.99
Due date: 10/22/2026`);
    expect(result.category).toBe('bill');
    expect(result.amount).toBe(15.99);
    expect(result.currency).toBe('USD');
    expect(result.validUntil).toBe('2026-10-22');
  });

  it('defaults ambiguous slash dates to day/month/year', () => {
    const result = extractDocument(`账单
缴费日期 01/02/2027`);
    expect(result.validUntil).toBe('2027-02-01');
    expect(result.category).toBe('bill');
  });

  it('reads English month names and membership fees', () => {
    const result = extractDocument(`Subscription renewal
Membership fee USD 120
Valid until Oct 22, 2026`);
    expect(result.category).toBe('subscription');
    expect(result.amount).toBe(120);
    expect(result.currency).toBe('USD');
    expect(result.validUntil).toBe('2026-10-22');
  });

  it('joins Chinese characters that OCR split with spaces', () => {
    const result = extractDocument('平 安 保 险 单\n有 效 期 至 : 2026 年 12 月 31 日\n保 费 ： ¥1,280.00');
    expect(result.title).toBe('平安保险单');
    expect(result.category).toBe('insurance');
    expect(result.amount).toBe(1280);
    expect(result.validUntil).toBe('2026-12-31');
  });

  it('reads a glued Chinese validity phrase', () => {
    expect(extractDocument('身份证\n有效期至2028年6月1日')).toMatchObject({
      category: 'id',
      validUntil: '2028-06-01',
    });
  });

  it('reads dotted dates on contracts', () => {
    expect(extractDocument('合同\n截止日期 2026.10.22').validUntil).toBe('2026-10-22');
  });

  it('returns no date when the only date is a birthday', () => {
    const result = extractDocument('护照\n出生日期：1990年1月2日');
    expect(result.category).toBe('id');
    expect(result.validUntil).toBeNull();
    expect(result.validFrom).toBeNull();
  });

  it('prefers the premium over the sum insured', () => {
    const result = extractDocument(`保险单
保额 ¥500,000
保费 ¥860.00
有效期至 2027/08/09`);
    expect(result.amount).toBe(860);
    expect(result.currency).toBe('CNY');
    expect(result.validUntil).toBe('2027-08-09');
  });

  it('reads euros and day-month names', () => {
    const result = extractDocument(`Invoice
Total €42.50
Payment due: 31 Dec 2026`);
    expect(result.amount).toBe(42.5);
    expect(result.currency).toBe('EUR');
    expect(result.validUntil).toBe('2026-12-31');
  });

  it('reads yen and a Chinese membership charge date', () => {
    expect(extractDocument('账单\n金额 1500日元\n截止日期 2026年5月3日')).toMatchObject({
      amount: 1500,
      currency: 'JPY',
      validUntil: '2026-05-03',
    });
    expect(extractDocument('视频会员\n年费 258元\n下次扣款 2026年10月22日')).toMatchObject({
      category: 'subscription',
      amount: 258,
      currency: 'CNY',
      validUntil: '2026-10-22',
    });
  });

  it('prefers a labeled total over a reference price', () => {
    const result = extractDocument(`合同
参考价 $10
合计 CNY 88.00
到期日 2026-01-15`);
    expect(result.amount).toBe(88);
    expect(result.currency).toBe('CNY');
    expect(result.validUntil).toBe('2026-01-15');
  });

  it('splits a 自/至 range into from and until', () => {
    const result = extractDocument('服务协议\n服务期限自2024年1月1日至2026年10月22日');
    expect(result.category).toBe('contract');
    expect(result.validFrom).toBe('2024-01-01');
    expect(result.validUntil).toBe('2026-10-22');
  });

  it('reads 22 Oct 2026 and an empty note', () => {
    expect(extractDocument('passport\nexpiry 22 Oct 2026').validUntil).toBe('2026-10-22');
    expect(extractDocument('hello world')).toMatchObject({
      category: 'other',
      amount: null,
      validUntil: null,
      title: 'hello world',
    });
    expect(extractDocument('').validUntil).toBeNull();
  });
});
