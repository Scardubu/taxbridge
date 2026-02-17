#!/bin/bash

set -e

echo ""
echo "🧹 TaxBridge Nuclear Cache Wipe V6.0"
echo "====================================="
echo ""

cleaned=0
start_time=$(date +%s)

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
GRAY='\033[0;37m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${YELLOW}1️⃣  Clearing Metro bundler cache...${NC}"
rm -rf $TMPDIR/metro-* .metro 2>/dev/null || true
((cleaned++))
echo -e "${GREEN}   ✅ Metro cache cleared${NC}"

echo -e "${YELLOW}2️⃣  Clearing node_modules...${NC}"
if [ -d "node_modules" ]; then
    rm -rf node_modules
    ((cleaned++))
    echo -e "${GREEN}   ✅ node_modules cleared${NC}"
else
    echo -e "${GRAY}   ⏭️  node_modules not found (skip)${NC}"
fi

echo -e "${YELLOW}3️⃣  Clearing Expo cache...${NC}"
npx expo start --clear &> /dev/null || true
((cleaned++))
echo -e "${GREEN}   ✅ Expo cache cleared${NC}"

echo -e "${YELLOW}4️⃣  Clearing Watchman...${NC}"
if command -v watchman &> /dev/null; then
    watchman watch-del-all &> /dev/null || true
    ((cleaned++))
    echo -e "${GREEN}   ✅ Watchman cleared${NC}"
else
    echo -e "${GRAY}   ⏭️  Watchman not installed (skip)${NC}"
fi

echo -e "${YELLOW}5️⃣  Clearing Android build cache...${NC}"
if [ -d "android" ]; then
    cd android
    rm -rf build app/build .gradle .cxx 2>/dev/null || true
    cd ..
    ((cleaned++))
    echo -e "${GREEN}   ✅ Android cache cleared${NC}"
else
    echo -e "${GRAY}   ⏭️  Android directory not found (skip)${NC}"
fi

echo -e "${YELLOW}6️⃣  Clearing iOS build cache...${NC}"
if [ -d "ios" ]; then
    cd ios
    rm -rf build Pods Podfile.lock DerivedData 2>/dev/null || true
    cd ..
    ((cleaned++))
    echo -e "${GREEN}   ✅ iOS cache cleared${NC}"
else
    echo -e "${GRAY}   ⏭️  iOS directory not found (skip)${NC}"
fi

if [[ "$1" == "--global" ]]; then
    echo -e "${YELLOW}7️⃣  Clearing global npm cache...${NC}"
    npm cache clean --force
    ((cleaned++))
    echo -e "${GREEN}   ✅ Global npm cache cleared${NC}"
fi

echo -e "${YELLOW}8️⃣  Reinstalling dependencies...${NC}"
npm ci --prefer-offline=false --no-audit --loglevel=error
echo -e "${GREEN}   ✅ Dependencies reinstalled${NC}"

end_time=$(date +%s)
duration=$((end_time - start_time))

echo ""
echo -e "${CYAN}=====================================${NC}"
echo -e "${GREEN}✅ Cache wipe complete!${NC}"
echo -e "   Cleaned: $cleaned cache locations"
echo -e "   Duration: ${duration}s"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo "  1. Run: npx expo-doctor"
echo "  2. Run: npx expo prebuild --clean"
echo "  3. Build: eas build --platform all --profile production --clear-cache"
echo ""
