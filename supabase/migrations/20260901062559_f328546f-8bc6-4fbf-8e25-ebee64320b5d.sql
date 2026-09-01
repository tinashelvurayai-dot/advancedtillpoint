CREATE TABLE IF NOT EXISTS public.refund_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id uuid NOT NULL REFERENCES public.refunds(id) ON DELETE CASCADE,
  sale_item_id uuid NOT NULL REFERENCES public.sale_items(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id),
  quantity integer NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.refund_items TO authenticated;
GRANT ALL ON public.refund_items TO service_role;

ALTER TABLE public.refund_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed in read refund items" ON public.refund_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Till devices operate refund_items" ON public.refund_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.refund_sale_items(
  p_sale_id uuid,
  p_kind text DEFAULT 'refund',
  p_reason text DEFAULT NULL,
  p_restock boolean DEFAULT true,
  p_items jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s public.sales%ROWTYPE;
  new_id uuid;
  auto_ok boolean;
  v_total numeric := 0;
  v_partial boolean := false;
  v_remaining numeric := 0;
  r record;
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

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    v_partial := false;
  ELSE
    v_partial := true;
  END IF;

  INSERT INTO public.refunds (sale_id, kind, reason, amount, restocked, created_by)
  VALUES (p_sale_id, COALESCE(p_kind, 'refund'), p_reason, 0, COALESCE(p_restock, true), auth.uid())
  RETURNING id INTO new_id;

  IF NOT v_partial THEN
    -- Whole sale: every remaining quantity comes back.
    FOR r IN
      SELECT si.id, si.variant_id, si.unit_price,
             si.quantity - COALESCE((SELECT SUM(ri.quantity) FROM public.refund_items ri WHERE ri.sale_item_id = si.id), 0) AS qty
        FROM public.sale_items si
       WHERE si.sale_id = p_sale_id
    LOOP
      IF r.qty > 0 THEN
        INSERT INTO public.refund_items (refund_id, sale_item_id, variant_id, quantity, unit_price, amount)
        VALUES (new_id, r.id, r.variant_id, r.qty, r.unit_price, r.qty * r.unit_price);
        v_total := v_total + (r.qty * r.unit_price);
      END IF;
    END LOOP;
  ELSE
    FOR r IN
      SELECT si.id, si.variant_id, si.unit_price,
             (i->>'quantity')::int AS req,
             si.quantity - COALESCE((SELECT SUM(ri.quantity) FROM public.refund_items ri WHERE ri.sale_item_id = si.id), 0) AS avail
        FROM jsonb_array_elements(p_items) i
        JOIN public.sale_items si ON si.id = (i->>'sale_item_id')::uuid AND si.sale_id = p_sale_id
    LOOP
      IF r.req IS NULL OR r.req <= 0 THEN CONTINUE; END IF;
      IF r.req > r.avail THEN
        RAISE EXCEPTION 'Only % of that item can still be refunded', r.avail;
      END IF;
      INSERT INTO public.refund_items (refund_id, sale_item_id, variant_id, quantity, unit_price, amount)
      VALUES (new_id, r.id, r.variant_id, r.req, r.unit_price, r.req * r.unit_price);
      v_total := v_total + (r.req * r.unit_price);
    END LOOP;
  END IF;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Nothing left to refund on this sale';
  END IF;

  UPDATE public.refunds SET amount = v_total WHERE id = new_id;

  IF COALESCE(p_restock, true) THEN
    UPDATE public.stock st
       SET quantity = st.quantity + ri.quantity,
           available = true,
           updated_at = now()
      FROM public.refund_items ri
     WHERE ri.refund_id = new_id AND st.variant_id = ri.variant_id;
  END IF;

  -- Anything still unrefunded keeps the sale open as "partially_refunded".
  SELECT COALESCE(SUM(si.quantity), 0) - COALESCE((
           SELECT SUM(ri.quantity) FROM public.refund_items ri
            JOIN public.sale_items si2 ON si2.id = ri.sale_item_id
           WHERE si2.sale_id = p_sale_id), 0)
    INTO v_remaining
    FROM public.sale_items si
   WHERE si.sale_id = p_sale_id;

  UPDATE public.sales
     SET status = CASE
                    WHEN v_remaining > 0 THEN 'partially_refunded'
                    WHEN COALESCE(p_kind, 'refund') = 'void' THEN 'voided'
                    ELSE 'refunded'
                  END
   WHERE id = p_sale_id;

  RETURN new_id;
END $function$;

CREATE OR REPLACE FUNCTION public.refund_sale(
  p_sale_id uuid,
  p_kind text DEFAULT 'refund',
  p_reason text DEFAULT NULL,
  p_restock boolean DEFAULT true
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.refund_sale_items(p_sale_id, p_kind, p_reason, p_restock, NULL);
$function$;