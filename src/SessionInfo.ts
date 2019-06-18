import GMusic from "./GMusic";
import Songlist from "./Songlist";
import XHRTap from "./XHRTap";

/* session information needed in order to send reqs to server */
export default class SessionInfo {
    libraryCache?: Songlist;
    dv?: any;
    xtcode?: any;
    sessionid?: any;
    obfid?: any;
    oninit?: () => void;

    constructor() {
        /* listener for when the session first becomes valid. */
        this.oninit = () => {
            new GMusic(this).getLibrary().then((songlist: Songlist) => {
                console.log('session active. ' + songlist.songs.length + ' songs loaded. ');
            });
        };
    }

    isValid() {
        return this.xtcode && this.sessionid && this.obfid;
    }

    getQuery() {
        return 'u=0&xt=' + this.xtcode + '&dv=' + this.dv + '&obfid=' + this.obfid;
    }

    getPostArray() {
        return [[this.sessionid, 1], null];
    }

    /* populate session info from an xhr tap */
    fromTap(tap: XHRTap) {
        if (this.isValid()) {
            return;
        }
        
        var qps = tap.getQueryParams();

        if ('xt' in qps && 'obfid' in qps && 'dv' in qps) {
            this.xtcode = qps.xt;
            this.obfid = qps.obfid;
            this.dv = qps.dv;
        }

        if (tap.method && tap.method.toLowerCase() == 'post') {
            try {
                this.sessionid = JSON.parse(tap.data)[0][0];
                // eslint-disable-next-line no-empty
            }
            catch (err) { }
        }

        if (this.isValid()) {
            if (this.oninit) {
                this.oninit();
                this.oninit = undefined;
            }
        }
    }
}
