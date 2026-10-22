import { describe, expect, it } from 'vitest';
import { maskCardNumbers, parseSms } from './sms.ts';

const TODAY = '2026-10-22';

describe('maskCardNumbers', () => {
  it('keeps the last four digits of a 16-digit card and leaves a phone number', () => {
    const masked = maskCardNumbers('卡号6222021234567890 电话13800138000');
    expect(masked).not.toContain('6222021234567890');
    expect(masked).toContain('************7890');
    expect(masked).toContain('13800138000');
  });

  it('masks a card written in groups of four', () => {
    const masked = maskCardNumbers('卡号 6222 0212 3456 4321');
    expect(masked).not.toContain('3456');
    expect(masked).toContain('4321');
    expect(masked.replace(/\D/g, '')).not.toContain('6222021234564321');
  });
});

describe('parseSms', () => {
  it('reads a China Merchants card bill with a month-day due date', () => {
    const parsed = parseSms('【招商银行】您尾号1234的信用卡本期账单已出，本期应还¥3,280.50，最后还款日03月15日。', TODAY);
    expect(parsed).toMatchObject({
      bank: '招商银行',
      cardTail: '1234',
      amount: 3280.5,
      currency: 'CNY',
      validUntil: '2027-03-15',
      dueDay: 15,
      cycle: 'monthly',
      category: 'money',
    });
    expect(parsed.title).toContain('招商银行');
    expect(parsed.title).toContain('1234');
    expect(parsed.sourceText).toContain('尾号1234');
  });

  it('reads an ICBC bill with an ISO due date', () => {
    const parsed = parseSms('【工商银行】您的信用卡(尾号5678)账单：应还金额人民币1280.00元，还款日2026-04-08。', TODAY);
    expect(parsed).toMatchObject({
      bank: '工商银行',
      cardTail: '5678',
      amount: 1280,
      currency: 'CNY',
      validUntil: '2026-04-08',
      dueDay: 8,
      category: 'money',
    });
  });

  it('reads a mortgage reminder and keeps the loan on the house category', () => {
    const parsed = parseSms('【建设银行】房贷还款提醒：贷款尾号9012，应还金额¥8,650.00，还款日4月20日。', TODAY);
    expect(parsed).toMatchObject({
      bank: '建设银行',
      cardTail: '9012',
      amount: 8650,
      validUntil: '2027-04-20',
      dueDay: 20,
      cycle: 'monthly',
      category: 'house',
    });
    expect(parsed.title).toContain('房贷');
  });

  it('reads a Ping An bill written without brackets', () => {
    const parsed = parseSms('尊敬的客户，您尾号2468的平安银行信用卡本期应还金额为￥520.00，最后还款日为2026年05月09日，请及时还款。', TODAY);
    expect(parsed).toMatchObject({
      bank: '平安银行',
      cardTail: '2468',
      amount: 520,
      validUntil: '2026-05-09',
      dueDay: 9,
      category: 'money',
    });
  });

  it('stores a pasted full card number as its last four digits', () => {
    const raw = '【交通银行】信用卡6222021234567890本期应还¥99.00，最后还款日2026-11-02。';
    const parsed = parseSms(raw, TODAY);
    expect(parsed.sourceText).not.toContain('6222021234567890');
    expect(parsed.sourceText).not.toContain('021234567');
    expect(parsed.cardTail).toBe('7890');
    expect(parsed.amount).toBe(99);
    expect(parsed.validUntil).toBe('2026-11-02');
    expect(parsed.bank).toBe('交通银行');
  });

  it('uses this year when the month-day is still ahead and keeps a phone number', () => {
    const parsed = parseSms('请联系13800138000。尾号1357 本期应还¥20，最后还款日12月01日', TODAY);
    expect(parsed.validUntil).toBe('2026-12-01');
    expect(parsed.cardTail).toBe('1357');
    expect(parsed.amount).toBe(20);
    expect(parsed.sourceText).toContain('13800138000');
  });
});
