import Converter from "./Converter";
import GMusic from "./GMusic";
import { session, status } from "./gmusic-playlist.user";
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
        var csv = Converter.arrayToCsv(Converter.struct(new Song())) + Converter.csvchar + 'playlist\n';

        songlists.forEach((songlist) => {
            songlist.songs.forEach((song) => {
                csv += Converter.arrayToCsv(Converter.objectToArray(song)) +
                Converter.csvchar + Converter.quoteCsv(songlist.name!) + '\n';
            });
        });

        status.update('generated csv for ' + songlists.length + ' playlists');
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

        var populateSonglists = async (songlists: Songlist[]) => {
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
            status.update('queued up ' + lists.length + ' playlists for download');
            await Promise.all(lists);
            var totalSongs = 0;
            populated.forEach((plist) => {
                totalSongs += plist.songs.length;
            });
            status.progress = totalSongs + ' songs. ';
            status.update('obtained ' + populated.length + ' playlists');
            return populated;
        };

        music.getPlaylists().then(populateSonglists).then((songlists: Songlist[]) => {
            exporter.downloadCsv(exporter.generateCsv(songlists), 'playlists_export.csv');
        });
    }
}
