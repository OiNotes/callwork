import { type TVData as SimulatorTVData } from '@/lib/utils/demoDataSimulator'
import { toDecimal, toNumber } from '@/lib/utils/decimal'

export interface DemoManager {
  id: string
  name: string
  goal: number
}

export interface DemoDeal {
  id: string
  managerId: string
  title: string
  budget: number
  status: 'OPEN' | 'WON' | 'LOST'
  isFocus?: boolean
}

export const DEMO_MANAGERS: DemoManager[] = [
  { id: 'mgr-alex', name: 'Алексей Смирнов', goal: 1_500_000 },
  { id: 'mgr-olga', name: 'Ольга Петрова', goal: 1_200_000 },
  { id: 'mgr-kate', name: 'Катя Орлова', goal: 1_000_000 },
  { id: 'mgr-ivan', name: 'Иван Соколов', goal: 900_000 },
]

export const DEMO_DEALS: DemoDeal[] = [
  { id: 'd1', managerId: 'mgr-alex', title: 'CRM Suite', budget: 350_000, status: 'WON' },
  { id: 'd2', managerId: 'mgr-olga', title: 'Обучение отдела', budget: 220_000, status: 'WON' },
  { id: 'd3', managerId: 'mgr-kate', title: 'Enterprise пакет', budget: 480_000, status: 'OPEN', isFocus: true },
  { id: 'd4', managerId: 'mgr-ivan', title: 'Подписка PRO', budget: 180_000, status: 'OPEN', isFocus: true },
]

export const DEMO_TV_DATA: SimulatorTVData = {
  kpi: {
    sales: 2_450_000,
    deals: 32,
    calls: 210,
    appointments: 68,
    conversionRate: 15.2,
    averageDealSize: toNumber(toDecimal(2_450_000).dividedBy(32).toDecimalPlaces(0)),
    trends: {
      sales: 8,
      deals: 5,
      calls: 3,
      appointments: 2,
      conversionRate: 1.5,
      averageDealSize: 2,
    },
  },
  leaderboard: [
    { id: 'mgr-alex', rank: 1, name: 'Алексей Смирнов', sales: 720_000, deals: 8, goal: 1_500_000, progress: 48 },
    { id: 'mgr-olga', rank: 2, name: 'Ольга Петрова', sales: 640_000, deals: 7, goal: 1_200_000, progress: 53 },
    { id: 'mgr-kate', rank: 3, name: 'Катя Орлова', sales: 550_000, deals: 6, goal: 1_000_000, progress: 55 },
    { id: 'mgr-ivan', rank: 4, name: 'Иван Соколов', sales: 320_000, deals: 5, goal: 900_000, progress: 36 },
    { id: 'mgr-artyom', rank: 5, name: 'Артём Денисов', sales: 220_000, deals: 3, goal: 800_000, progress: 27 },
    { id: 'mgr-dasha', rank: 6, name: 'Дарья Громова', sales: 180_000, deals: 3, goal: 700_000, progress: 26 },
  ],
  feed: [],
}

export function cloneDemoTvData(): SimulatorTVData {
  return JSON.parse(JSON.stringify(DEMO_TV_DATA))
}
