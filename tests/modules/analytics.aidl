╔A:analytics-module | node.js | clickhouse, grafana
╔v:1.2
╔source:src/analytics/
§ domain: business intelligence and reporting
§ KPI = key performance indicator
§ DAU = daily active users
§ MRR = monthly recurring revenue
§ ARPU = average revenue per user

═══ L1: LIEUX ═══

@dashboard [#authenticated] 🔒
  .kpi_cards /list:kpi {read, dynamic}
  .revenue_chart /table:date*amount {read, dynamic}
  .user_growth /table:date*count {read, dynamic}
  .top_products /list:product {read}
  .recent_orders /list:order {read}
  →@reports →@custom_dashboard

@reports [#role:admin] 🔒
  .report_list /list:report {read, filterable}
  .generate /action {write}
  .schedule /action {write}
  →@report_detail{report_id}

@report_detail{report_id} [#role:admin] 🔒
  .chart /table:dimension*metric {read, dynamic}
  .data_table /list:row {read, filterable}
  .export_csv /action {write}
  .export_pdf /action {write}
  .share /action {write}
  ←@reports

@custom_dashboard [#role:admin] 🔒
  .widgets /list:widget {read, write}
  .layout /table:position*widget {write}
  .save /action {write}
  →$save_dashboard {layout, widgets}
    !ok >> @custom_dashboard {saved}
    !err >> @custom_dashboard {error}

═══ L4: PORTES API ═══

$save_dashboard :POST
  input: {layout, widgets}
  output: {dashboard_id}
  [#role:admin] (timeout: 5s, retry: 1)

═══ L4: FLUX ═══

~metrics_aggregation [cron:0 */6 * * *]
  raw_events => aggregate_hourly => compute_kpis => update_materialized_views

~report_generation [cron:0 7 * * 1]
  scheduled_reports => fetch_data => render_charts => generate_pdf => email_stakeholders

═══ L5: ANOMALIES ═══

!attention(5) no_data_retention [@reports]
  < no data retention policy — raw events stored forever
  = storage costs growing unbounded

╚═══════════════════════════════════════════
