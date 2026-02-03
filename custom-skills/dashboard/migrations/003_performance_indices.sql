-- Performance Indices for Dashboard Queries
-- These indices dramatically speed up the LTV and cohort queries

-- Customers table indices
CREATE INDEX IF NOT EXISTS idx_customers_website_createtime
ON avocode.customers (website_id, create_time);

-- Invoices table indices (critical for LTV and revenue queries)
CREATE INDEX IF NOT EXISTS idx_invoices_customer_type_status
ON avocode.invoices (customer_id, invoice_type_id, invoice_status_id);

CREATE INDEX IF NOT EXISTS idx_invoices_type_status_date
ON avocode.invoices (invoice_type_id, invoice_status_id, transacted_at);

CREATE INDEX IF NOT EXISTS idx_invoices_customer_date
ON avocode.invoices (customer_id, transacted_at);

-- Subscriptions table indices
CREATE INDEX IF NOT EXISTS idx_subscriptions_website_active
ON avocode.subscriptions (website_id, is_subscription_active);

-- Ads table indices
CREATE INDEX IF NOT EXISTS idx_ads_campaign_date
ON avocodebo.ads (campaign_id, date);

-- Campaigns table indices
CREATE INDEX IF NOT EXISTS idx_campaigns_website
ON avocodebo.campaigns (website_id);

-- Zoho refunds (for Jackcode refund calculations)
CREATE INDEX IF NOT EXISTS idx_zoho_refunds_creditnote
ON avocodebo.zoho_refunds (zoho_credit_note_id, created_at);
