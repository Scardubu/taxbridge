-- C-02 Compliance Fix: rename legacy firs_ column names to nrs_ 
-- These columns were previously named for a deprecated regulatory body.
-- The NRS (Nigeria Revenue Service) terminology is now canonical per NTA 2025.

ALTER TABLE invoices RENAME COLUMN firs_csid TO nrs_csid;
ALTER TABLE invoices RENAME COLUMN firs_irn TO nrs_irn;
