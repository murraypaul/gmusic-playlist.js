import { STRU } from "./gmusic-playlist.user";

/* string utility functions */
export default class StringFunctions {
    wildWords: RegExp;
    brackets: RegExp;
    nonWordChars: RegExp;
    constructor() {
        this.wildWords = /\w*(\*+)\w*/g;
        this.brackets = /\[.*?\]|\(.*?\)|\{.*?\}|<.*?>/g;
        this.nonWordChars = /[\W_]+/g;
    }
    startswith(str: string, prefix: string | null) {
        if (!prefix || !str)
            return false;
        return str.slice(0, prefix.length) === prefix;
    }
    /* search in the string, return true if found, false otherwise */
    contains(str: string, search: string) {
        return String(str).indexOf(String(search)) > -1;
    }
    closeMatch(str1: any, str2: any) {
        if (!str1 || !str2) {
            return false;
        }
        var reg1 = String(str1).toLowerCase().replace(STRU.nonWordChars, '');
        var reg2 = String(str2).toLowerCase().replace(STRU.nonWordChars, '');
        if (reg1 === '' && reg2 !== '' || reg1 === '' && reg2 !== '') {
            return false;
        }
        var sizeratio = reg1.length / reg2.length;
        if ((sizeratio < 0.5 || sizeratio > 2) &&
            (!String(str1).match(STRU.brackets) || !String(str1).match(STRU.brackets))) {
            return false;
        }
        /* on the fly regex compilation is just too slow */
        //return str1.match(new RegExp(reg2s,'gi')) || str2.match(new RegExp(reg1s,'gi'));
        return this.contains(reg1, reg2) || this.contains(reg2, reg1);
    }
    /* left padd a number
    http://stackoverflow.com/a/10073788/5648123
    */
    pad(num: string, width: number, pchar?: string) {
        pchar = pchar || '0';
        num = String(num);
        return num.length >= width ?
            num : new Array(width - num.length + 1).join(pchar) + num;
    }
}
