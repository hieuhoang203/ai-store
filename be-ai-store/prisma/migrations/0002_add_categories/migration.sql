CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name character varying(255) NOT NULL,
  icon character varying(255),
  created_at timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_deleted boolean NOT NULL DEFAULT false
);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category_id uuid;

INSERT INTO public.categories (name)
SELECT DISTINCT trim(category)
FROM public.products
WHERE category IS NOT NULL
  AND trim(category) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.categories
    WHERE categories.name = trim(products.category)
      AND categories.is_deleted = false
  );

UPDATE public.products
SET category_id = categories.id
FROM public.categories
WHERE products.category_id IS NULL
  AND products.category IS NOT NULL
  AND trim(products.category) <> ''
  AND categories.name = trim(products.category)
  AND categories.is_deleted = false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND conname = 'products_category_id_fkey'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_category_id_fkey
      FOREIGN KEY (category_id)
      REFERENCES public.categories(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_categories_name ON public.categories(name);
CREATE INDEX IF NOT EXISTS idx_categories_deleted ON public.categories(is_deleted);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
