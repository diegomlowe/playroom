#!/bin/bash
set -e

# Ensure devDependencies are installed
npm install --include=dev

# Run vite build with environment variables
export VITE_TAROBASE_APP_ID=69f0360a525daf9178c8a6a7
export VITE_CHAIN=solana_mainnet
export VITE_RPC_URL=https://api.mainnet-beta.solana.com
export VITE_ENV=LIVE

npx vite build
