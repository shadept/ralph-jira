#!/bin/bash

# Ralph JIRA Setup Script

echo "🚀 Ralph JIRA Setup"
echo "==================="
echo ""

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js version must be 20 or higher. Current: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "📝 Creating .env.local from template..."
    if [ -f ".env.example" ]; then
        cp .env.example .env.local
        echo "⚠️  Please edit .env.local and add your OPENAI_API_KEY"
    else
        echo "OPENAI_API_KEY=your-key-here" > .env.local
        echo "⚠️  Please edit .env.local and add your OPENAI_API_KEY"
    fi
    echo ""
fi

# Check if plans directory exists
if [ ! -d "plans" ]; then
    echo "📁 Creating plans directory..."
    mkdir -p plans/runs
    echo ""
fi

# Check if progress.txt exists
if [ ! -f "progress.txt" ]; then
    echo "📄 Creating progress.txt..."
    echo "# Project Progress Log" > progress.txt
    echo ""
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env.local and add your OpenAI API key"
echo "  2. Run 'npm run dev' to start the webapp"
echo "  3. Open http://localhost:3000"
echo ""
echo "To run the AI runner:"
echo "  npm run pm:run"
echo ""
