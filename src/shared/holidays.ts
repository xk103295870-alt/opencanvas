export type HolidayInfo = { name: string; nameEn: string }

const CHINA_LUNAR_LOOKUP: Record<string, string> = {
  // 春节
  '2020-01-25': '春节',
  '2021-02-12': '春节',
  '2022-02-01': '春节',
  '2023-01-22': '春节',
  '2024-02-10': '春节',
  '2025-01-29': '春节',
  '2026-02-17': '春节',
  '2027-02-06': '春节',
  '2028-01-26': '春节',
  '2029-02-13': '春节',
  '2030-02-03': '春节',
  '2031-01-23': '春节',
  '2032-02-11': '春节',
  '2033-01-31': '春节',
  '2034-02-19': '春节',
  '2035-02-08': '春节',
  // 清明
  '2020-04-04': '清明',
  '2021-04-04': '清明',
  '2022-04-05': '清明',
  '2023-04-05': '清明',
  '2024-04-04': '清明',
  '2025-04-04': '清明',
  '2026-04-05': '清明',
  '2027-04-05': '清明',
  '2028-04-04': '清明',
  '2029-04-04': '清明',
  '2030-04-05': '清明',
  '2031-04-05': '清明',
  '2032-04-04': '清明',
  '2033-04-04': '清明',
  '2034-04-05': '清明',
  '2035-04-05': '清明',
  // 端午
  '2020-06-25': '端午',
  '2021-06-14': '端午',
  '2022-06-03': '端午',
  '2023-06-22': '端午',
  '2024-06-10': '端午',
  '2025-05-31': '端午',
  '2026-06-19': '端午',
  '2027-06-09': '端午',
  '2028-05-28': '端午',
  '2029-06-16': '端午',
  '2030-06-05': '端午',
  '2031-06-24': '端午',
  '2032-06-12': '端午',
  '2033-06-01': '端午',
  '2034-06-20': '端午',
  '2035-06-10': '端午',
  // 中秋
  '2020-10-01': '中秋',
  '2021-09-21': '中秋',
  '2022-09-10': '中秋',
  '2023-09-29': '中秋',
  '2024-09-17': '中秋',
  '2025-10-06': '中秋',
  '2026-09-25': '中秋',
  '2027-09-15': '中秋',
  '2028-10-03': '中秋',
  '2029-09-22': '中秋',
  '2030-09-12': '中秋',
  '2031-10-01': '中秋',
  '2032-09-19': '中秋',
  '2033-09-08': '中秋',
  '2034-09-27': '中秋',
  '2035-09-17': '中秋',
}

function getChinaFixedHoliday(monthDay: string): string | null {
  if (monthDay === '01-01') return '元旦'
  if (monthDay === '05-01') return '劳动节'
  if (monthDay === '10-01') return '国庆'
  return null
}

function getChinaHoliday(dateKey: string): HolidayInfo | null {
  const name = CHINA_LUNAR_LOOKUP[dateKey] || getChinaFixedHoliday(dateKey.slice(5))
  if (!name) return null
  const enMap: Record<string, string> = {
    '春节': 'Spring Festival',
    '清明': 'Tomb Sweeping Day',
    '端午': 'Dragon Boat Festival',
    '中秋': 'Mid-Autumn Festival',
    '元旦': "New Year's Day",
    '劳动节': 'Labor Day',
    '国庆': 'National Day',
  }
  return { name, nameEn: enMap[name] || name }
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): number {
  const firstDay = new Date(year, month, 1).getDay()
  let date = 1 + ((weekday - firstDay + 7) % 7)
  if (n > 1) date += (n - 1) * 7
  if (n === -1) {
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
    date = 1 + ((weekday - firstDay + 7) % 7)
    while (date + 7 <= lastDayOfMonth) date += 7
  }
  return date
}

function getUSHoliday(dateKey: string): HolidayInfo | null {
  const [yearStr, monthStr, dayStr] = dateKey.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr) - 1
  const day = Number(dayStr)

  const checks: Array<{ name: string; nameEn: string; match: boolean }> = [
    { name: '新年', nameEn: "New Year's Day", match: month === 0 && day === 1 },
    { name: '马丁·路德·金日', nameEn: 'MLK Jr. Day', match: month === 0 && day === nthWeekdayOfMonth(year, 0, 1, 3) },
    { name: '总统日', nameEn: "Presidents' Day", match: month === 1 && day === nthWeekdayOfMonth(year, 1, 1, 3) },
    { name: '阵亡将士纪念日', nameEn: 'Memorial Day', match: month === 4 && day === nthWeekdayOfMonth(year, 4, 1, -1) },
    { name: '独立日', nameEn: 'Independence Day', match: month === 6 && day === 4 },
    { name: '劳动节', nameEn: 'Labor Day', match: month === 8 && day === nthWeekdayOfMonth(year, 8, 1, 1) },
    { name: '哥伦布日', nameEn: 'Columbus Day', match: month === 9 && day === nthWeekdayOfMonth(year, 9, 1, 2) },
    { name: '退伍军人节', nameEn: 'Veterans Day', match: month === 10 && day === 11 },
    { name: '感恩节', nameEn: 'Thanksgiving', match: month === 10 && day === nthWeekdayOfMonth(year, 10, 4, 4) },
    { name: '圣诞节', nameEn: 'Christmas', match: month === 11 && day === 25 },
  ]

  const found = checks.find((c) => c.match)
  if (!found) return null
  return { name: found.name, nameEn: found.nameEn }
}

export function getHolidays(
  dateKey: string,
  mode: 'none' | 'china' | 'us' | 'both',
): HolidayInfo[] {
  if (mode === 'none') return []
  const result: HolidayInfo[] = []
  if (mode === 'china' || mode === 'both') {
    const h = getChinaHoliday(dateKey)
    if (h) result.push(h)
  }
  if (mode === 'us' || mode === 'both') {
    const h = getUSHoliday(dateKey)
    if (h) result.push(h)
  }
  return result
}
