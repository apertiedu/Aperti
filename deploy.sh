#!/bin/bash
echo "Building Aperti..."
npm run build
echo "Restarting PM2..."
pm2 restart aperti
echo "Deployed."
