/**
 * CIC Cost Compute PDF Report Generator
 * Generates daily/weekly PDF reports from cost data
 */
/**
 * Generate and write PDF report
 * Daily or weekly, saved to ./reports/cic-cost-{period}-{date}.pdf
 */
export declare function generatePdfReport(period?: 'daily' | 'weekly'): Promise<string>;
/**
 * Generate both daily and weekly reports
 */
export declare function generateAllReports(): Promise<{
    daily: string;
    weekly: string;
}>;
//# sourceMappingURL=cicCostComputePdf.d.ts.map