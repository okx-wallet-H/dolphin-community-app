#!/bin/bash
set -e

# Create cache dir for react-native-css-interop
mkdir -p node_modules/react-native-css-interop/.cache
touch node_modules/react-native-css-interop/.cache/web.css

# Build Expo web
npx expo export --platform web

# Create Vercel Build Output API structure
mkdir -p .vercel/output/static
mkdir -p .vercel/output/functions/api.func

# Copy static files
cp -r dist/* .vercel/output/static/

# Create config.json
cat > .vercel/output/config.json << 'EOF'
{
  "version": 3,
  "routes": [
    { "src": "/api/(.*)", "dest": "/api" },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
EOF

# Create API function
cat > .vercel/output/functions/api.func/.vc-config.json << 'EOF'
{
  "runtime": "nodejs20.x",
  "handler": "index.js",
  "launcherType": "Nodejs"
}
EOF

# Bundle API with esbuild
npx esbuild api/index.ts --bundle --platform=node --target=node20 --outfile=.vercel/output/functions/api.func/index.js --external:express

echo "Build complete!"
