import { debug } from "./gmusic-playlist.user";

/* XML document functions */
export default class XDoc {
    doc: Document;
    
    constructor(document: Document) {
        this.doc = document;
    }

    /* create a new element for the doc */
    create<T = HTMLElement>(tagName: string, tagValue: any, attributes?: {
        [x: string]: any;
        type?: string;
        href?: string;
        download?: string;
    }): T {
        var el = this.doc.createElement(tagName);
        if (typeof tagValue === 'string') {
            el.appendChild(this.doc.createTextNode(tagValue));
        }
        else if (tagValue && typeof tagValue === 'object') {
            for (var i = 0; i < tagValue.length; i++) {
                el.appendChild(tagValue[i]);
            }
        }
        else if (tagValue) {
            el.appendChild(tagValue);
        }
        if (attributes) {
            for (var key in attributes) {
                el.setAttribute(key, attributes[key]);
            }
        }
        return el as unknown as T;
    }
    
    /* get a list of elements matching the xpath */
    search(xpath: string) {
        var results = [];
        var xpathresults = document.evaluate(xpath, this.doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for (var i = 0; i < xpathresults.snapshotLength; i++) {
            results.push(xpathresults.snapshotItem(i));
        }
        debug('searching for xpath' + xpath);
        return results;
    }

    /* create a XDoc from a string (text/html by default) */
    static fromString(string: string, type?: SupportedType) {
        if (!type) {
            type = 'text/html';
        }
        var parser = new DOMParser();
        return new XDoc(parser.parseFromString(string, type));
    }
}
