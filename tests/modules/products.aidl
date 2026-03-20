╔A:products-module | node.js | postgres, elasticsearch, s3
╔v:1.2
╔source:src/products/
§ domain: product catalog management
§ SKU = stock keeping unit
§ PIM = product information management

═══ L1: LIEUX ═══

@product_catalog [#authenticated] 🔒
  .grid /list:product {read, filterable}
  .search /text {write, dynamic}
  .filters /list:filter {choice}
  .sort /choice:price|name|date|popularity {choice}
  .add_product /action {write} →@product_create
  →@product_detail{sku}

@product_detail{sku} [#authenticated] 🔒
  .info /table:field*value {read}
  .images /list:image {read}
  .variants /list:variant {read, write}
  .stock /number {read, dynamic}
  .pricing /table:tier*price {read, write}
  →$update_product {sku, changes}
    !ok >> @product_detail {saved}
    !err >> @product_detail {error}
  →@product_edit{sku}
  ←@product_catalog

@product_create [#role:admin] 🔒
  .name /text {required, write}
  .description /text {write}
  .category /choice:electronics|clothing|food|services {required, choice}
  .price /number {required, write}
  .images /list:file {write}
  →$create_product {product_data}
    !ok >> @product_detail {sku}
    !err >> @product_create {error}
  ←@product_catalog

@product_edit{sku} [#role:admin] 🔒
  .form /table:field*value {read, write}
  .images /list:file {read, write}
  →$update_product {sku, changes}
    !ok >> @product_detail {saved}
    !err >> @product_edit {error}
  ←@product_detail

@product_import [#role:admin] 🔒
  .csv_upload /file {required, write}
  .mapping /table:column*field {write}
  .preview /list:product {read}
  →$import_products {file, mapping}
    !ok >> @product_catalog {imported_count}
    !err >> @product_import {errors}

═══ L4: PORTES API ═══

$create_product :POST
  input: {product_data}
  output: {sku, product}
  [#role:admin] (timeout: 15s, retry: 0)

$update_product :PUT
  input: {sku, changes}
  output: {updated_product}
  [#authenticated] (timeout: 10s, retry: 1)

$import_products :POST
  input: {file, mapping}
  output: {imported_count, errors}
  [#role:admin] (timeout: 120s, retry: 0)

═══ L4: FLUX ═══

~product_search_sync [every:10min]
  product_changes => transform => elasticsearch_bulk

~image_processing [every:immediate]
  uploaded_image => resize => optimize => generate_thumbnails => upload_s3

═══ L5: ANOMALIES ═══

!attention(6) no_stock_alerts [@product_detail]
  < no automatic alerts when stock drops below threshold
  = products can go out of stock without notice

!attention(4) no_price_history [@product_edit]
  < price changes not versioned
  = cannot track pricing evolution or rollback

╚═══════════════════════════════════════════
