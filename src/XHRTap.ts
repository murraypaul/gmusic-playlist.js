/* an ajax tap to be able to peek into client/server comms */
export default class XHRTap {
    method?: string;
    url?: string;
    data?: any;
    sendcallback: () => void;
    _origOpen: { (method: string, url: string): void; (method: string, url: string, async: boolean, username?: string | null | undefined, password?: string | null | undefined): void; };
    _origSend: (body?: string | Document | Blob | ArrayBufferView | ArrayBuffer | FormData | URLSearchParams | ReadableStream<Uint8Array> | null | undefined) => void;

    constructor() {
        this.sendcallback = () => {
            console.log(this.method);
            console.log(this.url);
            console.log(this.data);
        };

        this._origOpen = XMLHttpRequest.prototype.open;
        this._origSend = XMLHttpRequest.prototype.send;
    }

    /* credits to: http://stackoverflow.com/questions/3596583/javascript-detect-an-ajax-event */
    inject() {
        var onOpen = (a?: string, b?: string) => {
            if (!a) a = '';
            if (!b) b = '';
            this._origOpen(a, b);
            this.method = a;
            this.url = b;
            if (a.toLowerCase() == 'get') {
                this.data = b.split('?')[1];
            }
        };

        var onSend = (a?: Document | BodyInit | null) => {
            if (!a) a = '';
            this._origSend(a);

            if (this.method && this.method.toLowerCase() == 'post') {
                this.data = a;
            }

            if (this.sendcallback) {
                this.sendcallback();
            }
        };

        XMLHttpRequest.prototype.open = onOpen;

        XMLHttpRequest.prototype.send = onSend;
    }

    getQuery() {
        return this.url && this.url.split('?')[1];
    }

    getQueryParams(): any {
        var params: any = {};
        const query = this.getQuery();
        
        if (!query) {
            return params;
        }

        var keyVals = query.split('&');

        for (var i = 0; i < keyVals.length; i++) {
            var keyVal = keyVals[i].split('=');
            params[keyVal[0]] = keyVal[1];
        }

        return params;
    }
}
