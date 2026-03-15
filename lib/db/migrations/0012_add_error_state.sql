-- Custom migration to update pending requests with manual intervention notes to error state
UPDATE requests
SET status = 'error'
WHERE status = 'pending' 
AND notes LIKE '%MIMIRR_MANUAL_INTERVENTION_REQUIRED%';