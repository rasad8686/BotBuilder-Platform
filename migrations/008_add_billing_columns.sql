-- Migration: Add billing and subscription columns to organizations table
-- Description: Adds Stripe integration columns for subscription management
-- Date: 2024-11-01

-- Add billing-related columns to organizations table
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMP;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer
ON organizations(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_organizations_stripe_subscription
ON organizations(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_organizations_subscription_status
ON organizations(subscription_status);

-- Add comments for documentation
COMMENT ON COLUMN organizations.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN organizations.stripe_subscription_id IS 'Stripe subscription ID for active subscription';
COMMENT ON COLUMN organizations.subscription_status IS 'Subscription status: active, trialing, past_due, canceled, incomplete';
COMMENT ON COLUMN organizations.subscription_current_period_end IS 'Current billing period end date';

-- Verify the columns exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations'
    AND column_name = 'stripe_customer_id'
  ) THEN
    RAISE EXCEPTION 'Migration failed: stripe_customer_id column not created';
  END IF;

  RAISE NOTICE 'Migration 008 completed successfully - Billing columns added to organizations table';
END $$;
