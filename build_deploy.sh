#!/bin/bash
echo "🚀 Starting Build Process..."

# 1. Build Client (Frontend)
echo "📦 Building Client..."
cd client
npm install
npm run build
cd ..

# 2. Setup Server (Backend)
echo "⚙️ Setting up Server..."
cd server
npm install
cd ..

echo "✅ Build Complete! Ready to deploy."
