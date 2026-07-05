/**
 * CIC Cost Compute PDF Report Generator
 * Generates daily/weekly PDF reports from cost data
 */
import { generateCicCostComputeReport } from '../src/lib/report/CicCostComputeReport';
import { renderReportHtml } from '../src/lib/report/renderReportHtml';
import { htmlToPdfFile } from '../src/lib/report/htmlToPdf';
import { mkdir } from 'fs/promises';
import { resolve } from 'path';
/**
 * Generate and write PDF report
 * Daily or weekly, saved to ./reports/cic-cost-{period}-{date}.pdf
 */
export async function generatePdfReport(period = 'daily') {
    try {
        // Ensure reports directory exists
        const reportsDir = resolve(process.cwd(), 'reports');
        await mkdir(reportsDir, { recursive: true });
        // Generate report data
        const report = generateCicCostComputeReport();
        // Render HTML
        const html = renderReportHtml(report, {
            title: `CIC Cost Compute Report - ${period === 'daily' ? 'Daily' : 'Weekly'}`,
            period,
            includeCharts: true,
        });
        // Generate filename
        const date = new Date().toISOString().split('T')[0];
        const filename = `cic-cost-${period}-${date}.pdf`;
        const filePath = resolve(reportsDir, filename);
        // Write PDF
        await htmlToPdfFile(html, filePath, {
            format: 'A4',
            landscape: false,
            margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
        });
        console.log(`[${new Date().toISOString()}] PDF report generated: ${filePath}`);
        return filePath;
    }
    catch (err) {
        console.error(`[${new Date().toISOString()}] Error generating PDF report:`, err);
        throw err;
    }
}
/**
 * Generate both daily and weekly reports
 */
export async function generateAllReports() {
    const daily = await generatePdfReport('daily');
    const weekly = await generatePdfReport('weekly');
    return { daily, weekly };
}
//# sourceMappingURL=cicCostComputePdf.js.map