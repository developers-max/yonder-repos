#!/bin/bash

# Local Docker build and test script
# Tests the Docker image locally before deploying to Cloud Run

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

IMAGE_NAME="yonder-enrich-test"
CONTAINER_NAME="yonder-enrich-test-container"
PORT=3000

echo -e "${GREEN}🐳 Building Docker image locally...${NC}"

# Navigate to project root and build the image
cd ../../..
docker build -t $IMAGE_NAME -f src/api/gcloud_deployment/Dockerfile .

echo -e "${GREEN}✅ Image built successfully!${NC}"
echo ""
echo -e "${YELLOW}📊 Image details:${NC}"
docker images | grep $IMAGE_NAME

echo ""
echo -e "${YELLOW}🧪 Starting container for testing...${NC}"
echo -e "${YELLOW}   Note: This uses .env file for local secrets${NC}"
echo ""

# Stop and remove existing container if it exists
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

# Run the container
# Mount .env file for local testing (in production, Cloud Run uses Secret Manager)
docker run -d \
  --name $CONTAINER_NAME \
  -p $PORT:8080 \
  -e PORT=8080 \
  --env-file .env \
  $IMAGE_NAME

echo -e "${GREEN}✅ Container started!${NC}"
echo ""
echo -e "${YELLOW}⏳ Waiting for API to be ready (15 seconds)...${NC}"
sleep 15

echo ""
echo -e "${YELLOW}🔍 Testing endpoints:${NC}"
echo ""

# Test health endpoint
echo -e "${YELLOW}1️⃣  Testing /health endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s http://localhost:$PORT/health)
echo "$HEALTH_RESPONSE" | jq '.' || echo "$HEALTH_RESPONSE"

if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo -e "${GREEN}   ✅ Health check passed${NC}"
else
    echo -e "${RED}   ❌ Health check failed${NC}"
fi

echo ""
echo -e "${YELLOW}2️⃣  Testing /api/enrich/info endpoint...${NC}"
INFO_RESPONSE=$(curl -s http://localhost:$PORT/api/enrich/info)
echo "$INFO_RESPONSE" | jq '.title, .version, .available_enrichments | length' || echo "$INFO_RESPONSE"

echo ""
echo -e "${YELLOW}3️⃣  Testing /api/enrich/location endpoint (Lisbon, Portugal)...${NC}"
ENRICH_RESPONSE=$(curl -s -X POST http://localhost:$PORT/api/enrich/location \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 38.7223,
    "longitude": -9.1393,
    "store_results": false,
    "translate": false
  }')

echo "$ENRICH_RESPONSE" | jq '{country, municipality: .municipality.name, enrichments_run, enrichments_skipped}' || echo "$ENRICH_RESPONSE"

if echo "$ENRICH_RESPONSE" | grep -q "country"; then
    echo -e "${GREEN}   ✅ Enrichment endpoint working${NC}"
else
    echo -e "${RED}   ❌ Enrichment endpoint failed${NC}"
fi

echo ""
echo -e "${YELLOW}📊 Container logs (last 20 lines):${NC}"
docker logs --tail 20 $CONTAINER_NAME

echo ""
echo -e "${GREEN}✅ Docker image test complete!${NC}"
echo ""
echo -e "${YELLOW}📋 Useful commands:${NC}"
echo -e "   # View real-time logs"
echo -e "   docker logs -f $CONTAINER_NAME"
echo ""
echo -e "   # Access container shell"
echo -e "   docker exec -it $CONTAINER_NAME sh"
echo ""
echo -e "   # Stop container"
echo -e "   docker stop $CONTAINER_NAME"
echo ""
echo -e "   # Remove container"
echo -e "   docker rm $CONTAINER_NAME"
echo ""
echo -e "   # Remove image"
echo -e "   docker rmi $IMAGE_NAME"
echo ""
echo -e "${YELLOW}🌐 API is running at: http://localhost:$PORT${NC}"
echo -e "${YELLOW}   Press Ctrl+C when done testing, then run: docker stop $CONTAINER_NAME${NC}"
