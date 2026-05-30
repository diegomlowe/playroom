#!/bin/bash
set -e

# Frontend-only build for Vercel
export VITE_TAROBASE_APP_ID=69f0360a525daf9178c8a6a7
export VITE_CHAIN=solana_mainnet
export VITE_RPC_URL=https://api.mainnet-beta.solana.com
export VITE_ENV=LIVE

# Run TypeScript check (excluding partyserver)
npx tsc --project tsconfig.app.json --noEmit

# Build with Vite
npx vite build
