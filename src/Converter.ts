import { STRU, OptionalString } from "./gmusic-playlist.user";
import Song from "./Song";

/* convert between different data types */
export default class Converter {
    csvchar: string = ',';
    tprefix: string | null = '_';
    constructor(prefix?: string | null) {
        if (prefix !== undefined) {
            this.tprefix = prefix;
        }
    }
    quoteCsv(value: string) {
        if (STRU.contains(value, '"') || STRU.contains(value, this.csvchar)) {
            value = value.replace(/"/g, '""');
            value = '"' + value + '"';
        }
        return value;
    }
    unquoteCsv(value: string) {
        if (value.length > 0 && value[0] === '"' && value[value.length - 1] === '"') {
            value = value.substring(1, value.length - 1);
            value = value.replace(/""/g, '"');
        }
        if (value === 'null' || value === '') {
            return null;
        }
        if (value === 'undefined') {
            return undefined;
        }
        return value;
    }
    csvToArray(csv: string) {
        var arr: OptionalString[] = [];
        var val = '';
        var ignoreSep = false;
        for (const char of csv) {
            if (char === this.csvchar && !ignoreSep) {
                arr.push(this.unquoteCsv(val));
                val = '';
                return;
            }
            else if (char === '"') {
                ignoreSep = !ignoreSep;
            }
            val += char;
        }
        arr.push(this.unquoteCsv(val));
        return arr;
    }
    arrayToCsv(arr: string[]) {
        var csv = '';
        arr.forEach((val) => {
            csv += this.quoteCsv(String(val)) + ',';
        });
        return csv.substring(0, csv.length - 1);
    }
    struct(obj: Song): OptionalString[] {
        var struct: (keyof Song)[] = [];
        for (let key in obj) {
            if (!STRU.startswith(key, this.tprefix)) {
                struct.push(key as (keyof Song));
            }
        }
        return struct;
    }
    objectToArray(obj: Song, structure?: OptionalString[]) {
        var arr: any[] = [];
        structure = structure || this.struct(obj);
        structure.forEach((key) => {
            if (key) arr.push((obj as any)[key]);
        });
        return arr;
    }
    arrayToObject(arr: any, obj: any, structure?: OptionalString[]) {
        structure = structure || this.struct(obj);
        obj = !obj ? {} : obj;
        structure.forEach((key, idx) => {
            if (!key)
                return;
            obj[key] = arr[idx];
        });

        return obj;
    }
    update(orig: any, update: {[x: string]: any;}) {
        for (let key in orig) {
            if (!orig[key] && update[key]) {
                orig[key] = update[key];
            }
        }
        return orig;
    }
    clone(src: any, dest?: any) {
        dest = !dest ? new src.constructor() : dest;
        return this.arrayToObject(this.objectToArray(src), dest);
    }
}
