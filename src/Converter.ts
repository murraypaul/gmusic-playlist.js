import { OptionalString } from "./gmusic-playlist.user";
import Song from "./Song";
import { contains, startswith } from "./StringFunctions";

/* convert between different data types */
export default class Converter {
    static csvchar: string = ',';

    static quoteCsv(value: string) {
        if (contains(value, '"') || contains(value, Converter.csvchar)) {
            value = value.replace(/"/g, '""');
            value = '"' + value + '"';
        }

        return value;
    }

    private static unquoteCsv(value: string) {
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

    static csvToArray(csv: string) {
        var arr: OptionalString[] = [];
        var val = '';
        var ignoreSep = false;
        for (const char of csv) {
            if (char === Converter.csvchar && !ignoreSep) {
                arr.push( Converter.unquoteCsv(val));
                val = '';
                return;
            }
            else if (char === '"') {
                ignoreSep = !ignoreSep;
            }
            val += char;
        }
        arr.push(Converter.unquoteCsv(val));
        return arr;
    }

    static arrayToCsv(arr: OptionalString[]) {
        var csv = '';
        arr.forEach((val) => {
            csv += this.quoteCsv(String(val)) + ',';
        });
        return csv.substring(0, csv.length - 1);
    }

    static struct<T>(obj: T): (keyof T)[] {
        var struct: (keyof T)[] = [];
        for (let key in obj) {
            if (!startswith(key, '_')) {
                struct.push(key as (keyof T));
            }
        }
        return struct;
    }

    static objectToArray<T>(obj: T, structure?: (keyof T)[]) {
        var arr: any[] = [];
        structure = structure || this.struct(obj);
        structure.forEach((key) => {
            if (key) arr.push((obj as any)[key]);
        });
        return arr;
    }

    static arrayToObject<T>(arr: any, obj: T, structure?: (keyof T | null)[]) {
        structure = structure || this.struct<T>(obj);
        structure.forEach((key, idx) => {
            if (!key)
                return;
            obj[key] = arr[idx];
        });

        return obj;
    }

    static update(orig: any, update: {[x: string]: any;}) {
        for (let key in orig) {
            if (!orig[key] && update[key]) {
                orig[key] = update[key];
            }
        }
        
        return orig;
    }

    static clone(src: Song, dest?: Song) {
        dest = !dest ? new Song() : dest;
        return this.arrayToObject(this.objectToArray(src), dest);
    }
}
