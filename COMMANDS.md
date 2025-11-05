# Setup

set -a; source .env; set +a

# PDP (Listing Details)

## Basic (uses .env as-is)

bun packages/cli/src/index.ts call -u "$AIRBNB_URL" -H "x-airbnb-api-key: $AIRBNB_API_KEY" -o responses/pdp.json

## Change locale/currency

bun packages/cli/src/index.ts call -u "$AIRBNB_URL" -q locale=de -q currency=USD -H "x-airbnb-api-key: $AIRBNB_API_KEY" -o responses/pdp_de_usd.json

## Switch listing by numeric ID (auto-encodes to GraphQL IDs)

bun packages/cli/src/index.ts call -u "$AIRBNB_URL" --listing-id 1450041297115139079 -H "x-airbnb-api-key: $AIRBNB_API_KEY" -o responses/pdp_1450041297115139079.json

# Stays Search (Listings)

## Basic (uses .env body)

bun packages/cli/src/index.ts call -X POST -u "$AIRBNB_SEARCH_URL" -H "x-airbnb-api-key: $AIRBNB_API_KEY" -H "content-type: application/json" -d "$AIRBNB_SEARCH_BODY" -o responses/stays.json

## Change currency

bun packages/cli/src/index.ts call -X POST -u "$AIRBNB_SEARCH_URL" -q currency=USD -H "x-airbnb-api-key: $AIRBNB_API_KEY" -H "content-type: application/json" -d "$AIRBNB_SEARCH_BODY" -o responses/stays_usd.json

## Update map bounds (mirrored to both search blocks automatically)

bun packages/cli/src/index.ts call -X POST -u "$AIRBNB_SEARCH_URL" --body-override 'variables.staysSearchRequest.rawParams.neLat=41.05' --body-override 'variables.staysSearchRequest.rawParams.neLng=-75.79' --body-override 'variables.staysSearchRequest.rawParams.swLat=40.97' --body-override 'variables.staysSearchRequest.rawParams.swLng=-75.84' -H "x-airbnb-api-key: $AIRBNB_API_KEY" -H "content-type: application/json" -d "$AIRBNB_SEARCH_BODY" -o responses/stays_bbox.json