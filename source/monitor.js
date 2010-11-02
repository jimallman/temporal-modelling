/*
   Copyright 2010 by the Rector and Visitors of the University of Virginia

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

// Flash monitoring and debugging utilities
// by Jim Allman (jim@ibang.com)

// This script provides support for a persistent "monitor" window, mainly
// as a diagnostic tool during development or trouble-shooting. Web pages
// (or embedded critters like Flash movies) can report errors, status, etc
// and they'll appear in a sort of "consold" window
//
// There should be a feature to enable/disable this reporting, perhaps a
// query-string variable in the main web page. There should also be a way
// for the user to "tune" the display, filtering by type of message or
// importance (eg. "show me only the truly urgent stuff")
//
// This replaces a prior version using Javascript and an HTML form in the 
// child window. Unfortunately, the death of the LiveConnext technology 
// (on Mac and most newer browsers, as of 2002) doomed this solution. But
// Flash MX comes to the rescue with its LocalConnection, which allows
// any two Flash movies to communicate between windows or programs.
//
// Should this include a way for users/testers to upload the console's 
// output via email or CGI, for further analysis?

/* TODO: Here's the priority filter logic; migrate this into the Flash monitor movie
function report( stuffToReport, priority )
{
  // Post the reported message to our second "monitor" window, if it's available. If it hasn't loaded
  // yet, spool all reports into a temporary string and "pre-pend" them when the window appears.
  // If the monitor was never launched, or has been dismissed by the user, bail out fast for best
  // performance during normal use.

  // Bail out fast if the user has dismissed the monitor window, or if we've suspended reporting
  if (!usingMonitor) return;	// monitor was never launched

  if ((monitorWindow == null) && (foundWindow)) {
    // user has dismissed the monitor window after it appeared--fuhgeddaboutit..
    return;	
  }

  // Attempt to read the current log-filter setting from a pull-down in the monitor
  var filterGadget = monitorWindow.document.forms[0].priorityFilter;
  if (filterGadget) {
    // its form has apparently loaded, read the widget
    chosenPosition = filterGadget.selectedIndex;
    reportFilter = filterGadget.options[chosenPosition].value;
  } else {
    // hasn't loaded yet; use default value to capture all reports
    reportFilter = "LOW";
  }
  
  // Has the user suspended reports? If so, bail out immediately
  if (reportFilter == "SUSPEND") return;

  // If we haven't seen the monitor-window yet, check for its textarea
  if (!foundWindow ) {
    if (monitorWindow.document.forms[0].JS_log) {	// its text-area has loaded
       // write in any spooled reports (that arrived before the window loaded)
      monitorWindow.document.forms[0].JS_log.value += strReportSpool +"---- END OF SPOOLED REPORTS ----\n";

       // flip the flag, we just found the window!
      foundWindow = true;
    }
  }
  

  // If no priority is specified, treat this report as LOW priority
  if (priority == null) {
  	priority = "LOW";
  }
  
  
  // Test msg priority, to set prefix or reject msg
  if (priority == "HIGH") {
    logPrefix = "<HI> "
  } else {
    if (priority == "MEDIUM") {
      if (reportFilter == "HIGH") {
        return;   // reject this msg
      }
      logPrefix = "<MED> "
    } else {
      // default behavior for "LOW" or unspecified priority
      if ((reportFilter == "HIGH") || (reportFilter == "MEDIUM")) {
        return;   // reject this msg
      }
      logPrefix = "<LO> "
    }
  }
  
  // Build the report string and put it into the display field (or the spool, if window hasn't loaded)
  var displayString = logPrefix + stuffToReport + "\n\n";

  // Append this (and a \n char) to the end if the monitor's scrolling log..
  if (!foundWindow) {	// spool this until the window loads
    strReportSpool += displayString;
  } else {
    monitorWindow.document.forms[0].JS_log.value += displayString;
    monitorWindow.focus();
  }
}
*/

function launchMonitor()
// Launch a child monitor window, set its initial properties, and return its handle. We'll
// also set a flag 'usingMonitor' = true; if it's false, we'll immediately disregard any reports
{
  // current suggested window size is 420w, 350h (but allow resize)
  monitorWindow = window.open("LC_monitor.html", "LocalConnectionMonitor", "status,resizable,width=430,height=240");
  // TODO: IF this fails on Navigator 2 (Mac), simply repeat the above call..

  monitorWindow.mainWindow = self;
  usingMonitor=true;
}

function killMonitor() 
// Hide the monitor window, if it's open
{
	if (!monitorWindow) return;
	
	monitorWindow.close();
	usingMonitor = false;
}

//set a flag so the frameset window knows that this script has completely loaded
var monitor_loaded = 1;

