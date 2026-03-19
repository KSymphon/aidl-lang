╔G:server-down-diagnostic | web application troubleshooting
§ domain: DevOps incident response
§ HTTP = hypertext transfer protocol
§ DNS = domain name system
§ SSL = secure sockets layer / TLS
§ CDN = content delivery network
§ OOM = out of memory

═══ PREREQUISITES ═══

.tools_required :: terminal access, curl, browser dev tools
.access_required :: server SSH, hosting dashboard, DNS panel
.urgency: service is down or degraded for end users

═══ DIAGNOSTIC STEPS ═══

@step_1_verify_outage
  →check: is the site actually down or is it just you?
  .test_external /action :: use down detector or check from different network
  .test_dns /action :: nslookup domain.com
  .test_ping /action :: ping server IP directly
  ?site_up_for_others :: local issue
    →check local DNS cache, VPN, firewall
    !ok >> not a server issue, local resolution needed
  ?site_down_for_everyone ::
    !err >> confirmed outage >> @step_2_identify_layer

@step_2_identify_layer
  →check: which layer is failing?
  .test_dns_resolution /action :: dig domain.com
  ?dns_fails ::
    !err >> DNS issue >> @step_3a_dns
  .test_ssl /action :: curl -vI https://domain.com
  ?ssl_error ::
    !err >> SSL/TLS issue >> @step_3b_ssl
  .test_http /action :: curl -I http://server-ip
  ?connection_refused ::
    !err >> server not responding >> @step_3c_server
  ?http_500 ::
    !err >> application error >> @step_3d_application
  ?http_502_503 ::
    !err >> proxy/load balancer issue >> @step_3e_proxy

@step_3a_dns
  →check DNS configuration
  .verify_nameservers :: are they pointing to correct provider?
  .verify_a_record :: does A record point to correct IP?
  .verify_propagation :: has a recent change propagated?
  ?recent_dns_change ::
    →wait propagation (up to 48h, usually < 1h)
    !ok >> resolves after propagation
  ?no_recent_change ::
    →contact DNS provider
    !err >> possible DNS provider outage

@step_3b_ssl
  →check SSL certificate
  .verify_expiry :: openssl s_client -connect domain.com:443
  ?certificate_expired ::
    →renew certificate immediately
    !ok >> service restored after renewal
  ?certificate_mismatch ::
    →check certificate covers the correct domain
    !err >> reissue certificate for correct domain

@step_3c_server
  →check server status
  .ssh_access /action :: ssh user@server
  ?ssh_fails ::
    →check hosting dashboard for server status
    ?server_stopped :: restart server
    ?server_crashed :: check crash logs, possible OOM
    !err >> may need hosting provider support
  ?ssh_works ::
    .check_processes :: systemctl status nginx/apache/node
    .check_ports :: netstat -tlnp | grep 80
    .check_disk :: df -h
    .check_memory :: free -m
    ?service_stopped :: restart the web service
    ?port_not_listening :: service crashed, check logs
    ?disk_full :: clear logs, old deployments, temp files
    ?memory_full :: identify memory leak, restart service, increase RAM
    !ok >> service restored after fix

@step_3d_application
  →check application logs
  .read_logs :: tail -100 /var/log/app/error.log
  ?database_connection_error ::
    →check database server status and credentials
  ?dependency_failure ::
    →check external API status (third-party services)
  ?code_error ::
    →check recent deployments, rollback if needed
  ?environment_variable_missing ::
    →verify .env file or secrets manager
  !ok >> fix identified, apply and restart

@step_3e_proxy
  →check reverse proxy / load balancer
  .check_nginx_logs :: tail -100 /var/log/nginx/error.log
  ?upstream_timeout ::
    →application is too slow to respond, check @step_3d_application
  ?no_healthy_backends ::
    →all application instances are down, restart them
  ?configuration_error ::
    →recent nginx config change? test with nginx -t
  !ok >> proxy restored after fix

═══ VERIFICATION ═══

!ok full recovery confirmed if:
  site accessible from external network
  SSL valid (padlock visible)
  all critical pages loading
  API endpoints responding
  monitoring alerts cleared

═══ ANOMALIES ═══

!attention no_monitoring_alerts [if outage was reported by users]
  < monitoring should have detected before users
  = review monitoring configuration, add uptime checks

!attention no_automatic_restart [if service crashed]
  < service should auto-restart on failure
  = configure systemd restart policy or container orchestration

!attention no_incident_log
  < outage cause and resolution should be documented
  = create post-mortem, update runbook

╚═══════════════════════════════════════════
── AIDL format created by Kenny Symphon — aidl-lang ──
