do $$
begin
  if exists(select 1 from cron.job where jobname='va-managed-hosting-reconcile') then
    perform cron.unschedule('va-managed-hosting-reconcile');
  end if;

  perform cron.schedule(
    'va-managed-hosting-reconcile',
    '17 */6 * * *',
    $job$
      select net.http_get(
        url:='https://vaeltx-portfolio.vercel.app/api/vaeltx/billing/reconcile',
        headers:=jsonb_build_object(
          'Authorization',
          'Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='va_auction_operations')
        ),
        timeout_milliseconds:=25000
      )
      where exists(select 1 from vault.secrets where name='va_auction_operations');
    $job$
  );
end $$;
