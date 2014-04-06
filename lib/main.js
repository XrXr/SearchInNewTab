const winUtils = require("sdk/deprecated/window-utils");
const utils = require('sdk/window/utils');
const tabs = require("sdk/tabs");
const timers = require("sdk/timers");
const {Cc, Ci} = require("chrome");
/////set openintab to true
/////better monkey patch
/////clean up

exports.main = function(options, callbacks) {

    var active = utils.getMostRecentBrowserWindow();
    var searchbar = active.document.getElementById("searchbar");
    console.log(searchbar.handleSearchCommand.toString());
    searchbar.handleSearchCommand = function(aEvent) {
        var textBox = this._textbox;
        var textValue = textBox.value;
        var where = "current";
        if (aEvent && aEvent.originalTarget.getAttribute("anonid") == "search-go-button") {
            if (aEvent.button == 2)
                return;
            where = whereToOpenLink(aEvent, false, true);
        } else {
            var newTabPref = textBox._prefBranch.getBoolPref("browser.search.openintab");
            if ((aEvent && aEvent.altKey) ^ newTabPref)
                where = "tab";
        }
        if (tabs.activeTab.url == "about:newtab") {
            //searching in a new tab
            where = "current";
        }
        this.doSearch(textValue, where);
    };


    // var windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"]
        // .getService(Ci.nsIWindowMediator);
    // var bw = windowMediator.getMostRecentWindow("navigator:browser");
    var bw = utils.getMostRecentWindow();
    var ori = bw.Omnibar.handleSearchQuery.toString();
    var patched = ori.replace("openintab = currentBrowser.currentURI.spec != \"about:blank\";",
        "openintab = currentBrowser.currentURI.spec != \"about:blank\" && currentBrowser.currentURI.spec != \"about:newtab\";");

    patched = "(function(url, event){ \
    var log = function(o) Cc[\"@mozilla.org/consoleservice;1\"].getService(Ci.nsIConsoleService).logStringMessage(o+''); \
    var O = window.Omnibar; \
    return (" + patched + ")(url, event)})";
    bw.Omnibar.handleSearchQuery = bw.eval(patched);
};

exports.onUnload = function(reason) {
    if (reason == "disable"){
        const eps = Cc['@mozilla.org/embedcomp/prompt-service;1'].getService(Ci.nsIPromptService); //embeded prompt service
        eps.alert(null,"New Tab Overwrite","Please restart your browser to completly disable/uninstall New Tab Overwrite");
    }
};