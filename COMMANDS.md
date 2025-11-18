# Setup

set -a; source .env; set +a

# PDP (Listing Details)

## Basic (uses .env as-is)

bun packages/cli/src/index.ts call -u "$AIRBNB_URL" -H "x-airbnb-api-key: $AIRBNB_API_KEY" -o responses/pdp.json

## Change locale/currency

bun packages/cli/src/index.ts call -u "$AIRBNB_URL" -q locale=de -q currency=USD -H "x-airbnb-api-key: $AIRBNB_API_KEY" -o responses/pdp_de_usd.json

## Switch listing by numeric ID (auto-encodes to GraphQL IDs)

bun packages/cli/src/index.ts call -u "$AIRBNB_URL" --listing-id 880457551611523268 -H "x-airbnb-api-key: $AIRBNB_API_KEY" -o responses/pdp_whitehaven.json

**Note:** When using `--listing-id`, the CLI will also generate `<base>_pdp.json` containing an array of listingDetails objects (guests, bedrooms, beds, baths, description, lat, lng, propertyDetailPlatform) as auxiliary output alongside the raw response JSON specified with `-o`.

# Stays Search (Listings)

## Basic (uses .env body)

bun packages/cli/src/index.ts call -X POST -u "$AIRBNB_SEARCH_URL" -H "x-airbnb-api-key: $AIRBNB_API_KEY" -H "content-type: application/json" -d "$AIRBNB_SEARCH_BODY" -o responses/stays.json

## Change currency

bun packages/cli/src/index.ts call -X POST -u "$AIRBNB_SEARCH_URL" -q currency=USD -H "x-airbnb-api-key: $AIRBNB_API_KEY" -H "content-type: application/json" -d "$AIRBNB_SEARCH_BODY" -o responses/stays_usd.json

## Update map bounds (mirrored to both search blocks automatically)

**--bbox flag patches rawParams.neLat/neLng/swLat/swLng in both request blocks**

### White Haven USA (12 Polonia Ct, White Haven, PA 18661, USA)

bun packages/cli/src/index.ts call -X POST -u "$AIRBNB_SEARCH_URL" \
  --bbox "41.014581780039535,-75.81544190595048,41.01436674658937,-75.81554452140006" \
  --query-address "12 Polonia Ct, White Haven, PA 18661, United States" \
  --zoom-level 17 \
  --refinement-path "/homes" \
  --search-by-map \
  -H "x-airbnb-api-key: $AIRBNB_API_KEY" \
  -H "content-type: application/json" \
  -d "$AIRBNB_SEARCH_BODY" \
  -o responses/stays_whitehaven_single.json

### Fennville, Michigan USA (1786 Morning Glory Lane, Fennville, Michigan, USA)

bun packages/cli/src/index.ts call -X POST -u "$AIRBNB_SEARCH_URL" \
  --bbox "42.54826130737213,-86.23770074855929,42.54790113452498,-86.23793458777914" \
  --query-address "1786 Morning Glory Lane, Fennville, Michigan, United States" \
  --zoom-level 17 \
  --refinement-path "/homes" \
  --search-by-map \
  -H "x-airbnb-api-key: $AIRBNB_API_KEY" \
  -H "content-type: application/json" \
  -d "$AIRBNB_SEARCH_BODY" \
  -o responses/stays_fennville_single.json

### San Pedro, CA USA (918 S Leland St Unit 2, San Pedro, CA 90731, USA)

bun packages/cli/src/index.ts call -X POST -u "$AIRBNB_SEARCH_URL" \
  --bbox "33.73686973911878,-118.30032618062285,33.734924025747034,-118.30147430987995" \
  --query-address "918 South Leland Street unit 2, San Pedro, CA 90731, USA" \
  --zoom-level 17 \
  --refinement-path "/homes" \
  --search-by-map \
  -H "x-airbnb-api-key: $AIRBNB_API_KEY" \
  -H "content-type: application/json" \
  -d "$AIRBNB_SEARCH_BODY" \
  -o responses/stays_sanpedro_single.json

### Morehead City, NC, USA (913 Bridges St, Morehead City, NC 28557, USA)

bun packages/cli/src/index.ts call -X POST -u "$AIRBNB_SEARCH_URL" \
  --bbox "34.722407160598,-76.71516935375814,34.72217981453618,-76.71526663098314" \
  --query-address "913 Bridges Street Ext, Morehead City, NC 28557, United States" \
  --zoom-level 17 \
  --refinement-path "/homes" \
  --search-by-map \
  -H "x-airbnb-api-key: $AIRBNB_API_KEY" \
  -H "content-type: application/json" \
  -d "$AIRBNB_SEARCH_BODY" \
  -o responses/stays_moreheadcity_single.json

### Stevensville, MD, USA (102 Great Neck Rd, Stevensville, MD 21666, USA)

bun packages/cli/src/index.ts call -X POST -u "$AIRBNB_SEARCH_URL" \
  --bbox "38.957683636119384,-76.3404773324412,38.957468546536575,-76.34057460966619" \
  --query-address "102 Great Neck Rd Stevensville, Md 21666" \
  --zoom-level 17 \
  --refinement-path "/homes" \
  --search-by-map \
  -H "x-airbnb-api-key: $AIRBNB_API_KEY" \
  -H "content-type: application/json" \
  -d "$AIRBNB_SEARCH_BODY" \
  -o responses/stays_stevensville_single.json