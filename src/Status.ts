import { debug } from "./gmusic-playlist.user";

export default class Status {
    element: HTMLElement | null;
    progress: string;
    
    constructor() {
        this.element = null;
        this.progress = '';
    }

    update(msg: string) {
        debug(msg);
        if (this.element) {
            setTimeout(() => {
                this.element ? this.element.innerHTML = this.progress + msg : null;
            }, 500);
        }
    }
}
