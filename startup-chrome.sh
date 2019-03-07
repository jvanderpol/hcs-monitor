restart=1

while getopts "r:" OPTION; do
  case $OPTION in
    r)
      restart=$OPTARG
      ;;
  esac
done

export DISPLAY=:0.0
echo "Killing chrome gracefully"
killall -r chromium-browse
sleep 5
echo "Force killing chrome if it is still running"
killall -9 -r chromium-browse
if [ "$restart" -eq "1" ]
then
  echo "Starting chrome to get rid of restore window"
  /usr/bin/chromium-browser &
  sleep 20
  echo "Killing chrome again"
  killall -r chromium-browse
else
  echo "Skipping chrome restart"
fi
#/usr/bin/chromium-browser --kiosk --disable-restore-session-state --remote-debugging-port=debug_port_number chrome-extension://cnmengpimakoahjflcbnpdbaoaaehema/window.html &
/usr/bin/chromium-browser --kiosk --disable-restore-session-state chrome-extension://cnmengpimakoahjflcbnpdbaoaaehema/window.html &
