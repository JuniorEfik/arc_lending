#!/bin/bash

# Clean script for Arc Lending project

echo "🧹 Cleaning project..."

# Frontend build artifacts
echo "Cleaning frontend build artifacts..."
rm -rf frontend/.next
rm -rf frontend/out
rm -rf frontend/node_modules/.cache

# Hardhat artifacts
echo "Cleaning Hardhat artifacts..."
rm -rf artifacts
rm -rf cache
rm -rf typechain-types

# Node modules (optional - uncomment if needed)
# echo "Cleaning node_modules..."
# rm -rf node_modules
# rm -rf frontend/node_modules

# Logs
echo "Cleaning logs..."
find . -name "*.log" -not -path "./node_modules/*" -not -path "./frontend/node_modules/*" -delete

echo "✅ Cleanup complete!"


