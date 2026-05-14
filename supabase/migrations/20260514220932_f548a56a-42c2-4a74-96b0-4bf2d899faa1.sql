CREATE POLICY "Admin emails can write venue_slices"
    ON public.venue_slices
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'email' IN ('nick.dyne@gmail.com'))
    WITH CHECK (auth.jwt() ->> 'email' IN ('nick.dyne@gmail.com'));