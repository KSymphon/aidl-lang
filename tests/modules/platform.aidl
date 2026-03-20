╔A:enterprise-platform | microservices | k8s, kafka, postgres, redis, elasticsearch
╔v:1.2
╔verified:2026-03-20
╔coverage:95%
╔source:src/
§ domain: enterprise SaaS platform with 60+ screens
§ RBAC = role-based access control
§ SSO = single sign-on via SAML/OIDC
§ CDC = change data capture
§ CQRS = command query responsibility segregation
&auth.aidl
&users.aidl
&products.aidl
&orders.aidl
&analytics.aidl
&notifications.aidl

═══ TOPOLOGY ═══

@api_gateway → [auth, users, products, orders, analytics]
auth → [users]
orders → [products, payments, notifications]
analytics → [orders, users, products]
notifications → [users]

═══ SHARED ═══

$verify_token [defined:auth.aidl, used_by:all]
^session [defined:auth.aidl, read_by:users, orders, analytics]
~audit_log [defined:auth.aidl, fed_by:all]

═══ L1: LIEUX ═══

@api_gateway [#public]
  .health_check /action {read}
  .rate_limiter /action {read, dynamic}
  →@auth_login →@auth_register

@landing [#public]
  .hero /text {read}
  .features /list:feature {read}
  .pricing /list:plan {read}
  .cta /action {write} →@auth_register
  →@docs →@status_page

@docs [#public]
  .api_reference /list:endpoint {read, filterable}
  .guides /list:guide {read}
  .changelog /list:release {read}

@status_page [#public]
  .services /list:service_status {read, dynamic}
  .incidents /list:incident {read}
  .uptime /number {read}

═══ L5: ANOMALIES ═══

!critical(10) no_waf [$api_gateway]
  < no web application firewall in front of API gateway
  = exposed to OWASP top 10 attacks

!critical(9) no_ddos_protection [@api_gateway]
  < no DDoS mitigation configured
  = platform can be taken down by volumetric attacks

!attention(5) no_api_versioning [$api_gateway]
  < all endpoints served without version prefix
  = breaking changes affect all clients simultaneously

¬¬ UNMAPPED
  /internal/debug/* — debug endpoints, dev only
  /admin/feature-flags — feature flag management
  src/migrations/* — database migrations
  src/scripts/* — operational scripts

╚═══════════════════════════════════════════
