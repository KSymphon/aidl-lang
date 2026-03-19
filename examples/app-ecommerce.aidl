╔A:shopflow | next.js 15 | supabase, zustand, stripe
§ domain: e-commerce platform for handmade goods
§ target: independent artisans and their customers
§ state: production, march 2026
§ SKU = stock keeping unit (unique product identifier)
§ SSE = server-sent events

═══ L1: LOCATIONS ═══

@home [#public]
  .featured_products /list:product {read}
    →@product/{slug}
  .search_bar /text {write} →@search
  .category_nav /list:category {read}
    →@category/{slug}
  →@cart →@login →@register

@category/{slug} [#public]
  .breadcrumb /list:ancestor {read} →@category/{slug_parent}
  .filters /map {choice} :: price_range, material, rating, availability
  .product_grid /list:product {read, filterable}
    →@product/{slug}
  .pagination /number {choice}
  ~source: getProductsByCategory() [server, supabase]
  ~render: ISR, revalidate 30min
  ←@home

@product/{slug} [#public]
  .images /list:blob {read}
  .title /text {read}
  .price /number {read}
  .description /text {read}
  .variants /list:variant {choice} :: size, color
  .stock_status /boolean {read, dynamic}
  .reviews /list:review {read}
  .seller /map {read} :: name, rating, location
    →@seller/{seller_id}
  ?authenticated ::
    .add_to_cart /action {write} →^store_cart.add{product_id, variant}
    .write_review /text {write} →$submit_review{product_id, rating, text}
      !ok >> add_review_to_list
      !err >> show_error
  ~source: $product_detail [cache: 10 minutes]
  ←@category/{slug}

@cart [#authenticated] 🔒
  .items /list:cart_item {read, write}
    .quantity /number {write, minimum: 1}
    .remove /action {write} →^store_cart.remove{item_id}
  .subtotal /number {read, dynamic}
  .shipping_estimate /number {read, dynamic}
  .total /number {read, dynamic}
  →@checkout
  ←@home

@checkout [#authenticated] 🔒
  .shipping_address /map {write, required} :: street, city, postal, country
  .payment_method /choice: card | paypal
  .order_summary /map {read} :: items, subtotal, shipping, total
  →$create_order{cart_items, address, payment}
    !ok >> @order_confirmation{order_id}
    !err >> @checkout {payment_error}
  ←@cart

@order_confirmation{order_id} [#authenticated] 🔒
  .order_number /text {read}
  .estimated_delivery /date {read}
  .items_summary /list:item {read}
  →@my_orders
  →@home

@my_orders [#authenticated] 🔒
  .orders /list:order {read} :: order_number, date, status, total
    →@order_detail{order_id}

@order_detail{order_id} [#authenticated, owner_only] 🔒
  .status /text {read} :: pending | processing | shipped | delivered
  .tracking /map {read} :: carrier, tracking_number, url
  .items /list:item {read}
  ←@my_orders

@seller/{seller_id} [#public]
  .name /text {read}
  .bio /text {read}
  .rating /number {read}
  .products /list:product {read}
    →@product/{slug}
  ←@home

@seller_dashboard [#authenticated, role:seller] 🔒
  .my_products /list:product {read, write}
  .orders_received /list:order {read}
  .revenue /map {read} :: today, this_month, total
  .add_product /action →@create_product

@create_product [#authenticated, role:seller] 🔒
  .title /text {required}
  .description /text {required}
  .price /number {required}
  .images /list:file {required, minimum: 1}
  .category /choice:category {required}
  .variants /list:variant {write}
  .stock /number {required}
  →$publish_product{form_data}
    !ok >> @seller_dashboard {message: product_published}
    !err >> @create_product {validation_errors}

@login [#public, redirect_if_authenticated >> @home]
  .email /text {required}
  .password /text {required}
  →$supabase_login{email, password}
    !ok >> @home {+session}
    !err >> @login {error_message}
  →@register

@register [#public, redirect_if_authenticated >> @home]
  .name /text {required}
  .email /text {required}
  .password /text {required, minimum: 8}
  .account_type /choice: buyer | seller
  →$supabase_register{name, email, password, type}
    !ok >> @home {+session}
    !err >> @register {error_message}
  →@login

@search [#public]
  .search_bar /text {write}
  .results /list:product {read, filterable}
  .filters /map {choice} :: category, price, rating
  ~source: $search_products

── persistent ──

@header [#public, all_pages]
  .logo →@home
  .nav :: @category/*, @search
  .cart_icon →@cart {badge: ^store_cart.count}
  .auth_button :: →@login | →@my_orders

═══ L4: STORES ═══

^store_cart [zustand]
  {items, count, subtotal}
  > @header {count}
  > @cart {all}
  > @checkout {items, subtotal}

^store_user [zustand]
  {id, name, email, account_type, authenticated}
  > @header {authenticated}
  > role_guards {account_type}

═══ L4: API GATES ═══

$product_detail :POST
  input: {slug}
  output: {product, seller, reviews[]}
  [#anonymous] (timeout: 5s, retry: 1)

$search_products :POST
  input: {query, ?category, ?price_range, ?rating, ?limit}
  output: {results[], total_count}
  [#anonymous] (timeout: 5s, retry: 1)

$create_order :POST
  input: {cart_items[], shipping_address, payment_method}
  output: {order_id, estimated_delivery}
  [#authenticated_jwt] (timeout: 30s, retry: 0)
  chain: validate_cart >> check_stock >> stripe_payment >> create_order_db >> send_confirmation_email >> response

$publish_product :POST
  input: {title, description, price, images[], category, variants[], stock}
  output: {product_created, slug}
  [#authenticated_jwt, role:seller] (timeout: 15s, retry: 0)

$submit_review :POST
  input: {product_id, rating, text}
  output: {review_created}
  [#authenticated_jwt] (timeout: 5s, retry: 0)

$supabase_login :AUTH
  input: {email, password}
  output: {session}

$supabase_register :AUTH
  input: {email, password, metadata}
  output: {session | email_confirmation}

═══ L4: DATA ═══

~database [postgresql + supabase]
  products :: id, title, slug, seller_id (FK users), category_id, description, price, images (JSONB), variants (JSONB), stock, rating_avg, review_count, active
    [RLS: read public, write seller owner only]
  users :: id (FK auth.users), name, email, account_type, avatar, bio
    [RLS: read public, write owner only]
  orders :: id, buyer_id (FK users), items (JSONB), shipping_address (JSONB), payment_id, status, total, created_at
    [RLS: read buyer or seller of items, write system only]
  reviews :: id, product_id (FK products), author_id (FK users), rating, text, created_at
    [RLS: read public, write authenticated, delete author only]
  categories :: id, name, slug, parent_id (self-ref), icon, sort_order

═══ L5: ANOMALIES ═══

!critical $search_products [#anonymous, no rate limit]
  < public endpoint with no request throttling
  = catalog scraping and abuse possible

!critical $create_order [stock check not atomic]
  < stock verified before payment but not locked
  = race condition: two users could buy last item simultaneously

!attention image_upload [no optimization pipeline]
  < seller uploads stored as-is in Supabase Storage
  = large images, no WebP conversion, no resizing

!attention review_system [no moderation]
  < no content filtering on $submit_review
  = spam and inappropriate content possible

!attention order_status [no webhook from carrier]
  < shipping status updated manually by seller
  = tracking information may be delayed or incorrect

╚═══════════════════════════════════════════
── AIDL format created by Kenny Symphon — aidl-lang ──
