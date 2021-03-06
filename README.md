gmusic-playlist.js
===============

javascript based playlist scripts for gmusic

## prerequisites
 
 - greasemonkey addon for your browser
  - chrome: [tampermonkey extension](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=en)

## installation

 - install the appropriate addon for your browser
 - open the [gmusic-playlist.user.js](gmusic-playlist.user.js?raw=true) script in your browser and click the install button.

## usage

 - navigate to [Google Music](http://music.google.com)
 - click the menu item to access the import / export functionality.

![Screenshot](screenshot.png?raw=true "Screenshot of the UI")

## importing

the script will allow songs to be imported from csv formated files. a single
file will be used for one or more playlists, a column in the csv file will
indicate which playlist a song belongs in. the first row of the csv file will
be reserved for headers indicating what each column in the file is.

see the [example.csv](example.csv) file for a fairly detailed set of playlists
and see the [example_minimal.csv](example_minimal.csv) file for the minimum
required structure needed for importing a list of songs.

when creating a csv file use the unicode utf-8 character set and a comma
as a the seperator character. some spreadsheet apps default to another
character set when saving to csv so be aware.

click the button bellow Import Playlists to select the csv file to import.

after the file is imported, a results csv file will be provided that includes
all the songs that were imported and their associated ids and other info. the
file can be used to see which songs imported correctly and which ones didn't.
for the songs that didn't import correctly the data can be updated and the file
re-imported if needed.

## exporting

the script will export songs to csv formated files. a single file will be
exported for all playlists. each song will have the playlist that it belonged
to exported as a column in the csv file. the first row of the csv file will be
reserved for headers indicating what each column in the file is.

click the Export Playlists link to export the playlists.

in addition to playlists, the entire personal library will also be exported
into a playlist called Library.

## debugging

when editing the script in tampermonkey place `debugger;` statements within the script to have the debugger console stop at those breakpoints so that variables and logic can be easily inspected.  since google may change the response format for search and song data, the key place to check that the code is looking for data in the right place are in the fromGMusic methods of the Songlist and Song structures.

## known issues

### no firefox support
although there is a [greasemonkey addon](https://addons.mozilla.org/en-us/firefox/addon/greasemonkey/) for firefox this script is only compatible with chrome for now.

### large playlists
when importing a new playlist avoid importing large playlists (10k+ songs) all at once. google only allows so many search operations per period of time. if the max number of allowed operations per period of time is reached any further requests to the google music service will be denied until a cool down period has passed.

## see also

 - [the original python based version](
   https://github.com/soulfx/gmusic-playlist)
