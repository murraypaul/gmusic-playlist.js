import Converter from "./Converter";
import GMusic from "./GMusic";
import { session, stat } from "./gmusic-playlist.user";
import Song from "./Song";
import Songlist from "./Songlist";
import XDoc from "./XDoc";

/* handle exporting playlists */
export default class Exporter {
    listenTo(ahref: HTMLElement) {
        ahref.addEventListener('click', () => this.export(), false);
    }
    
    /* return a csv string for the given songlists */
    generateCsv(songlists: Songlist[]) {
        var csv = '';
        var conv = new Converter();
        csv += conv.arrayToCsv(conv.struct(new Song())) + conv.csvchar + 'playlist\n';

        songlists.forEach((songlist) => {
            songlist.songs.forEach((song) => {
                csv += conv.arrayToCsv(conv.objectToArray(song)) +
                    conv.csvchar + conv.quoteCsv(songlist.name) + '\n';
            });
        });

        stat.update('generated csv for ' + songlists.length + ' playlists');
        return csv;
    }

    /* trigger a download file for the given csv text */
    downloadCsv(csv: BlobPart, filename: string) {
        /* use blob to overcome href data limits */
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var doc = new XDoc(document);

        doc.create('a', null, {
            'href': url, 'download': filename
        }).click();

        /* TODO may need to call revokeOjectURL to clean up mem */
    }

    export() {
        var exporter = this;
        var music = new GMusic(session);

        var populateSonglists = (songlists: Songlist[]) => {
            var lists = [];
            var populated: Songlist[] = [];
            var addpop = (full: Songlist) => {
                populated.push(full);
            };
            songlists.forEach((songlist) => {
                lists.push(music.getPlaylistSongs(songlist).then(addpop));
            });
            lists.push(music.getThumbsUp().then(addpop));
            lists.push(music.getLibrary().then(addpop));
            stat.update('queued up ' + lists.length + ' playlists for download');
            return Promise.all(lists).then(() => {
                var totalSongs = 0;
                populated.forEach((plist) => {
                    totalSongs += plist.songs.length;
                });
                stat.progress = totalSongs + ' songs. ';
                stat.update('obtained ' + populated.length + ' playlists');
                return populated;
            });
        };

        music.getPlaylists().then(populateSonglists).then((songlists: Songlist[]) => {
            exporter.downloadCsv(exporter.generateCsv(songlists), 'playlists_export.csv');
        });
    }
}
