/*
This Source Code Form is subject to the terms of the
Mozilla Public License, v. 2.0. 
If a copy of the MPL was not distributed with this file, 
You can obtain one at http://mozilla.org/MPL/2.0/.
*/
const {Cc, Ci} = require("chrome");
const winUtils = require("sdk/deprecated/window-utils");
const utils = require('sdk/window/utils');
const tabs = require("sdk/tabs");
const pref = require("sdk/preferences/service");
const store = require("sdk/simple-storage");
const eps = Cc['@mozilla.org/embedcomp/prompt-service;1']
            .getService(Ci.nsIPromptService); //embeded prompt service
const ww = Cc["@mozilla.org/embedcomp/window-watcher;1"]
            .getService(Ci.nsIWindowWatcher);

var window_observer = null;

exports.main = function(options, callbacks) {
    pref.set("browser.search.openintab", true);

    utils.windows().forEach(function(browser_window) {
        patch(browser_window);
    });

    function NewWindowObserver() {
        this.observe = function(aSubject, aTopic, aData) {
            if (aTopic == "domwindowopened") {
                aSubject.addEventListener("load", function() {
                    patch(aSubject);
                });
            }
        };
    }

    //listen for new windows
    window_observer = new NewWindowObserver();
    ww.registerNotification(window_observer);
};

exports.onUnload = function(reason) {
    if (reason == "disable") {
        //restore the setting to what it was before installation
        let check = {value: true};
        eps.alertCheck(null, "New Tab Overwrite",
        "Please restart Firefox to completly disable/uninstall New Tab Overwrite",
        "Make searches always open in current tab", check);
        if (check.value){
            pref.set("browser.search.openintab", false); 
        }
    }
    ww.unregisterNotification(window_observer);
};

function patch(browser_window) {
    try{
        if (browser_window.SearchInNewTab && browser_window.SearchInNewTab.patched){ 
            //avoid repatching caused by re-enabling
            return;
        }
    }catch(ex){// it might be a dead object
        return;
    }
    var searchbar = browser_window.document.getElementById("searchbar");
    if (searchbar === null) { //the window is not a browsers window
        return;
    }
    // console.log(searchbar.handleSearchCommand.toString());

    var ori = searchbar.handleSearchCommand.toString();
    var patched = ori.replace("function handleSearchCommand(aEvent)", "function (aEvent)");
    patched = patched.replace("this.doSearch(textValue, where);",
        "let new_tab_url = Cc[\"@mozilla.org/preferences-service;1\"] \
                .getService(Ci.nsIPrefService).getBranch(\"browser.newtab.url\").getCharPref(\"\");\
        if (gBrowser.getBrowserForTab(gBrowser.selectedTab).currentURI.spec == new_tab_url) {\n \
                where = \"current\";\n \
            }\n \
            this.doSearch(textValue, where);");
    patched = "(" + patched + ")";
    searchbar.handleSearchCommand = browser_window.eval(patched); //eval here should be fine.

    if (browser_window.Omnibar !== undefined) { // patch Omnibar if it exist
        ori = browser_window.Omnibar.handleSearchQuery.toString();
        patched = ori.replace("openintab = currentBrowser.currentURI.spec != \"about:blank\";",
            "openintab = currentBrowser.currentURI.spec != \"about:blank\" \
            && currentBrowser.currentURI.spec != O._prefSvc.getCharPref(\"browser.newtab.url\");");
        patched = "(function(url, event){ \
            var log = function(o) Cc[\"@mozilla.org/consoleservice;1\"].getService(Ci.nsIConsoleService).logStringMessage(o+'');\n \
            var O = window.Omnibar;\n \
            return (" + patched + ")(url, event)\n})";
        browser_window.Omnibar.handleSearchQuery = browser_window.eval(patched); //eval here should be fine.  
    }
    browser_window.SearchInNewTab = {patched : true};
}