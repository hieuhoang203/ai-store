DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'category'
  ) THEN
    INSERT INTO public.categories (name)
    SELECT DISTINCT trim(products.category)
    FROM public.products
    WHERE products.category IS NOT NULL
      AND trim(products.category) <> ''
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

    DROP INDEX IF EXISTS public.idx_products_category;

    ALTER TABLE public.products
      DROP COLUMN category;
  END IF;
END
$$;
