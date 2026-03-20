╔A:users-module | node.js | postgres, elasticsearch
╔v:1.2
╔verified:2026-03-20
╔source:src/users/
§ domain: user and team management
§ RBAC = role-based access control

═══ L1: LIEUX ═══

@user_list [#role:admin] 🔒
  .table /list:user {read, filterable}
  .search /text {write}
  .filter_role /choice:admin|editor|viewer {choice}
  .filter_status /choice:active|suspended|pending {choice}
  .invite_button /action {write} →@user_invite
  .export_csv /action {write}
  →@user_detail{user_id}

@user_detail{user_id} [#role:admin] 🔒
  .profile /table:field*value {read, write}
  .activity /list:event {read, filterable}
  .permissions /list:permission {read, write}
  .sessions /list:session {read}
  →$update_user {user_id, changes}
    !ok >> @user_detail {updated}
    !err >> @user_detail {error}
  →$suspend_user {user_id, reason}
    !ok >> @user_list {suspended}
    !err >> @user_detail {error}
  →$delete_user {user_id}
    !ok >> @user_list {deleted}
    !err >> @user_detail {error}
  ←@user_list

@user_invite [#role:admin] 🔒
  .emails /list:email {required, write}
  .role /choice:admin|editor|viewer {required, choice}
  .message /text {write}
  →$send_invites {emails, role, message}
    !ok >> @user_list {invites_sent}
    !err >> @user_invite {error}
  ←@user_list

@user_profile [#authenticated] 🔒
  .avatar /file {read, write}
  .name /text {read, write}
  .email /text {read}
  .mfa_status /boolean {read}
  .api_keys /list:api_key {read, write}
  →$update_profile {changes}
    !ok >> @user_profile {saved}
    !err >> @user_profile {error}

@team_settings [#role:admin] 🔒
  .members /list:user {read}
  .roles /list:role {read, write}
  .permissions_matrix /table:role*permission {read, write}
  →$update_roles {role_changes}
    !ok >> @team_settings {saved}
    !err >> @team_settings {error}

═══ L4: PORTES API ═══

$update_user :PATCH
  input: {user_id, changes}
  output: {updated_user}
  [#role:admin] (timeout: 5s, retry: 1)

$suspend_user :POST
  input: {user_id, reason}
  output: {success}
  [#role:admin] (timeout: 5s, retry: 0)

$delete_user :DELETE
  input: {user_id}
  output: {success}
  [#role:admin] (timeout: 10s, retry: 0)
  chain: revoke_sessions >> anonymize_data >> remove_from_teams >> delete_user >> notify_admins

$send_invites :POST
  input: {emails, role, message}
  output: {sent_count, failed}
  [#role:admin] (timeout: 30s, retry: 0)

$update_profile :PATCH
  input: {changes}
  output: {updated_profile}
  [#authenticated] (timeout: 5s, retry: 1)

$update_roles :PUT
  input: {role_changes}
  output: {updated_roles}
  [#role:admin] (timeout: 5s, retry: 1)

═══ L4: FLUX ═══

~user_search_index [every:5min]
  user_changes => transform_for_search => elasticsearch_upsert

═══ L5: ANOMALIES ═══

!critical(8) no_soft_delete [$delete_user]
  < user deletion is permanent, no soft delete
  = accidental deletion cannot be reversed

!attention(5) no_audit_trail [@user_detail]
  < permission changes not logged to audit trail
  = cannot track who changed what access

╚═══════════════════════════════════════════
