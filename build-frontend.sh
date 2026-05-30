#!/bin/bash
set -e

# Ensure we're in the project root
cd "$(dirname "$0")"

# Frontend-only build for Vercel
export VITE_TAROBASE_APP_ID=69f0360a525daf9178c8a6a7
export VITE_CHAIN=solana_mainnet
export VITE_RPC_URL=https://api.mainnet-beta.solana.com
export VITE_ENV=LIVE

# Build with Vite (includes TypeScript check)
npx vite build
