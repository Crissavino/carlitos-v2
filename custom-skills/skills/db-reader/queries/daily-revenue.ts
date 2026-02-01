import { QueryDefinition } from "../types.js";
import { EUR_RATES, CurrencyConverter } from "../../../core/currency.js";

// Re-export for backwards compatibility
const HARDCODED_RATES = EUR_RATES;

// This query combines:
// 1. Invoices from avocode (trials, subscriptions, invoice refunds)
// 2. Zoho refunds from avocodebo (jackcode refunds)
export const dailyRevenue7dQuery: QueryDefinition = {
  id: "daily-revenue-7d",
  name: "Daily Revenue (7 days)",
  description: "Revenue from paid invoices + Zoho refunds in the last 7 days",
  sql: `
    SELECT 
      date,
      currency_code,
      invoice_type_id,
      invoice_type_name,
      SUM(total_original) as total_original,
      SUM(invoice_count) as invoice_count
    FROM (
      -- Invoices from avocode
      SELECT 
        DATE(i.transacted_at) as date, 
        i.currency_code,
        i.invoice_type_id,
        it.name as invoice_type_name,
        SUM(i.amount) as total_original,
        COUNT(*) as invoice_count
      FROM avocode.invoices i
      LEFT JOIN avocode.invoice_types it ON i.invoice_type_id = it.id
      WHERE i.transacted_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        AND i.invoice_status_id = 1
      GROUP BY DATE(i.transacted_at), i.currency_code, i.invoice_type_id, it.name
      
      UNION ALL
      
      -- Zoho refunds from avocodebo (jackcode)
      SELECT 
        DATE(zr.created_at) as date,
        COALESCE(zc.currency_code, zosc.currency_code) as currency_code,
        3 as invoice_type_id,
        'Refund (Zoho)' as invoice_type_name,
        SUM(zr.amount) as total_original,
        COUNT(*) as invoice_count
      FROM avocodebo.zoho_refunds zr
      LEFT JOIN avocodebo.zoho_credit_notes zcn ON zr.zoho_credit_note_id = zcn.id
      LEFT JOIN avocodebo.zoho_customers zc ON zcn.zoho_customer_id = zc.id
      LEFT JOIN avocodebo.zoho_one_shot_customers zosc ON zcn.zoho_one_shot_customer_id = zosc.id
      WHERE zr.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY DATE(zr.created_at), COALESCE(zc.currency_code, zosc.currency_code)
    ) combined
    GROUP BY date, currency_code, invoice_type_id, invoice_type_name
    ORDER BY date DESC, invoice_type_id, currency_code
  `,
  params: [],
  permissions: ["SELECT"],
};

export function convertToEur(amount: number, currency: string): number {
  return CurrencyConverter.toEur(amount, currency);
}

export { HARDCODED_RATES };
