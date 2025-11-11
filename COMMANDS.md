# Setup

set -a; source .env; set +a

# PDP (Listing Details)

## Basic (uses .env as-is)

bun packages/cli/src/index.ts call -u "$AIRBNB_URL" -H "x-airbnb-api-key: $AIRBNB_API_KEY" -o responses/pdp.json

## Change locale/currency

bun packages/cli/src/index.ts call -u "$AIRBNB_URL" -q locale=de -q currency=USD -H "x-airbnb-api-key: $AIRBNB_API_KEY" -o responses/pdp_de_usd.json

## Switch listing by numeric ID (auto-encodes to GraphQL IDs)

bun packages/cli/src/index.ts call -u "$AIRBNB_URL" --listing-id 880457551611523268 -H "x-airbnb-api-key: $AIRBNB_API_KEY" -o responses/pdp_880457551611523268.json

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
  --poi-place "ChIJEWgOeY6pxYkRejsCNJWDL1U" \
  --poi-acp "t-g-ChIJEWgOeY6pxYkRejsCNJWDL1U" \
  --query-address "12 Polonia Ct, White Haven, PA 18661, United States" \
  --zoom-level 17 \
  --refinement-path "/homes" \
  --search-by-map \
  -H "x-airbnb-api-key: $AIRBNB_API_KEY" \
  -H "content-type: application/json" \
  -d "$AIRBNB_SEARCH_BODY" \
  -o responses/stays_whitehaven_single.json