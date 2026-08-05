-- ------------------------------
-- ADD XLM-ROBERTA SENTIMENT COLUMNS TO journal_entries
-- Stores predictions from fine-tuned XLM-RoBERTa model
-- Safe to run multiple times!
-- ------------------------------

-- Sentiment label (positive, negative, distress)
ALTER TABLE public.journal_entries 
ADD COLUMN IF NOT EXISTS sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'distress'));

-- Overall sentiment score (0-100)
ALTER TABLE public.journal_entries 
ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC;

-- Class percentages 0-100
ALTER TABLE public.journal_entries 
ADD COLUMN IF NOT EXISTS positive_percentage INTEGER;

ALTER TABLE public.journal_entries 
ADD COLUMN IF NOT EXISTS negative_percentage INTEGER;

ALTER TABLE public.journal_entries 
ADD COLUMN IF NOT EXISTS distress_percentage INTEGER;

-- Model confidence 0-1
ALTER TABLE public.journal_entries 
ADD COLUMN IF NOT EXISTS confidence NUMERIC;

-- Model name/version (e.g., "xlm-roberta-finetuned-v1" or "fallback-keyword")
ALTER TABLE public.journal_entries 
ADD COLUMN IF NOT EXISTS sentiment_model TEXT DEFAULT 'xlm-roberta-finetuned';

-- Raw model output JSON for debugging
ALTER TABLE public.journal_entries 
ADD COLUMN IF NOT EXISTS sentiment_raw JSONB;
