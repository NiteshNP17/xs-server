#!/usr/bin/env bash
# exit on errorset -o errexit

npm install
npx playwright install chromium-headless-shell
# npm run build # uncomment if required

# Store/pull Playwright cache with build cache
if [[ ! -d $PLAYWRIGHT_BROWSERS_PATH]]; then 
  echo "...Copying Playwright Cache from Build Cache" 
  cp -R $XDG_CACHE_HOME/playwright/ $PLAYWRIGHT_BROWSERS_PATH
else 
  echo "...Storing Playwright Cache in Build Cache" 
  cp -R $PLAYWRIGHT_BROWSERS_PATH $XDG_CACHE_HOME
fi