import Status from "./Status";
import StringFunctions from "./StringFunctions";
import SessionInfo from "./SessionInfo";
import XDoc from "./XDoc";
import Exporter from "./Exporter";
import Importer from "./Importer";
import XHRTap from "./XHRTap";

export var debug = (...args: any[]) => { console.log(...args); };
export var trace = (...args: any[]) => { console.log(...args); };
export var stat = new Status();
export var STRU = new StringFunctions();
export var session = new SessionInfo();

export type OptionalString = string | null | undefined;

/* wait for the UI to fully load and then insert the import/export controls */
var addui = function () {
    var ui = new XDoc(document);

    var menu = ui.search('//div[@class="nav-section-divider"]')[0];
    var inputui = ui.create('input', false, { 'type': 'file' });
    var importui = ui.create('div', [ui.create('h4', 'Import Playlists'), inputui]);

    var exportlink = ui.create('a', 'Export Playlists', { 'href': '#exportCSV' });
    var exportui = ui.create('div', ui.create('h4', exportlink));
    var statusout = ui.create('h6', 'ready');
    var statusui = ui.create('div', [statusout]);

    stat.element = statusout;

    var exporter = new Exporter();
    exporter.listenTo(exportlink);

    var importer = new Importer();
    importer.listenTo(inputui);

    if (menu) {
        menu.appendChild(importui);
        menu.appendChild(exportui);
        menu.appendChild(statusui);
    } else {
        console.log('unable to locate menu element');
    }
};

window.addEventListener('load', addui, false);

var tap = new XHRTap();

/* pull out session information from the clinet/server comms */
tap.sendcallback = () => session.fromTap(tap);
tap.inject();



