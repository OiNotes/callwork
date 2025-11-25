
import { prisma } from '../lib/prisma'

async function checkData() {
  const reports = await prisma.report.findMany()
  let badReports = 0
  
  for (const r of reports) {
    if (r.pzmConducted > r.zoomAppointments) {
      console.log(`Bad Report ${r.id} (User ${r.userId}): Zoom1 (${r.pzmConducted}) > Booked (${r.zoomAppointments})`)
      badReports++
    }
  }
  
  console.log(`Found ${badReports} reports with Zoom1 > Booked out of ${reports.length}`)
}

checkData()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
