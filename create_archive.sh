if git diff-index --quiet HEAD --; then
  version=`cat manifest.json | python -c "import sys, json; print(json.load(sys.stdin))['version']"`
  archive_file=hcs-$version.zip
  echo "Tagging $version"
  git tag $version
  if [ $? -ne 0 ]; then
    echo "Tagging failed, use 'git tag -d $version' if this tag can be deleted"
    exit 1
  fi
  echo "Creating archive $archive_file"
  rm -f $archive_file
  git archive -o $archive_file $version
  /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome "https://chrome.google.com/webstore/developer/edit/cnmengpimakoahjflcbnpdbaoaaehema"
else
  echo "Unmodified changes, commit before creating archive"
fi
