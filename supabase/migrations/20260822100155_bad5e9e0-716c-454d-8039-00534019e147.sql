ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS auto_approve_refunds boolean NOT NULL DEFAULT false;

INSERT INTO public.app_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.refund_sale(p_sale_id uuid, p_kind text DEFAULT 'refund'::text, p_reason text DEFAULT NULL::text, p_restock boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s public.sales%ROWTYPE;
  new_id uuid;
  auto_ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  IF NOT public.has_role(auth.uid(), 'manager') THEN
    SELECT COALESCE(auto_approve_refunds, false) INTO auto_ok FROM public.app_settings WHERE id = true;
    IF NOT COALESCE(auto_ok, false) THEN
      RAISE EXCEPTION 'Refunds need manager approval. Ask your manager to switch on auto-approve refunds.';
    END IF;
  END IF;

  SELECT * INTO s FROM public.sales WHERE id = p_sale_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;
  IF s.status IN ('refunded', 'voided') THEN
    RAISE EXCEPTION 'This sale was already %', s.status;
  END IF;

  INSERT INTO public.refunds (sale_id, kind, reason, amount, restocked, created_by)
  VALUES (p_sale_id, COALESCE(p_kind, 'refund'), p_reason, s.total_amount, COALESCE(p_restock, true), auth.uid())
  RETURNING id INTO new_id;

  IF COALESCE(p_restock, true) THEN
    UPDATE public.stock st
       SET quantity = st.quantity + si.quantity,
           available = true,
           updated_at = now()
      FROM public.sale_items si
     WHERE si.sale_id = p_sale_id AND st.variant_id = si.variant_id;
  END IF;

  UPDATE public.sales
     SET status = CASE WHEN COALESCE(p_kind, 'refund') = 'void' THEN 'voided' ELSE 'refunded' END
   WHERE id = p_sale_id;

  RETURN new_id;
END $function$;