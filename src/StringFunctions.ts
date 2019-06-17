export const wildWords: RegExp = /\w*(\*+)\w*/g;
export const brackets: RegExp = /\[.*?\]|\(.*?\)|\{.*?\}|<.*?>/g;
export const nonWordChars: RegExp = /[\W_]+/g;

export function startswith(str: string, prefix: string | null) {
    if (!prefix || !str)
        return false;
    return str.slice(0, prefix.length) === prefix;
}

/* search in the string, return true if found, false otherwise */
export function contains(str: string, search: string) {
    return String(str).indexOf(String(search)) > -1;
}

export function closeMatch(str1: any, str2: any) {
    if (!str1 || !str2) {
        return false;
    }
    var reg1 = String(str1).toLowerCase().replace(nonWordChars, '');
    var reg2 = String(str2).toLowerCase().replace(nonWordChars, '');

    if (reg1 === '' && reg2 !== '' || reg1 === '' && reg2 !== '') {
        return false;
    }

    var sizeratio = reg1.length / reg2.length;

    if ((sizeratio < 0.5 || sizeratio > 2) &&
        (!String(str1).match(brackets) || !String(str1).match(brackets))) {
        return false;
    }

    /* on the fly regex compilation is just too slow */
    //return str1.match(new RegExp(reg2s,'gi')) || str2.match(new RegExp(reg1s,'gi'));
    return contains(reg1, reg2) || contains(reg2, reg1);
}

/* left padd a number
http://stackoverflow.com/a/10073788/5648123
*/
export function pad(num: number, width: number, pchar?: string) {
    pchar = pchar || '0';
    let numValue = String(num);
    return numValue.length >= width ?
        numValue : new Array(width - numValue.length + 1).join(pchar) + numValue;
}
