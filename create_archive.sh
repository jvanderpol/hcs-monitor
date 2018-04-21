rm hcs.zip
if git diff-index --quiet HEAD --; then
  echo "Creating archive"
  git archive -o hcs.zip HEAD
  /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome "https://chrome.google.com/webstore/developer/edit/cnmengpimakoahjflcbnpdbaoaaehema"
else
  echo "Unmodified changes, commit before creating archive"
fi
