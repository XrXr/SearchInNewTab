/*
This Source Code Form is subject to the terms of the
Mozilla Public License, v. 2.0.
If a copy of the MPL was not distributed with this file,
You can obtain one at http://mozilla.org/MPL/2.0/.
*/
const utils = require('sdk/window/utils');
const tabs = require("sdk/tabs");
const pref = require("sdk/preferences/service");
const store = require("sdk/simple-storage");
const { Cc, Ci } = require("chrome");
const ww = Cc["@mozilla.org/embedcomp/window-watcher;1"]
            .getService(Ci.nsIWindowWatcher);

const NEWTAB_URL = 'about:newtab';

let window_observer = null;

// store original setting, this only get cleared when add-on is disabled
// to prevent rewriting
if (!store.storage.pref_before_install){
    store.storage.pref_before_install = pref.get("browser.search.openintab");
}
pref.set("browser.search.openintab", true);

utils.windows().forEach(patch);

function NewWindowObserver() {
    this.observe = function(aSubject, aTopic) {
        if (aTopic == "domwindowopened") {
            aSubject.addEventListener("load", function() {
                patch(aSubject);
            }, false);
        }
    };
}
//listen for new windows
window_observer = new NewWindowObserver();
ww.registerNotification(window_observer);

function patch (browser_window) {
    // patch only when it is a browser window
    if (!browser_window.search_in_newtab && browser_window.gBrowser){
        browser_window.search_in_newtab = {
            oriUILinkIn: browser_window.openUILinkIn,
            oriLoadOneTab: browser_window.gBrowser.loadOneTab};
        // original function signature openUILinkIn(url, where, aAllowThirdPartyFixup, aPostData, aReferrerURI)
        browser_window.openUILinkIn = function() {
            const args = arguments;
            try {
                if (args[1] == "tab" && args[0] != NEWTAB_URL &&
                    tabs.activeTab.url == NEWTAB_URL){
                    args[1] = "current";
                }
            } catch(err) {console.error(err);}
            return browser_window.search_in_newtab.oriUILinkIn.apply(this, args);
        };
        // original signature loadOneTab( URL, referrerURI, charset, postData, loadInBackground, allowThirdPartyFixup )
        //                                 0        1          2        3             4                    5
        browser_window.gBrowser.loadOneTab = function() {
            try{
                if (arguments[0] != NEWTAB_URL &&
                    tabs.activeTab.url == NEWTAB_URL &&
                    // the following set of constraints are observed from the source code of
                    // Omnibar, and are in place to minimize incompatibility
                    arguments[1] === null && arguments[2] === null &&
                    arguments[4] === false && arguments[5] === true){
                    return browser_window.search_in_newtab.oriUILinkIn.call(this, arguments[0],
                        "current", arguments[5], arguments[3], arguments[1]);
                }
            } catch(err) {console.error(err);}
            return browser_window.search_in_newtab.oriLoadOneTab.apply(this, arguments);
        };
    }
}

exports.onUnload = function() {
    //restore preference
    pref.set("browser.search.openintab", store.storage.pref_before_install);
    // delete stored pref for next enable
    delete store.storage.pref_before_install;
    utils.windows().forEach(function(browser_window) {
        // unpatching like this might cause issues if other add-ons patched
        // the function in a similar way. see http://mzl.la/TZdTjl
        // A flag can't be used since the function object will be dead
        if (browser_window.search_in_newtab){
            browser_window.openUILinkIn = browser_window.search_in_newtab.oriUILinkIn;
            browser_window.gBrowser.loadOneTab = browser_window.search_in_newtab.oriLoadOneTab;
            delete browser_window.search_in_newtab;
        }
    });
    ww.unregisterNotification(window_observer);
};