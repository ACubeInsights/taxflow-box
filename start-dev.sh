#!/bin/bash
# Start TaxFlow dev environment

if [ ! -f "box_config.json" ]; then
    echo "Error: box_config.json not found in project root."
    exit 1
fi

for dir in box-wrapper-service taxflow-api taxflow-app; do
    [ ! -d "$dir/node_modules" ] && (cd "$dir" && npm install && cd ..)
done

if [[ "$OSTYPE" == "darwin"* ]]; then
    osascript -e 'tell application "Terminal" to do script "cd \"'$(pwd)'/taxflow-api\" && npm run dev"'
    osascript -e 'tell application "Terminal" to do script "cd \"'$(pwd)'/taxflow-app\" && npm run dev"'
else
    echo "Run in separate terminals:"
    echo "  cd taxflow-api && npm run dev"
    echo "  cd taxflow-app && npm run dev"
fi

echo ""
echo "API:      http://localhost:3001"
echo "Frontend: http://localhost:5173"
