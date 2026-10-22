import type { Category, Cycle, ItemKind } from './types.ts';

export const CATEGORIES: Category[] = ['document', 'car', 'house', 'money', 'insurance', 'health', 'subscription', 'household', 'child'];

const LEGACY: Record<string, Category> = {
  id: 'document',
  bill: 'money',
  contract: 'house',
  other: 'household',
  insurance: 'insurance',
  subscription: 'subscription',
};

export function mapLegacyCategory(value: string): Category {
  if ((CATEGORIES as string[]).includes(value)) return value as Category;
  return LEGACY[value] ?? 'household';
}

export interface Template {
  id: string;
  category: Category;
  nameZh: string;
  nameEn: string;
  kind: ItemKind;
  cycle: Cycle | null;
  dueDay: number | null;
  dueMonth: number | null;
  reminders: number[];
  person: 'child' | 'parents' | null;
}

export const TEMPLATES: Template[] = [
  { id: 'id-card', category: 'document', nameZh: '身份证', nameEn: 'ID card', kind: 'expiry', cycle: null, dueDay: null, dueMonth: null, reminders: [90, 30, 7], person: null },
  { id: 'passport', category: 'document', nameZh: '护照', nameEn: 'Passport', kind: 'expiry', cycle: null, dueDay: null, dueMonth: null, reminders: [180, 90, 30], person: null },
  { id: 'hk-mo', category: 'document', nameZh: '港澳通行证', nameEn: 'Exit-entry permit', kind: 'expiry', cycle: null, dueDay: null, dueMonth: null, reminders: [90, 30, 7], person: null },
  { id: 'license', category: 'document', nameZh: '驾照换证', nameEn: 'License renewal', kind: 'expiry', cycle: null, dueDay: null, dueMonth: null, reminders: [60, 30, 7], person: null },
  { id: 'points', category: 'document', nameZh: '驾照记分周期', nameEn: 'License points year', kind: 'expiry', cycle: 'yearly', dueDay: null, dueMonth: null, reminders: [30, 7], person: null },
  { id: 'car-ins', category: 'car', nameZh: '车险', nameEn: 'Car insurance', kind: 'expiry', cycle: 'yearly', dueDay: null, dueMonth: null, reminders: [30, 7, 1], person: null },
  { id: 'inspect', category: 'car', nameZh: '年检', nameEn: 'Inspection', kind: 'expiry', cycle: 'yearly', dueDay: null, dueMonth: null, reminders: [30, 7], person: null },
  { id: 'service', category: 'car', nameZh: '保养', nameEn: 'Service', kind: 'expiry', cycle: 'yearly', dueDay: null, dueMonth: null, reminders: [14, 7], person: null },
  { id: 'etc', category: 'car', nameZh: 'ETC', nameEn: 'ETC', kind: 'expiry', cycle: 'yearly', dueDay: null, dueMonth: null, reminders: [7, 1], person: null },
  { id: 'loan', category: 'house', nameZh: '房贷', nameEn: 'House loan', kind: 'expiry', cycle: 'monthly', dueDay: 15, dueMonth: null, reminders: [3, 1], person: null },
  { id: 'hoa', category: 'house', nameZh: '物业费', nameEn: 'Property fee', kind: 'expiry', cycle: 'monthly', dueDay: 1, dueMonth: null, reminders: [3, 1], person: null },
  { id: 'heat', category: 'house', nameZh: '取暖费', nameEn: 'Heating', kind: 'expiry', cycle: 'yearly', dueDay: 1, dueMonth: 11, reminders: [14, 7], person: null },
  { id: 'gas', category: 'house', nameZh: '燃气安全检查', nameEn: 'Gas safety check', kind: 'expiry', cycle: 'yearly', dueDay: null, dueMonth: null, reminders: [14, 7], person: null },
  { id: 'lease', category: 'house', nameZh: '房租/租约到期', nameEn: 'Lease end', kind: 'expiry', cycle: null, dueDay: null, dueMonth: null, reminders: [60, 30, 7], person: null },
  { id: 'card', category: 'money', nameZh: '信用卡还款', nameEn: 'Card payment', kind: 'expiry', cycle: 'monthly', dueDay: 15, dueMonth: null, reminders: [3, 1], person: null },
  { id: 'card-fee', category: 'money', nameZh: '信用卡年费减免', nameEn: 'Card fee waiver', kind: 'expiry', cycle: 'yearly', dueDay: null, dueMonth: null, reminders: [30, 7], person: null },
  { id: 'deposit', category: 'money', nameZh: '定期存款到期', nameEn: 'Deposit maturity', kind: 'expiry', cycle: null, dueDay: null, dueMonth: null, reminders: [14, 7, 1], person: null },
  { id: 'tax', category: 'money', nameZh: '个税年度汇算', nameEn: 'Tax filing', kind: 'expiry', cycle: 'yearly', dueDay: 30, dueMonth: 6, reminders: [30, 14], person: null },
  { id: 'policy', category: 'insurance', nameZh: '保单续保', nameEn: 'Policy renewal', kind: 'expiry', cycle: 'yearly', dueDay: null, dueMonth: null, reminders: [30, 7, 1], person: null },
  { id: 'social', category: 'insurance', nameZh: '医保/社保缴费', nameEn: 'Social insurance', kind: 'expiry', cycle: 'monthly', dueDay: 15, dueMonth: null, reminders: [3, 1], person: null },
  { id: 'checkup', category: 'health', nameZh: '体检', nameEn: 'Checkup', kind: 'expiry', cycle: 'yearly', dueDay: null, dueMonth: null, reminders: [14, 7], person: null },
  { id: 'vaccine', category: 'health', nameZh: '疫苗', nameEn: 'Vaccine', kind: 'expiry', cycle: null, dueDay: null, dueMonth: null, reminders: [7, 1], person: null },
  { id: 'teeth', category: 'health', nameZh: '洗牙', nameEn: 'Cleaning', kind: 'expiry', cycle: 'yearly', dueDay: null, dueMonth: null, reminders: [7, 1], person: null },
  { id: 'child-vaccine', category: 'health', nameZh: '孩子疫苗', nameEn: 'Child vaccine', kind: 'expiry', cycle: null, dueDay: null, dueMonth: null, reminders: [14, 7], person: 'child' },
  { id: 'rx', category: 'health', nameZh: '长期用药续方', nameEn: 'Prescription refill', kind: 'expiry', cycle: 'monthly', dueDay: 1, dueMonth: null, reminders: [7, 3], person: null },
  { id: 'video', category: 'subscription', nameZh: '视频会员', nameEn: 'Video membership', kind: 'subscription', cycle: 'yearly', dueDay: null, dueMonth: null, reminders: [7, 1], person: null },
  { id: 'cloud', category: 'subscription', nameZh: '云存储', nameEn: 'Cloud storage', kind: 'subscription', cycle: 'yearly', dueDay: null, dueMonth: null, reminders: [7, 1], person: null },
  { id: 'domain', category: 'subscription', nameZh: '域名/服务器自动续费', nameEn: 'Domain renewal', kind: 'subscription', cycle: 'yearly', dueDay: null, dueMonth: null, reminders: [14, 7], person: null },
  { id: 'elder', category: 'household', nameZh: '老人复诊', nameEn: 'Elder visit', kind: 'expiry', cycle: null, dueDay: null, dueMonth: null, reminders: [3, 1], person: 'parents' },
  { id: 'warranty', category: 'household', nameZh: '家电保修', nameEn: 'Appliance warranty', kind: 'expiry', cycle: null, dueDay: null, dueMonth: null, reminders: [30, 7], person: null },
  { id: 'filter', category: 'household', nameZh: '净水器滤芯', nameEn: 'Water filter', kind: 'expiry', cycle: null, dueDay: null, dueMonth: null, reminders: [7, 1], person: null },
  { id: 'ac', category: 'household', nameZh: '空调清洗', nameEn: 'AC cleaning', kind: 'expiry', cycle: 'yearly', dueDay: null, dueMonth: null, reminders: [14, 7], person: null },
  { id: 'school', category: 'child', nameZh: '入学报名', nameEn: 'School enrollment', kind: 'expiry', cycle: null, dueDay: null, dueMonth: null, reminders: [14, 7, 1], person: 'child' },
  { id: 'exam', category: 'child', nameZh: '考试报名截止', nameEn: 'Exam deadline', kind: 'expiry', cycle: null, dueDay: null, dueMonth: null, reminders: [7, 3, 1], person: 'child' },
];

export function templateById(id: string): Template | undefined {
  return TEMPLATES.find((template) => template.id === id);
}
