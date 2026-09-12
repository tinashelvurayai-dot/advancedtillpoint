CREATE OR REPLACE FUNCTION public.reset_transactions(p_peak integer DEFAULT NULL::integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.refund_items;
  DELETE FROM public.refunds;
  DELETE FROM public.sale_items;
  DELETE FROM public.sales;
  UPDATE public.stock
     SET quantity = COALESCE(p_peak, peak_quantity, 40),
         low_stock_alert_level = 5,
         available = true,
         updated_at = now();
END;
$$;