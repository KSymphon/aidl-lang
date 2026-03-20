╔A:notifications-module | node.js | redis, sendgrid, firebase
╔v:1.2
╔source:src/notifications/
§ domain: notification delivery across channels

═══ L1: LIEUX ═══

@notification_center [#authenticated] 🔒
  .inbox /list:notification {read, filterable}
  .unread_count /number {read, dynamic}
  .mark_all_read /action {write}
  .preferences /action {write} →@notification_preferences

@notification_preferences [#authenticated] 🔒
  .email_settings /table:event*enabled {read, write}
  .push_settings /table:event*enabled {read, write}
  .quiet_hours /table:field*value {read, write}
  →$update_preferences {settings}
    !ok >> @notification_preferences {saved}
    !err >> @notification_preferences {error}
  ←@notification_center

═══ L4: PORTES API ═══

$update_preferences :PUT
  input: {settings}
  output: {updated_preferences}
  [#authenticated] (timeout: 5s, retry: 1)

═══ L4: FLUX ═══

~email_dispatch [every:immediate]
  notification_event => check_preferences => render_template => send_email => log_delivery

~push_dispatch [every:immediate]
  notification_event => check_preferences => format_payload => send_push => log_delivery

~digest_emails [cron:0 8 * * *]
  unread_notifications => group_by_user => render_digest => send_digest

═══ L5: ANOMALIES ═══

!attention(6) no_delivery_tracking [@notification_center]
  < email bounce/delivery status not tracked
  = users may not receive notifications without anyone knowing

!attention(4) no_rate_limit_notifications [~email_dispatch]
  < no rate limit on notification sending
  = a bug could spam users with hundreds of emails

╚═══════════════════════════════════════════
