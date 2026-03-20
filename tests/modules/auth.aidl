╔A:auth-module | node.js | passport, jwt, redis
╔v:1.2
╔verified:2026-03-20
╔source:src/auth/
§ domain: authentication and authorization
§ JWT = JSON web token
§ MFA = multi-factor authentication
§ TOTP = time-based one-time password

═══ L1: LIEUX ═══

@auth_login [#anonymous]
  .email /text {required, write}
  .password /text {required, write}
  .remember_me /boolean {write}
  →$authenticate {email, password}
    !ok >> @auth_mfa {session_token}
    !err >> @auth_login {error}

@auth_mfa [#anonymous]
  .totp_code /number {required, write}
  →$verify_mfa {session_token, totp_code}
    !ok >> @dashboard {access_token}
    !err >> @auth_mfa {error}
  →@auth_login

@auth_register [#anonymous]
  .email /text {required, write}
  .password /text {required, write}
  .company /text {required, write}
  .plan /choice:free|starter|pro|enterprise {required, choice}
  →$create_account {email, password, company, plan}
    !ok >> @auth_verify_email {user_id}
    !err >> @auth_register {error}

@auth_verify_email [#anonymous]
  .code /text {required, write}
  →$verify_email {user_id, code}
    !ok >> @auth_login {verified}
    !err >> @auth_verify_email {error}

@auth_forgot_password [#anonymous]
  .email /text {required, write}
  →$request_password_reset {email}
    !ok >> @auth_login {reset_sent}
    !err >> @auth_forgot_password {error}

@auth_reset_password [#anonymous]
  .new_password /text {required, write}
  .confirm_password /text {required, write}
  →$reset_password {token, new_password}
    !ok >> @auth_login {password_changed}
    !err >> @auth_reset_password {error}

═══ L4: STORES ═══

^session [redis]
  {user_id, company_id, role, permissions, access_token, refresh_token, expires_at, mfa_verified}
  > @dashboard {user_id, role, permissions}
  > @user_profile {user_id}

═══ L4: PORTES API ═══

$authenticate :POST
  input: {email, password}
  output: {session_token, requires_mfa}
  [#anonymous] (timeout: 5s, retry: 0)
  chain: validate_input >> check_credentials >> check_account_locked >> generate_session_token

$verify_mfa :POST
  input: {session_token, totp_code}
  output: {access_token, refresh_token, user}
  [#anonymous] (timeout: 5s, retry: 0)
  chain: validate_token >> verify_totp >> generate_jwt >> create_session

$create_account :POST
  input: {email, password, company, plan}
  output: {user_id, company_id}
  [#anonymous] (timeout: 10s, retry: 0)
  chain: validate_input >> check_duplicate >> hash_password >> create_user >> create_company >> send_verification_email

$verify_email :POST
  input: {user_id, code}
  output: {verified}
  [#anonymous] (timeout: 5s, retry: 0)

$request_password_reset :POST
  input: {email}
  output: {success}
  [#anonymous] (timeout: 5s, retry: 0)

$reset_password :POST
  input: {token, new_password}
  output: {success}
  [#anonymous] (timeout: 5s, retry: 0)

$verify_token :GET
  input: {access_token}
  output: {user_id, role, permissions}
  [#anonymous] (timeout: 2s, retry: 1)

═══ L4: FLUX ═══

~session_cleanup [cron:0 */4 * * *]
  expired_sessions => revoke_tokens => purge_redis => log_count

~audit_log [every:immediate]
  auth_event => enrich_context => write_audit_db => notify_if_suspicious

~brute_force_detection [every:1min]
  failed_attempts => aggregate_by_ip => check_threshold => block_or_alert

═══ L5: ANOMALIES ═══

!critical(9) no_account_lockout [$authenticate]
  < no lockout after N failed attempts
  = brute force attacks possible

!critical(8) jwt_no_rotation [$verify_token]
  < JWT secret never rotated
  = if key is leaked, all tokens are compromised forever

!attention(6) mfa_optional [@auth_register]
  < MFA setup not enforced during registration
  = accounts vulnerable until user enables MFA manually

!attention(4) password_policy [$create_account]
  < minimum password length only 8 characters, no complexity rules
  = weak passwords accepted

╚═══════════════════════════════════════════
